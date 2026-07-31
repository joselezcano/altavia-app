import { z } from 'zod';
import { dateSchema } from './all-roles';
import {
    AircraftTypeSchema,
    DinghiesCapacitySchema,
    EmergencyRadioArraySchema,
    EquipmentArraySchema,
    FlightRulesSchema,
    LifeJacketArraySchema,
    RegistrationSchema,
    SurvivalEquipmentArraySchema,
    TransponderSchema,
    WakeTurbulenceCategorySchema,
} from './owner';


/*
 * Flight Types:
 */
// S (Scheduled Air Service): Used by commercial airlines flying regular, publicly listed timetables.
// N (Non-Scheduled Air Transport): Used for commercial charter flights, air taxis, and cargo flights that do not have a regular schedule.
// G (General Aviation): Used for personal flying, business jets, flight training, and recreational trips. (This is the code you will use for your flight from SGAS to SGES).
// M (Military): Used for flights operated by official military aircraft and air forces.
// X (Other): Used for special categories that do not fit the others, such as search and rescue, police flights, or hospital/medevac flights.

export const FlightTypesSchema = z.enum(['S', 'N', 'G', 'M', 'X']);


export const flightPlanSchema = z.object({
    flight_plan: z.object({
        aircraft: z.object({
            registration: RegistrationSchema,
            type: AircraftTypeSchema,
            wake_turbulence: WakeTurbulenceCategorySchema,
            equipment: EquipmentArraySchema,
            transponder: TransponderSchema,
        }),
        flight_details: z.object({
            // A call sign is a unique alphanumeric code used by pilots and air traffic control (ATC) to identify and talk to an aircraft during communication and on radar screens.
            // Types of Call Signs:
            // * Aircraft Registration (Tail Number): Commonly used in general aviation. It uses the aircraft's physical registration code (e.g., N12345 or G-ABCD), spoken using the ICAO phonetic alphabet. Hyphens are omitted when filing.
            // * Airline Code and Flight Number: Commonly used by commercial airlines. It combines a three-letter ICAO airline designator with the flight identification number (e.g., BAW29G for British Airways, spoken as "Speedbird").
            // * Special/Company Designators: Used by specific corporate operators, charter networks, or military flights authorized by aviation authorities.
            callsign: z.string().toUpperCase().regex(/^[A-Z0-9]{1,7}$/, "Ingrese un código alfanumérico"),
            flight_rules: FlightRulesSchema,
            flight_type: FlightTypesSchema,
        }),
        departure: z.object({
            icao: z.string().min(4, "Requerido"),
            datetime_utc: z.iso.datetime("Fecha y hora deben estar en formato ISO"),
            // The Estimated Off-Block Time (EOBT) is the exact time your aircraft is expected to begin moving to start its flight. [1] 
            // ## Key Rules for EOBT
            // * The "Block" Definition: It refers to the moment the wheel chocks (blocks) are pulled away from the tires, not when the tires leave the runway.
            // * Universal Time (UTC): You must always enter this time in Coordinated Universal Time (UTC/Z), never in local time.
            // * Four-Digit Format: Enter it as a 4-digit number specifying hours and minutes (e.g., 2:30 PM UTC is entered as 1430).
            off_block_time: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3])[0-5][0-9]$/, "Formato inválido. Debe ser HHMM"),
        }),
        arrival: z.object({
            icao: z.string().min(4, "Requerido"),
            datetime_utc: z.iso.datetime("Fecha y hora deben estar en formato ISO"),
            alternate_icao: z.string(),
        }),
        route: z.object({
            cruising_speed_knots: z.number().positive("Debe ser mayor a cero").int(),
            cruising_altitude_feet: z.number().positive("Debe ser mayor a cero").int(),
            waypoints: z.array(z.string().min(4)),
            encoded_route: z.array(z.string().min(4)).nonempty("Debe incluir al menos origen y destino"),
        }),
        performance: z.object({
            // The EET field tells Air Traffic Control exactly how long your aircraft will be in the air from the moment wheels leave the ground to the moment you land.
            eet_hours: z.number().nonnegative().int(),
            eet_minutes: z.number().min(0).max(59, "Máximo 59").int(),
            // The Fuel Time field tells rescuers how long your engines can run before running completely out of gas based on the fuel onboard at takeoff.
            fuel_hours: z.number().nonnegative().int(),
            fuel_minutes: z.number().min(0).max(59, "Máximo 59").int(),
        }).refine((data) => (data.eet_hours * 60 + data.eet_minutes > 0), {
            message: "La duración del vuelo debe ser mayor a cero",
            path: ["eet_hours"]
        }).refine((data) => (data.fuel_hours * 60 + data.fuel_minutes > 0), {
            message: "La duración del combustible debe ser mayor a cero",
            path: ["fuel_hours"]
        }),
        emergency: z.object({
            pax_count: z.number().positive("Debe ser mayor a cero").int(),
            radio_equipment: EmergencyRadioArraySchema,
            survival_equipment: SurvivalEquipmentArraySchema,
            life_jacket_equipment: LifeJacketArraySchema,
            dinghies_capacity: DinghiesCapacitySchema,
        }),
        pilot: z.object({
            name: z.string().min(1, "Requerido"),
            contact_info: z.string().min(1, "Requerido"),
            observations: z.string(),
        }),
    }),
    aircraft_reservation_id: z.string().optional(),
    updated_at: dateSchema.optional(),
});

import type { Airport, ClientReservationItem } from './all-roles';
import type { AircraftSpecs } from './owner';

// Extract TypeScript type from the schema
export type FlightPlan = z.infer<typeof flightPlanSchema>;

export interface FlightPlanDoc extends FlightPlan {
    id: string;
    pilot_id: string;
    status: "New" | "Updated" | "Approved";
    created_at: z.infer<typeof dateSchema>;
}


export interface PilotFlightLeg {
    id: string;
    reservationId: string;
    legType: 'outbound' | 'return';
    originIdent: string;
    destinationIdent: string;
    departureTime: Date;
    arrivalTime?: Date | null;
    aircraftId: string;
    aircraftSpecs?: AircraftSpecs;
    originAirport?: Airport;
    destinationAirport?: Airport;
    paxCount: number;
    reservationDoc: ClientReservationItem;
}



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