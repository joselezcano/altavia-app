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
