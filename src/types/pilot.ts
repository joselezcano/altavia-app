import { z } from 'zod';
import { dateSchema } from './all-roles';


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


export const pilotProfileSchema = z.object({
    user: z.object({
        uid: z.string(),                // Id de usuario de la aplicación
        email: z.string(),              // Email del usuario
        firstName: z.string(),          // podría no ser igual al documento de identidad
        lastName: z.string(),           // podría no ser igual al documento de identidad
    }).optional(),
    basic: z.object({
        id_first_name: z.string(),      // Nombres como figura en el documento
        id_last_name: z.string(),       //Apellidos como figura en el documento
        id_type: z.enum([
            'Documento de Identidad',
            'Pasaporte'
        ]),                             // Tipo de documento
        id_number: z.string(),          // Número de documento
        id_country: z.string(),         // País de expedición del documento
        id_nationality: z.string(),     // Nacionalidad según el documento
        id_date_of_birth: dateSchema,   // Fecha de nacimiento
        telephone: z.string(),          // Teléfono
    }),
    // Basado en https://www.dinac.gov.py/Seguridad_Operacional/docs/DINAC_R61_Enmienda5-Res_1294-2022.pdf
    aeronautical: z.object({
        pilot_licence: z.string(),      // Número de licencia
        licence_type: z.enum([
            "Alumno Piloto",
            "Piloto privado",
            "Piloto comercial",
            "Piloto con tripulación múltiple – avión",
            "Piloto de Transporte de Línea Aérea (PTLA)",
            "Piloto de Planeador"
        ]), // Tipos de licencia
        licence_permits: z.string(),    // Habilitaciones
        licence_issuer: z.string(),     // Emisor de la licencia
    }),
    other_information: z.object({
        aeronautical_medical_certificate: z.enum([
            'Clase 1',
            'Clase 2',
            'Clase 3'
        ]),                             // Evaluaciones Médicas
        languages: z.array(z.enum([
            'es', 'en', 'pt', 'others'
        ])),                             // Idiomas: 'Español', 'Inglés', 'Portugués', 'Otros'
        flight_hours: z.number().positive().int().optional(), // Total de horas voladas
    }),
    owner_ids: z.array(z.string()),                 // El piloto puede volar para estos propietarios
    isEncargado: z.boolean(),                       // Indicador de encargado
    managed_aircrafts: z.array(z.string()),         // Ids de aeronaves que puede gestionar
    pilot_aircrafts: z.array(z.string()),           // Ids de aeronaves que puede pilotar
    accepted_terms_version: z.string().optional(), // Versión de los términos y condiciones aceptadas
    updated_at: dateSchema,
});

export type PilotProfile = z.infer<typeof pilotProfileSchema>;

export interface AssignPilotsSearchParams {
    id: string;
    model?: string;
    registration?: string;
}

export interface PilotDetailsSearchParams {
    pilotUid: string;
    from?: string;
}