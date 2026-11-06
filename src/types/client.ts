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
        outbound_flight_datetime_utc: z.date().nullable(),
        return_flight_datetime_utc: z.date().nullable(),
    }),
    capacity: z.object({
        passangers: z.number().positive("Debe haber al menos un pasajero").int(),
    }),
});

export type FlightSearchForm = z.infer<typeof FlightSearchFormSchema>;

export const QuickClientFormSchema = z.object({
    firstName: z.string().min(1, "El nombre es obligatorio"),
    lastName: z.string().min(1, "El apellido es obligatorio"),
    email: z.string().email("Correo electrónico inválido"),
    phone: z.string().min(6, "Teléfono o WhatsApp obligatorio"),
    documentNumber: z.string().min(3, "C.I. o RUC obligatorio"),
    personType: z.enum(["individual", "company"]).default("individual"),
    businessName: z.string().optional(),
});

export type QuickClientForm = z.infer<typeof QuickClientFormSchema>;

export const ConciergeBookingSchema = z.object({
    clientId: z.string().min(1, "Seleccione o cree un cliente"),
    aircraftId: z.string().min(1, "Seleccione una aeronave"),
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
        outbound_flight_datetime_utc: z.date(),
        return_flight_datetime_utc: z.date().nullable(),
    }),
    capacity: z.object({
        passangers: z.number().positive("Debe haber al menos 1 pasajero").int(),
    }),
    price: z.number().positive("El precio debe ser mayor a 0"),
    notes: z.string().optional(),
});

export type ConciergeBookingForm = z.infer<typeof ConciergeBookingSchema>;
