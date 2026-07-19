import { AirportSchema } from '@/types/all-roles';
import { z } from 'zod';


export const FlightRequestFormSchema = z.object({
    trip: z.object({
        origin_airport_ident: z.string().min(1, "Seleccione un origen"),
        origin_airport: AirportSchema.optional(),
        origin_timezone: z.string().optional(),
        destination_airport_ident: z.string().min(1, "Seleccione un destino"),
        destination_airport: AirportSchema.optional(),
        destination_timezone: z.string().optional(),
        passangers: z.number({
            error: "Campo obligatorio"
        }).positive("Debe haber al menos un pasajero").int(),
    }),
    schedule: z.object({
        departure_datetime_utc: z.date("La fecha de salida es obligatoria").nullable(),
        arrival_datetime_utc: z.date().nullable(),
    }),
    financials: z.object({
        ticket_initial_price: z.number().positive("Debe ser mayor a cero"),
        ticket_final_price: z.number().positive().nullable(),
        ticket_price_change_period_days: z.number().positive().int().nullable(),
        flight_budget: z.number().positive().nullable(),
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