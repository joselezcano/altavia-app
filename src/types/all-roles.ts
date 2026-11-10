import { z } from 'zod';


export const AirportSchema = z.object({
    ident: z.string(),
    type: z.enum(['large_airport', 'medium_airport', 'small_airport', 'heliport', 'closed']),
    name: z.string(),
    latitude_deg: z.number(),
    longitude_deg: z.number(),
    elevation_ft: z.number().nullable(),
    country: z.string(),
    region: z.string(),
    municipality: z.string().nullable(),
    iata_code: z.string().nullable(),
    icao_code: z.string().nullable(),
    gps_code: z.string().nullable(),
    search_tags: z.array(z.string()).optional(),
    timezone: z.string().optional(),
    matchingScore: z.number().optional(),
});

export type Airport = z.infer<typeof AirportSchema>;


export const AircraftAvailabilitySchema = z.object({
    aircraftId: z.string(),
    selected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
    start_timestamp: z.date().optional(),
    end_timestamp: z.date().optional(),
    all_day: z.boolean().optional(),
    recurrence: z.object({
        period: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
        interval: z.number().nonnegative().int(),
        days_of_week: z.array(z.enum(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])),
        ends: z.object({
            type: z.enum(["never", "date", "occurrences"]),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").nullable(),
            occurrences: z.number().nonnegative().int(),
        }),
    }),
    reason: z.enum(['maintenance', 'owner_use', 'holidays', 'not_in_base', 'no_pilot', 'rental', 'legal_restriction', 'other', 'flight']),
    notes: z.string().optional(),
});

export type AircraftAvailability = z.infer<typeof AircraftAvailabilitySchema>;

export interface AircraftAvailabilityDoc extends AircraftAvailability {
    id: string;
}


export const DocumentTypeSchema = z.enum(["CI", "PASSPORT", "DNI", "OTHER"]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const PassengerManifestItemSchema = z.object({
    id: z.string().optional(),
    fullName: z.string().min(2, "El nombre completo es requerido"),
    documentType: DocumentTypeSchema.default("CI"),
    documentNumber: z.string().min(3, "Número de documento requerido"),
    nationality: z.string().default("Paraguaya"),
    weightKg: z.number().nonnegative().default(75),
    luggageKg: z.number().nonnegative().default(10),
    isPrimary: z.boolean().default(false),
    notes: z.string().optional(),
    // Embarque (boarding pass): token aleatorio del QR y registro del escaneo.
    // Ver src/utils/boarding-pass.ts.
    boardingToken: z.string().optional(),
    boardedAt: z.string().optional(), // ISO 8601
    boardedBy: z.string().optional(), // uid de quien escaneó
});

export type PassengerManifestItem = z.infer<typeof PassengerManifestItemSchema>;

export const AircraftReservationSchema = z.object({
    aircraftId: z.string(),
    fa_flight_id: z.string().nullable(),
    clientId: z.string().optional(),
    price: z.number().nonnegative(), // TOTAL A PAGAR con IVA (lo que cobra Bancard)
    price_net_usd: z.number().nonnegative().optional(), // precio sin IVA (desde el 09/11/2026)
    quote_id: z.string().optional(), // presupuesto del que salió la reserva
    // Costos estimados del presupuesto (USD): GIO los usa como punto de partida de la fila del vuelo.
    estimated_costs: z
        .object({
            fuel_usd: z.number().optional(),
            pilot_per_hour_usd: z.number().optional(),
            copilot_usd: z.number().optional(),
            crew_overnight_usd: z.number().optional(),
            flight_plan_usd: z.number().optional(),
            hangar_usd: z.number().optional(),
            other_usd: z.number().optional(),
        })
        .optional(),
    estimated_price: z.number().nonnegative().optional(),
    currency: z.string().default("USD").optional(),
    distance_nm: z.number().positive(),
    cruise_speed_knots: z.number().positive(),
    // Cotización por hora (ver src/utils/flight-pricing.ts)
    billable_hours: z.number().nonnegative().optional(), // incluye reposicionamiento y regreso vacío
    price_per_hour_usd: z.number().nonnegative().optional(),
    overnight_nights: z.number().int().nonnegative().optional(),
    overnight_fee_usd: z.number().nonnegative().optional(),
    hangar_per_night_usd: z.number().nonnegative().optional(),
    trip: z.object({
        origin_airport_ident: z.string(),
        origin_timezone: z.string().optional(),
        destination_airport_ident: z.string(),
        destination_timezone: z.string().optional(),
    }),
    schedule: z.object({
        roundtrip: z.boolean(),
        outbound_flight_departure_time: z.date(),
        outbound_flight_arrival_time: z.date(),
        return_flight_departure_time: z.date().nullable(),
        return_flight_arrival_time: z.date().nullable(),
    }),
    capacity: z.object({
        passangers: z.number().positive().int(), // Requested seats by the client
    }),
    passengers: z.array(PassengerManifestItemSchema).optional(),
    event_ids: z.array(z.string()),
    client_status: z.enum([
        "unpaid",        // Client has not paid for the flight yet
        "reserved",      // Client has partially paid for the flight (reservation deposit)
        "confirmed",     // Client has paid for the flight in full
        "canceled",      // Client has canceled the reservation or flight
        "refunded",      // Reservation or flight has been refunded
    ]),
    internal_status: z.enum([
        "pending",            // Legacy pending status
        "pending_approval",   // Client requested reservation; pending owner/encargado operational approval & pilot assignment
        "awaiting_payment",   // Owner/encargado approved and assigned pilots; awaiting client payment
        "confirmed",          // Reservation is confirmed: payment complete, aircraft and pilots confirmed
        "canceled",           // Reservation was canceled by the aircraft owner, client or another reason
        "delayed",            // Flight was delayed
        "in_flight",          // Flight in progress
        "completed",          // Flight completed
        "no_show"             // Client did not show up for the reservation
    ]),
    status_notes: z.string().optional(),
    pilot_ids: z.array(z.string()),
    created_at: z.date().optional(),
    paid_at: z.date().optional(),
    payment_method: z.string().optional(),
    payment_transaction_id: z.string().optional(),
    invoice_number: z.string().optional(),
    invoice_timbrado: z.string().optional(),
    invoice_cdc: z.string().optional(),
    invoice_url: z.string().optional(),
});

export type AircraftReservation = z.infer<typeof AircraftReservationSchema>;

export interface AircraftReservationDoc extends AircraftReservation {
    id: string;
}

import type { AircraftSpecs } from './owner';

export interface ClientReservationItem extends AircraftReservationDoc {
    aircraftSpecs?: AircraftSpecs;
    originAirport?: Airport;
    destinationAirport?: Airport;
}

export interface OwnerReservationItem extends AircraftReservationDoc {
    outboundTime: Date;
}


import { Timestamp } from '@firebase/firestore';

// Date type
export const dateSchema = z.union([z.coerce.date(), z.instanceof(Timestamp)]);

export const AircraftReservationStatusLogSchema = z.object({
    reservation_id: z.string(),
    internal_status: z.enum([
        "pending",
        "pending_approval",
        "awaiting_payment",
        "confirmed",
        "canceled",
        "delayed",
        "in_flight",
        "completed",
        "no_show"
    ]),
    status_notes: z.string().optional(),
    created_at: dateSchema,
});

export type AircraftReservationStatusLog = z.infer<typeof AircraftReservationStatusLogSchema>;