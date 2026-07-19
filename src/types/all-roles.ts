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