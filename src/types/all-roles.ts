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
});

export type AircraftAvailability = z.infer<typeof AircraftAvailabilitySchema>;