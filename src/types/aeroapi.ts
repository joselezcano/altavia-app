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

const flightAirportRefSchema = z.object({
    code: z.string().nullable(),
    code_icao: z.string().nullable(),
    code_iata: z.string().nullable(),
    code_lid: z.string().nullable(),
    timezone: z.string().nullable(),
    name: z.string().nullable(),
    city: z.string().nullable(),
    airport_info_url: urlOrPathSchema,
});

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

export const flightSearchResultSchema = z.object({
    links: z.object({
        next: urlOrPathSchema,
    }).nullable(),
    num_pages: z.number().int().min(1),
    flights: z.array(flightCurrentPositionSchema),
});

// GET /flights/{id}/map
export type FlightSearchResult = z.infer<typeof flightSearchResultSchema>;

export const flightMapSchema = z.object({
    map: z.base64() // Ensures valid base64 format
});

export type FlightMap = z.infer<typeof flightMapSchema>;

export interface FlightMapWithID extends FlightMap {
    fa_flight_id: string;
    createdAt: z.infer<typeof dateSchema>; // Firestore server timestamp
}