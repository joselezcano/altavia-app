/**
 * Alta de una reserva cargada por la admin, el owner o la encargada (despacho telefónico),
 * directa desde new-booking o al convertir un presupuesto aceptado.
 * Ver src/hooks/usePhoneReservation.ts.
 */
import type { AircraftReservation } from "./all-roles";

/** Costos estimados que se guardan en la reserva (GIO los usa al crear la fila del vuelo). */
export type ReservationEstimatedCosts = NonNullable<AircraftReservation["estimated_costs"]>;

export interface PhoneReservationInput {
    aircraftId: string;
    clientId: string;
    /** Precio acordado SIN IVA. La reserva guarda price = grossFromNet(priceNetUsd). */
    priceNetUsd: number;
    /** Precio sugerido por el sistema (sin IVA), como referencia. */
    estimatedPriceUsd?: number;
    distanceNm: number;
    cruiseSpeedKnots: number;
    billableHours: number;
    pricePerHourUsd: number;
    overnightNights: number;
    overnightFeeUsd: number;
    hangarPerNightUsd: number;
    trip: {
        origin_airport_ident: string;
        origin_timezone: string;
        destination_airport_ident: string;
        destination_timezone: string;
    };
    roundtrip: boolean;
    outboundDeparture: Date;
    returnDeparture: Date | null;
    passengers: number;
    /** Texto de status_notes. */
    statusNotes: string;
    /** Presupuesto del que sale la reserva. */
    quoteId?: string;
    estimatedCosts?: ReservationEstimatedCosts;
}

export interface PhoneReservationResult {
    reservationId: string;
}
