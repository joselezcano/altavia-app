/**
 * Edición, eliminación y datos operativos de una reserva (owner, encargada y admin).
 *
 * - Editar: sin pagar cambia ruta, fechas, ida/vuelta, pasajeros y precio; pagada solo
 *   reprograma fechas y horas. En ambos casos se recrean los bloqueos de calendario
 *   (aircraft-availability) y se guardan los event_ids nuevos.
 * - Eliminar: solo sin pagar. Primero los bloqueos, después la reserva.
 * - La fila de GIO (owner_operational_flights) la sincroniza el servidor (gio-sync.ts).
 */
import { db } from "@/config/firebase";
import { countOvernights } from "@/utils/flight-pricing";
import { AircraftAvailability, ClientReservationItem } from "@/types/all-roles";
import { ReservationEditInput, ReservationLegBlock } from "@/types/reservation-edit";
import { isReservationPaid } from "@/utils/paid-reservation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    updateDoc,
    where,
} from "firebase/firestore";

/** Fecha (YYYY-MM-DD) y hora (HH:MM) en la zona del aeropuerto, o en la del dispositivo si no hay. */
function formatInTimezone(date: Date, timeZone?: string): { selected_date: string; time: string } {
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = () => ({
        selected_date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    });
    if (!timeZone) return local();
    try {
        const parts = new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone,
        }).formatToParts(date);
        const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
        const hour = get("hour") === "24" ? "00" : get("hour");
        return { selected_date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
    } catch {
        return local();
    }
}

/** Bloqueo de calendario de un tramo de vuelo (mismo formato que new-booking y el cliente). */
function buildFlightBlock(aircraftId: string, leg: ReservationLegBlock): AircraftAvailability {
    const start = formatInTimezone(leg.start, leg.timezone);
    const end = formatInTimezone(leg.end, leg.timezone);
    return {
        aircraftId,
        selected_date: start.selected_date,
        start_time: start.time,
        end_time: end.time,
        start_timestamp: leg.start,
        end_timestamp: leg.end,
        all_day: false,
        recurrence: {
            period: "none",
            interval: 1,
            days_of_week: [],
            ends: { type: "never", date: null, occurrences: 0 },
        },
        reason: "flight",
        notes: leg.notes,
    };
}

const toDate = (v: any): Date | null => {
    if (!v) return null;
    const d = v?.toDate ? v.toDate() : new Date(v);
    return isNaN(d.getTime()) ? null : d;
};

/** Borra bloqueos de calendario uno por uno; si alguno ya no existe, sigue con los demás. */
async function deleteAvailabilityEvents(eventIds: string[]) {
    for (const eventId of eventIds) {
        try {
            await deleteDoc(doc(db, "aircraft-availability", eventId));
        } catch (error) {
            console.warn(`No se pudo borrar el bloqueo ${eventId} de aircraft-availability:`, error);
        }
    }
}

/** Invalida las listas y detalles que muestran reservas o calendario. */
function useInvalidateReservations() {
    const queryClient = useQueryClient();
    return async (reservationId: string) => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["reservation-details", reservationId] }),
            queryClient.invalidateQueries({ queryKey: ["owner-reservations"] }),
            queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] }),
            queryClient.invalidateQueries({ queryKey: ["client-reservations"] }),
            queryClient.invalidateQueries({ queryKey: ["admin-all-reservations"] }),
            queryClient.invalidateQueries({ queryKey: ["all-reservations-dashboard"] }),
            queryClient.invalidateQueries({ queryKey: ["aircraft-availability"] }),
            queryClient.invalidateQueries({ queryKey: ["available-aircrafts"] }),
        ]);
    };
}

export function useEditReservation() {
    const invalidate = useInvalidateReservations();

    return useMutation({
        mutationFn: async (input: ReservationEditInput) => {
            const { reservation, isPaid } = input;
            if (isPaid !== isReservationPaid(reservation)) {
                throw new Error("El estado de pago de la reserva cambió. Volvé a abrir la edición.");
            }

            const legs: { start: Date; end: Date }[] = [{ start: input.outboundStart, end: input.outboundEnd }];
            if (input.roundtrip && input.returnStart && input.returnEnd) {
                legs.push({ start: input.returnStart, end: input.returnEnd });
            }

            // 1. Choque de horarios con otras reservas activas de la misma aeronave.
            try {
                const snap = await getDocs(
                    query(collection(db, "aircraft-reservation"), where("aircraftId", "==", reservation.aircraftId))
                );
                for (const other of snap.docs) {
                    if (other.id === reservation.id) continue;
                    const d = other.data();
                    if (d.client_status === "canceled" || d.internal_status === "canceled" || d.internal_status === "cancelled") continue;
                    const otherLegs = [
                        [toDate(d.schedule?.outbound_flight_departure_time), toDate(d.schedule?.outbound_flight_arrival_time)],
                        [toDate(d.schedule?.return_flight_departure_time), toDate(d.schedule?.return_flight_arrival_time)],
                    ];
                    for (const [oStart, oEnd] of otherLegs) {
                        if (!oStart || !oEnd) continue;
                        const overlaps = legs.some(
                            (l) => l.start.getTime() < oEnd.getTime() && l.end.getTime() > oStart.getTime()
                        );
                        if (overlaps) {
                            throw new Error(
                                "La aeronave ya tiene otra reserva activa en ese horario. Elegí otra fecha u hora."
                            );
                        }
                    }
                }
            } catch (error) {
                console.error("Error al validar choques de horario al editar la reserva:", error);
                throw error;
            }

            const originIdent = input.origin?.ident || reservation.trip.origin_airport_ident;
            const destinationIdent = input.destination?.ident || reservation.trip.destination_airport_ident;
            const originTz = input.origin ? input.origin.timezone || "" : reservation.trip.origin_timezone || "";
            const destinationTz = input.destination
                ? input.destination.timezone || ""
                : reservation.trip.destination_timezone || "";

            // 2. Bloqueos nuevos del calendario.
            const newEventIds: string[] = [];
            try {
                const outboundRef = await addDoc(
                    collection(db, "aircraft-availability"),
                    buildFlightBlock(reservation.aircraftId, {
                        start: input.outboundStart,
                        end: input.outboundEnd,
                        timezone: originTz,
                        notes: `Vuelo de ${originIdent} a ${destinationIdent}`,
                    })
                );
                newEventIds.push(outboundRef.id);

                if (input.roundtrip && input.returnStart && input.returnEnd) {
                    const returnRef = await addDoc(
                        collection(db, "aircraft-availability"),
                        buildFlightBlock(reservation.aircraftId, {
                            start: input.returnStart,
                            end: input.returnEnd,
                            timezone: destinationTz,
                            notes: `Vuelo de retorno de ${destinationIdent} a ${originIdent}`,
                        })
                    );
                    newEventIds.push(returnRef.id);
                }
            } catch (error) {
                console.error("Error al crear los bloqueos de calendario de la reserva:", error);
                await deleteAvailabilityEvents(newEventIds);
                throw error;
            }

            // 3. Reserva. Pagada: solo horarios (el precio y la ruta quedan fijos).
            const update: Record<string, unknown> = {
                schedule: {
                    roundtrip: input.roundtrip,
                    outbound_flight_departure_time: input.outboundStart,
                    outbound_flight_arrival_time: input.outboundEnd,
                    return_flight_departure_time: input.roundtrip ? input.returnStart : null,
                    return_flight_arrival_time: input.roundtrip ? input.returnEnd : null,
                },
                event_ids: newEventIds,
            };

            if (!isPaid) {
                if (input.origin && input.destination) {
                    update.trip = {
                        origin_airport_ident: input.origin.ident,
                        origin_timezone: input.origin.timezone || "",
                        destination_airport_ident: input.destination.ident,
                        destination_timezone: input.destination.timezone || "",
                    };
                }
                if (input.distanceNm !== undefined) update.distance_nm = input.distanceNm;
                if (input.cruiseSpeedKnots !== undefined) update.cruise_speed_knots = input.cruiseSpeedKnots;
                if (input.passengers !== undefined) update.capacity = { passangers: input.passengers };
                if (input.price !== undefined) update.price = input.price;
                if (input.quote) {
                    update.estimated_price = input.quote.totalUsd;
                    update.billable_hours = input.quote.billableHours;
                    update.price_per_hour_usd = input.quote.pricePerHourUsd;
                    update.overnight_nights = input.quote.nights;
                    update.overnight_fee_usd = input.quote.overnightFeeUsd;
                    update.hangar_per_night_usd = input.quote.hangarPerNightUsd;
                }
            } else {
                // Pagada: el precio queda fijo, pero si cambian las noches fuera se actualizan
                // (GIO las usa para el pernocte del piloto y el hangaraje).
                update.overnight_nights = input.roundtrip
                    ? countOvernights(input.outboundStart, input.returnStart)
                    : 0;
            }

            try {
                await updateDoc(doc(db, "aircraft-reservation", reservation.id), update);
            } catch (error) {
                console.error("Error al actualizar la reserva:", error);
                // La reserva sigue con sus bloqueos viejos: se descartan los nuevos.
                await deleteAvailabilityEvents(newEventIds);
                throw error;
            }

            // 4. Bloqueos viejos.
            await deleteAvailabilityEvents((reservation.event_ids || []).filter((id) => !newEventIds.includes(id)));

            return reservation.id;
        },
        onSuccess: (reservationId) => invalidate(reservationId),
    });
}

/** Elimina una reserva SIN pagar: primero sus bloqueos de calendario y después la reserva. */
export function useDeleteReservation() {
    const invalidate = useInvalidateReservations();

    return useMutation({
        mutationFn: async (reservation: ClientReservationItem) => {
            if (isReservationPaid(reservation)) {
                throw new Error("Las reservas pagadas no se eliminan: cancelalas desde el cambio de estado.");
            }
            await deleteAvailabilityEvents(reservation.event_ids || []);
            try {
                await deleteDoc(doc(db, "aircraft-reservation", reservation.id));
            } catch (error) {
                console.error("Error al eliminar la reserva:", error);
                throw error;
            }
            return reservation.id;
        },
        onSuccess: (reservationId) => invalidate(reservationId),
    });
}

/** Carga o edita el ID de vuelo de FlightAware (fa_flight_id) de la reserva. */
export function useUpdateFaFlightId() {
    const invalidate = useInvalidateReservations();

    return useMutation({
        mutationFn: async ({ reservationId, faFlightId }: { reservationId: string; faFlightId: string }) => {
            const value = faFlightId.trim();
            try {
                await updateDoc(doc(db, "aircraft-reservation", reservationId), {
                    fa_flight_id: value === "" ? null : value,
                });
            } catch (error) {
                console.error("Error al guardar el ID de FlightAware:", error);
                throw error;
            }
            return reservationId;
        },
        onSuccess: (reservationId) => invalidate(reservationId),
    });
}
