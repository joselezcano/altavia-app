/**
 * Alta de una reserva telefónica (admin, owner o encargada), compartida por:
 *  - new-booking ("Reservar sin presupuesto"), y
 *  - el detalle del presupuesto ("Crear reserva", al convertir uno aceptado).
 *
 * Es la misma lógica que tenía new-booking: control de choque con otra reserva de la
 * aeronave, bloqueos de calendario (aircraft-availability) de la ida y la vuelta, y la
 * reserva en estado 'pending_approval' / 'unpaid'. El precio acordado es SIN IVA: la
 * reserva guarda price = total con IVA (lo que cobra Bancard) y price_net_usd.
 */
import { db } from "@/config/firebase";
import { AircraftAvailability, AircraftReservation } from "@/types/all-roles";
import { PhoneReservationInput, PhoneReservationResult } from "@/types/reservation-create";
import { grossFromNet } from "@/utils/flight-pricing";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";

/** La aeronave ya tiene una reserva activa en ese horario. */
export class ReservationConflictError extends Error {
    constructor() {
        super("La aeronave ya cuenta con una reserva activa para ese horario. Modifica el horario de salida.");
        this.name = "ReservationConflictError";
    }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function flightBlock(aircraftId: string, start: Date, end: Date, notes: string): AircraftAvailability {
    return {
        aircraftId,
        selected_date: start.toISOString().split("T")[0],
        start_time: hhmm(start),
        end_time: hhmm(end),
        start_timestamp: start,
        end_timestamp: end,
        all_day: false,
        recurrence: {
            period: "none",
            interval: 1,
            days_of_week: [],
            ends: { type: "never", date: null, occurrences: 0 },
        },
        reason: "flight",
        notes,
    };
}

/** true si la ida choca con otra reserva activa de la aeronave. */
async function hasOutboundCollision(aircraftId: string, outboundStart: Date, outboundEnd: Date): Promise<boolean> {
    try {
        const snap = await getDocs(query(collection(db, "aircraft-reservation"), where("aircraftId", "==", aircraftId)));
        for (const docSnap of snap.docs) {
            const d = docSnap.data();
            if (d.client_status === "canceled" || d.internal_status === "cancelled" || d.internal_status === "canceled") continue;
            const existOutStart = d.schedule?.outbound_flight_departure_time?.toDate
                ? d.schedule.outbound_flight_departure_time.toDate()
                : new Date(d.schedule?.outbound_flight_departure_time);
            const existOutEnd = d.schedule?.outbound_flight_arrival_time?.toDate
                ? d.schedule.outbound_flight_arrival_time.toDate()
                : new Date(d.schedule?.outbound_flight_arrival_time);
            if (existOutStart && existOutEnd && !isNaN(existOutStart.getTime()) && !isNaN(existOutEnd.getTime())) {
                if (outboundStart.getTime() < existOutEnd.getTime() && outboundEnd.getTime() > existOutStart.getTime()) {
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.error("Error al verificar choques de horario de la aeronave:", error);
        throw error;
    }
}

/** Crea los bloqueos de calendario y la reserva. Lanza ReservationConflictError si hay choque. */
export async function createPhoneReservation(input: PhoneReservationInput): Promise<PhoneReservationResult> {
    const flightDurationHours = input.distanceNm > 0 && input.cruiseSpeedKnots > 0 ? input.distanceNm / input.cruiseSpeedKnots : 0;
    const durationMs = (flightDurationHours || 1) * 3600 * 1000;
    const outboundStart = new Date(input.outboundDeparture);
    const outboundEnd = new Date(outboundStart.getTime() + durationMs);

    if (await hasOutboundCollision(input.aircraftId, outboundStart, outboundEnd)) {
        throw new ReservationConflictError();
    }

    const { origin_airport_ident: from, destination_airport_ident: to } = input.trip;
    const eventIds: string[] = [];
    try {
        // 1. Bloqueo de la ida
        const outboundRef = await addDoc(
            collection(db, "aircraft-availability"),
            flightBlock(input.aircraftId, outboundStart, outboundEnd, `Vuelo telefónico de ${from} a ${to}`)
        );
        eventIds.push(outboundRef.id);

        // 2. Bloqueo de la vuelta (ida y vuelta)
        let returnStart: Date | null = null;
        let returnEnd: Date | null = null;
        if (input.roundtrip && input.returnDeparture) {
            returnStart = new Date(input.returnDeparture);
            returnEnd = new Date(returnStart.getTime() + durationMs);
            const returnRef = await addDoc(
                collection(db, "aircraft-availability"),
                flightBlock(input.aircraftId, returnStart, returnEnd, `Retorno telefónico de ${to} a ${from}`)
            );
            eventIds.push(returnRef.id);
        }

        // 3. Reserva
        const reservationData: AircraftReservation = {
            aircraftId: input.aircraftId,
            fa_flight_id: null,
            clientId: input.clientId,
            // El precio acordado es sin IVA; la reserva guarda el total con IVA (lo que cobra Bancard).
            price: grossFromNet(input.priceNetUsd),
            price_net_usd: input.priceNetUsd,
            ...(input.estimatedPriceUsd !== undefined ? { estimated_price: input.estimatedPriceUsd } : {}),
            currency: "USD",
            distance_nm: input.distanceNm,
            cruise_speed_knots: input.cruiseSpeedKnots,
            billable_hours: input.billableHours,
            price_per_hour_usd: input.pricePerHourUsd,
            overnight_nights: input.overnightNights,
            overnight_fee_usd: input.overnightFeeUsd,
            hangar_per_night_usd: input.hangarPerNightUsd,
            ...(input.quoteId ? { quote_id: input.quoteId } : {}),
            ...(input.estimatedCosts ? { estimated_costs: input.estimatedCosts } : {}),
            trip: input.trip,
            schedule: {
                roundtrip: input.roundtrip,
                outbound_flight_departure_time: outboundStart,
                outbound_flight_arrival_time: outboundEnd,
                return_flight_departure_time: returnStart,
                return_flight_arrival_time: returnEnd,
            },
            capacity: {
                passangers: input.passengers,
            },
            event_ids: eventIds,
            client_status: "unpaid",
            internal_status: "pending_approval",
            status_notes: input.statusNotes,
            pilot_ids: [],
            created_at: new Date(),
        };

        const resRef = await addDoc(collection(db, "aircraft-reservation"), reservationData);
        return { reservationId: resRef.id };
    } catch (error) {
        console.error("Error al registrar la reserva telefónica:", error);
        throw error;
    }
}

/** Mutación con las mismas invalidaciones que hacía new-booking. */
export function useCreatePhoneReservation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createPhoneReservation,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["all-reservations-dashboard"] }),
                queryClient.invalidateQueries({ queryKey: ["owner-reservations"] }),
                queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] }),
                queryClient.invalidateQueries({ queryKey: ["admin-all-reservations"] }),
                queryClient.invalidateQueries({ queryKey: ["available-aircrafts"] }),
                queryClient.invalidateQueries({ queryKey: ["aircraft-availability"] }),
            ]);
        },
    });
}
