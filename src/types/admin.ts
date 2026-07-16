import { z } from 'zod';


export const FlightRequestFormSchema = z.object({
    trip: z.object({
        origin_airport_ident: z.string(),
        destination_airport_ident: z.string(),
        passangers: z.number().positive().int(),
    }),
    schedule: z.object({
        departure_datetime_utc: z.union([z.date("La fecha de salida es obligatoria"), z.undefined()]),
        arrival_datetime_utc: z.date().optional(),
    }),
    financials: z.object({
        ticket_initial_price: z.number().positive("Debe ser mayor a cero"),
        ticket_final_price: z.number().positive().optional(),
        ticket_price_change_period_days: z.number().positive().int().optional(),
        flight_budget: z.number().positive().optional(),
    }),
    // refine should return a falsy value to signal failure
}).refine((data) => !!data.financials.ticket_final_price === !!data.financials.ticket_price_change_period_days, {
    message: "El precio final del ticket y su periodo de cambio deben especificarse juntos",
    path: ["financials.ticket_price_change_period_days"]
});

export type FlightRequestForm = z.infer<typeof FlightRequestFormSchema>;


export const FlightRequestSchema = z.object({
    admin_id: z.string(),
    request: FlightRequestFormSchema,
    distance_km: z.number().positive(),
    status: z.enum(['pending', 'approved', 'modified', 'cancelled']),
    aircraft_request_id: z.string().optional(),
    aircraft_id: z.string().optional(),
    pilot_request_id: z.string().optional(),
    pilot_id: z.string().optional(),
    flight_plan_id: z.string().optional(),
});

export type FlightRequest = z.infer<typeof FlightRequestSchema>;