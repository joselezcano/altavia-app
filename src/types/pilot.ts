import { z } from 'zod';

export const flightPlanSchema = z.object({
    flight_plan: z.object({
        aircraft: z.object({
            registration: z.string().min(1).max(7),
            type: z.string().min(2).max(4),
            wake_turbulence: z.enum(['L', 'M', 'H', 'J']),
            equipment: z.array(z.string().length(1)),
            transponder: z.string().length(1),
        }),
        flight_details: z.object({
            callsign: z.string().min(1).max(7),
            flight_rules: z.enum(['IFR', 'VFR', 'Y', 'Z']),
            flight_type: z.enum(['S', 'N', 'G', 'M', 'X']),
        }),
        departure: z.object({
            icao: z.string().length(4),
            datetime_utc: z.string().datetime(),
            off_block_time: z.string().regex(/^\d{4}$/, "Must be HHMM format"),
        }),
        arrival: z.object({
            icao: z.string().length(4),
            datetime_utc: z.string().datetime(),
            alternate_icao: z.string().length(4).optional(),
        }),
        route: z.object({
            cruising_speed_knots: z.number().positive().int(),
            cruising_altitude_feet: z.number().positive().int(),
            waypoints: z.array(z.string().min(1)),
            encoded_route: z.string().min(1),
        }),
        performance: z.object({
            eet_hours: z.number().nonnegative().int(),
            eet_minutes: z.number().min(0).max(59).int(),
            fuel_hours: z.number().nonnegative().int(),
            fuel_minutes: z.number().min(0).max(59).int(),
        }),
        emergency: z.object({
            pax_count: z.number().nonnegative().int(),
            radio_equipment: z.array(z.string().length(1)),
            survival_equipment: z.array(z.string().length(1)),
            life_jacket_equipment: z.array(z.string().length(1)),
            dinghies_capacity: z.string().optional(),
        }),
        pilot: z.object({
            name: z.string().min(1),
            contact_info: z.string().min(1),
        }),
    }),
});

// Extract TypeScript type from the schema
export type FlightPlan = z.infer<typeof flightPlanSchema>;
