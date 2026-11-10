/**
 * Convierte un presupuesto ACEPTADO en reserva:
 *  1. Relee el presupuesto (que siga aceptado: evita convertir dos veces).
 *  2. Crea la reserva con sus bloqueos de calendario (createPhoneReservation, la misma lógica
 *     que new-booking): price = total con IVA, price_net_usd = subtotal sin IVA, quote_id,
 *     cotización por hora y estimated_costs (desde los costos del presupuesto).
 *  3. Marca el presupuesto 'converted' con el reservationId.
 */
import { db } from "@/config/firebase";
import { createPhoneReservation } from "@/hooks/usePhoneReservation";
import { parseQuoteDoc } from "@/hooks/useQuotes";
import { QuoteDoc } from "@/types/quote";
import { PhoneReservationResult } from "@/types/reservation-create";
import { estimatedCostsFromQuote, quoteShortNumber, toDateSafe } from "@/utils/quote-format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

async function convertQuote(quoteId: string): Promise<PhoneReservationResult> {
    let quote: QuoteDoc;
    try {
        const snap = await getDoc(doc(db, "quotes", quoteId));
        if (!snap.exists()) throw new Error("El presupuesto ya no existe.");
        quote = parseQuoteDoc(snap.id, snap.data());
    } catch (error) {
        console.error("Error al leer el presupuesto a convertir:", error);
        throw error;
    }
    if (quote.status === "converted") throw new Error("Este presupuesto ya se convirtió en reserva.");
    if (quote.status !== "accepted") throw new Error("Solo se puede crear la reserva de un presupuesto aceptado.");
    if (!quote.clientId) throw new Error("El presupuesto no tiene un cliente registrado. Editalo y elegí el cliente.");
    const outbound = toDateSafe(quote.schedule.outbound_flight_departure_time);
    if (!outbound) throw new Error("El presupuesto no tiene fecha de salida.");

    const p = quote.pricing;
    const internal = (quote.internalNotes || "").trim();
    const result = await createPhoneReservation({
        aircraftId: quote.aircraftId,
        clientId: quote.clientId,
        priceNetUsd: quote.subtotalUsd,
        estimatedPriceUsd: quote.subtotalSuggestedUsd,
        distanceNm: Number(p?.distance_nm) || 0,
        cruiseSpeedKnots: Number(p?.cruise_speed_knots) || 0,
        billableHours: Number(p?.billable_hours) || 0,
        pricePerHourUsd: Number(p?.price_per_hour_usd) || 0,
        overnightNights: Number(p?.overnight_nights) || 0,
        overnightFeeUsd: Number(p?.overnight_fee_usd) || 0,
        hangarPerNightUsd: Number(p?.hangar_per_night_usd) || 0,
        trip: {
            origin_airport_ident: quote.trip.origin_airport_ident,
            origin_timezone: quote.trip.origin_timezone || "",
            destination_airport_ident: quote.trip.destination_airport_ident,
            destination_timezone: quote.trip.destination_timezone || "",
        },
        roundtrip: !!quote.schedule.roundtrip,
        outboundDeparture: outbound,
        returnDeparture: quote.schedule.roundtrip ? toDateSafe(quote.schedule.return_flight_departure_time) : null,
        passengers: Math.max(1, Number(quote.passengers) || 1),
        statusNotes: `Reserva desde el presupuesto #${quoteShortNumber(quote.id)}.${internal ? ` Notas: ${internal}` : ""}`,
        quoteId: quote.id,
        estimatedCosts: estimatedCostsFromQuote(quote.costs || [], Number(p?.billable_hours) || 0),
    });

    try {
        await updateDoc(doc(db, "quotes", quoteId), {
            status: "converted",
            reservationId: result.reservationId,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        // La reserva ya existe: avisar para que no se cree otra.
        console.error("La reserva se creó pero no se pudo marcar el presupuesto como convertido:", error);
        throw new Error(
            `La reserva se creó (id ${result.reservationId}), pero no se pudo marcar el presupuesto como convertido. No la vuelvas a crear.`
        );
    }
    return result;
}

export function useConvertQuote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: convertQuote,
        onSettled: async (_data, _error, quoteId) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["quotes"] }),
                queryClient.invalidateQueries({ queryKey: ["quote", quoteId] }),
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
