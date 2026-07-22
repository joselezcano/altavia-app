import { AirportSchema } from '@/types/all-roles';
import { z } from 'zod';


export const FlightSearchFormSchema = z.object({
    trip: z.object({
        origin_airport_ident: z.string().min(1, "Seleccione un origen"),
        origin_airport: AirportSchema.optional(),
        origin_timezone: z.string().optional(),
        destination_airport_ident: z.string().min(1, "Seleccione un destino"),
        destination_airport: AirportSchema.optional(),
        destination_timezone: z.string().optional(),
    }),
    schedule: z.object({
        roundtrip: z.boolean(),
        outbound_flight_datetime_utc: z.date("La fecha de ida es obligatoria").nullable(),
        return_flight_datetime_utc: z.date().nullable(),
    }),
    capacity: z.object({
        passangers: z.number({
            error: "Campo obligatorio"
        }).positive("Debe haber al menos un pasajero").int(),
    }),
});

export type FlightSearchForm = z.infer<typeof FlightSearchFormSchema>;


// export const FlightSearchResultSchema = z.object({
//     admin_id: z.string(),
//     request: FlightRequestFormSchema,
//     distance_km: z.number().positive(),
//     status: z.enum(['pending', 'approved', 'modified', 'cancelled']),
//     aircraft_request_id: z.string().optional(),
//     aircraft_id: z.string().optional(),
//     pilot_request_id: z.string().optional(),
//     pilot_id: z.string().optional(),
//     flight_plan_id: z.string().optional(),
// });

// export type FlightRequest = z.infer<typeof FlightRequestSchema>;

// export const FlightSearchResultSchema = z.object({
//     // Especificaciones básicas
//     aircraft: z.object({
//         // Modelo de aeronave
//         model: z.string().min(1, "El modelo de avión es obligatorio"),

//         // Capacidad de pasajeros (Pilotos + Pasajeros)
//         pax_count: z.number().nonnegative().int(),

//         // Tipo de aeronave
//         type: AircraftTypeSchema,

//         // Número de registro de la aeronave
//         registration: RegistrationSchema,

//         // Velocidad verdadera de crucero en nudos (debe ser positiva)
//         cruise_speed_knots: z.number().positive("La velocidad debe ser un número positivo"),

//         // Altitud máxima o techo de servicio en pies (número entero positivo)
//         service_ceiling_feet: z.number().int().positive("El techo de servicio debe ser un entero positivo"),
//     }),
// });
