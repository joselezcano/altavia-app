import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// Strict URL schema
const strictUrlSchema = z.url();

// Path schema (starts with / or ./ or ../)
const pathSchema = z.string().regex(/^(\.?\.?\/)/, "Must be a valid path");

// Combine them using union
const urlOrPathSchema = z.union([strictUrlSchema, pathSchema]);

// Date type
const dateSchema = z.union([z.coerce.date(), z.instanceof(Timestamp)]);

export const flightAirportRefSchema = z.object({
    code: z.string().nullable(),
    code_icao: z.string().nullable(),
    code_iata: z.string().nullable(),
    code_lid: z.string().nullable(),
    timezone: z.string().nullable(),
    name: z.string().nullable(),
    city: z.string().nullable(),
    airport_info_url: urlOrPathSchema.nullable(),
});

export type FlightAirportRef = z.infer<typeof flightAirportRefSchema>;

const flightPositionSchema = z.object({
    fa_flight_id: z.string().nullable().optional(),
    altitude: z.number().int(),
    altitude_change: z.enum(['C', 'D', '-']),
    groundspeed: z.number().int(),
    heading: z.number().int().min(0).max(360).nullable(),
    latitude: z.number(),
    longitude: z.number(),
    timestamp: dateSchema,
    update_type: z.enum(['P', 'O', 'Z', 'A', 'M', 'D', 'X', 'S', 'V', '']).nullable(),
});

export const flightCurrentPositionSchema = z.object({
    ident: z.string(),
    ident_icao: z.string().nullable(),
    ident_iata: z.string().nullable(),
    fa_flight_id: z.string(),
    registration: z.string().nullable().optional(),
    origin: flightAirportRefSchema.nullable(), // nullable was added since this was not specified in the official API and was found in actual retrieved data
    destination: flightAirportRefSchema.nullable(), // nullable was added since this was not specified in the official API and was found in actual retrieved data
    waypoints: z.array(z.number()),
    first_position_time: dateSchema.nullable(),
    last_position: flightPositionSchema,
    bounding_box: z.array(z.number()).length(4),
    ident_prefix: z.string().nullable(),
    aircraft_type: z.string().nullable(),
    actual_off: dateSchema.nullable(),
    actual_on: dateSchema.nullable(),
    foresight_predictions_available: z.boolean(),
    predicted_out: dateSchema.nullable(),
    predicted_off: dateSchema.nullable(),
    predicted_on: dateSchema.nullable(),
    predicted_in: dateSchema.nullable(),
    predicted_out_source: z.enum(['', 'Foresight', 'Historical Average']).nullable(),
    predicted_off_source: z.enum(['', 'Foresight', 'Historical Average']).nullable(),
    predicted_on_source: z.enum(['', 'Foresight', 'Historical Average']).nullable(),
    predicted_in_source: z.enum(['', 'Foresight', 'Historical Average']).nullable(),
});

// GET /flights/{id}/position
export type FlightCurrentPosition = z.infer<typeof flightCurrentPositionSchema>;

export const flightSchema = z.object({
    ident: z.string(),
    ident_icao: z.string().nullable(),
    ident_iata: z.string().nullable(),
    actual_runway_off: z.string().nullable(),
    actual_runway_on: z.string().nullable(),
    fa_flight_id: z.string(),
    operator: z.string().nullable(),
    operator_icao: z.string().nullable(),
    operator_iata: z.string().nullable(),
    flight_number: z.string().nullable(),
    registration: z.string().nullable(),
    atc_ident: z.string().nullable(),
    inbound_fa_flight_id: z.string().nullable(),
    codeshares: z.array(z.string()),
    codeshares_iata: z.array(z.string()),
    blocked: z.boolean(),
    diverted: z.boolean(),
    cancelled: z.boolean(),
    position_only: z.boolean(),
    origin: flightAirportRefSchema,
    destination: flightAirportRefSchema,
    departure_delay: z.number().int().nullable(),
    arrival_delay: z.number().int().nullable(),
    filed_ete: z.number().int().nullable(),
    progress_percent: z.number().int().min(0).max(100).nullable(),
    status: z.string(),
    aircraft_type: z.string().nullable(),
    route_distance: z.number().int().nullable(),
    filed_airspeed: z.number().int().nullable(),
    filed_altitude: z.number().int().nullable(),
    route: z.string().nullable(),
    baggage_claim: z.string().nullable(),
    seats_cabin_business: z.number().int().nullable(),
    seats_cabin_coach: z.number().int().nullable(),
    seats_cabin_first: z.number().int().nullable(),
    gate_origin: z.string().nullable(),
    gate_destination: z.string().nullable(),
    terminal_origin: z.string().nullable(),
    terminal_destination: z.string().nullable(),
    type: z.enum(['General_Aviation', 'Airline']),
    scheduled_out: dateSchema.nullable(),
    estimated_out: dateSchema.nullable(),
    actual_out: dateSchema.nullable(),
    scheduled_off: dateSchema.nullable(),
    estimated_off: dateSchema.nullable(),
    actual_off: dateSchema.nullable(),
    scheduled_on: dateSchema.nullable(),
    estimated_on: dateSchema.nullable(),
    actual_on: dateSchema.nullable(),
    scheduled_in: dateSchema.nullable(),
    estimated_in: dateSchema.nullable(),
    actual_in: dateSchema.nullable(),
    foresight_predictions_available: z.boolean(),
});

export type Flight = z.infer<typeof flightSchema>;

export const flightSearchResultSchema = z.object({
    links: z.object({
        next: urlOrPathSchema,
    }).nullable(),
    num_pages: z.number().int().min(1),
    flights: z.array(flightCurrentPositionSchema),
});

// GET /flights/search
export type FlightSearchResult = z.infer<typeof flightSearchResultSchema>;

export const flightByRegistrationSchema = z.object({
    links: z.object({
        next: urlOrPathSchema,
    }).nullable(),
    num_pages: z.number().int().min(1),
    flights: z.array(flightSchema),
});

// GET /flights/{ident}
export type FlightByRegistration = z.infer<typeof flightByRegistrationSchema>;

// GET /flights/{id}/map
export const flightMapSchema = z.object({
    map: z.base64() // Ensures valid base64 format
});

export type FlightMap = z.infer<typeof flightMapSchema>;

export interface FlightMapWithID extends FlightMap {
    fa_flight_id: string;
    createdAt: z.infer<typeof dateSchema>; // Firestore server timestamp
}
