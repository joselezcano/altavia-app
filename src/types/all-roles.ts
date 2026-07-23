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


export const AircraftReservationSchema = z.object({
    aircraftId: z.string(),
    clientId: z.string().optional(),
    price: z.number().nonnegative(),
    distance_nm: z.number().positive(),
    cruise_speed_knots: z.number().positive(),
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
        passangers: z.number().positive().int(),
    }),
    event_ids: z.array(z.string()),
    client_status: z.enum([
        "unpaid",        // Client has not paid for the flight yet
        "reserved",      // Client has partially paid for the flight (reservation deposit)
        "confirmed",     // Client has paid for the flight in full
        "canceled",      // Client has canceled the reservation or flight
        "refunded",      // Reservation or flight has been refunded
    ]),
    internal_status: z.enum([
        "pending",      // Reservation is pending: client has not paid in full yet, there is no aircraft or pilot, airport closed, or other reasons
        "confirmed",    // Reservation is confirmed: payment complete, aircraft and pilots confirmed
        "canceled",     // Reservation was canceled by the aircraft owner, client or another reason
        "delayed",      // Flight was delayed
        "in_flight",    // Flight in progress
        "completed",    // Flight completed
        "no_show"       // Client did not show up for the reservation
    ]),
    status_notes: z.string().optional(),
    pilot_ids: z.array(z.string()),
    created_at: z.date().optional(),
});

export type AircraftReservation = z.infer<typeof AircraftReservationSchema>;

export interface AircraftReservationDoc extends AircraftReservation {
    id: string;
}


import { Timestamp } from '@firebase/firestore';

// Date type
const dateSchema = z.union([z.coerce.date(), z.instanceof(Timestamp)]);

export const AircraftReservationStatusLogSchema = z.object({
    reservation_id: z.string(),
    internal_status: z.enum([
        "pending",      // Reservation is pending: client has not paid in full yet, there is no aircraft or pilot, airport closed, or other reasons
        "confirmed",    // Reservation is confirmed: payment complete, aircraft and pilots confirmed
        "canceled",     // Reservation was canceled by the aircraft owner, client or another reason
        "delayed",      // Flight was delayed
        "in_flight",    // Flight in progress
        "completed",    // Flight completed
        "no_show"       // Client did not show up for the reservation
    ]),
    status_notes: z.string().optional(),
    created_at: dateSchema,
});

export type AircraftReservationStatusLog = z.infer<typeof AircraftReservationStatusLogSchema>;