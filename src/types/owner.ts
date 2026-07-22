import { z } from "zod";
import { AirportSchema } from "./all-roles";


/*
 * Registration
 */
// According to ICAO Annex 7, there is no single global regex or format for aircraft registration numbers (tail numbers).
// Instead, each country establishes its own unique pattern based on two combined parts: a Nationality Prefix and a Registration Suffix.
// On an ICAO flight plan (Item 7), the combined string must be alphanumeric, uppercase, and between 2 to 7 characters long without any hyphens or spaces (e.g., N123AZ, GTTIF, B1234).
export const RegistrationSchema = z
    .string()
    .toUpperCase()
    .trim()
    .regex(/^[A-Z0-9]{2,7}$/, {
        message: "El número de registro debe contener 2 a 7 caracteres alfanúmericos sin guiones o espacios"
    });


/*
 * Aircraft type
 */
// The aircraft type must be formatted as an official 2-to-4 character alphanumeric ICAO designator. 
// These codes are standardized globally and published by the International Civil Aviation Organization in ICAO Doc 8643.
// Examples: C172 — Cessna 172B738 — Boeing 737-800A320 — Airbus A320PA28 — Piper PA-28A388 — Airbus A380-800

export const AircraftTypeSchema = z
    .string()
    .toUpperCase()
    .trim()
    // Enforces ICAO Doc 8643 length limit: 2 to 4 characters, alphanumeric only
    .regex(/^[A-Z0-9]{2,4}$/, {
        message: "El tipo de aeronave debe ser una designación ICAO alfanumérica de 2 a 4 caracteres (ej. B738, C172)"
    });


/*
 * Flight Rules
 */
// I (IFR): The entire flight is intended to be operated under Instrument Flight Rules.
// V (VFR): The entire flight is intended to be operated under Visual Flight Rules.
// Y (IFR then VFR): The flight begins under IFR, followed by one or more changes to VFR.
// Z (VFR then IFR): The flight begins under VFR, followed by one or more changes to IFR.

export const FlightRulesSchema = z.enum(['IFR', 'VFR', 'Y', 'Z']);


/*
 * Wake turbulence
 */
// L (Light): Aircraft with a maximum take-off weight of 7,000 kg (15,500 lbs) or less. (e.g., Cessna 172, Piper PA-28, Cirrus SR22).
// M (Medium): Aircraft with a maximum take-off weight between 7,000 kg and 136,000 kg (15,500 lbs to 300,000 lbs). (e.g., Boeing 737, Airbus A320, Embraer 190).
// H (Heavy): Aircraft with a maximum take-off weight of 136,000 kg (300,000 lbs) or more, excluding those classified as Super. (e.g., Boeing 777, Boeing 747, Airbus A350).
// J (Super): A specific designation reserved for ultra-large aircraft. Currently, this explicitly applies to the Airbus A380-800.

export const WakeTurbulenceCategorySchema = z.enum(['L', 'M', 'H', 'J']);


/*
 * Equipment
 */
// D: DME installed
// F: ADF installed
// G: GNSS installed
// I: ILS installed
// O: Örn installed
// P: TACAN installed
// R: Radar altimeter installed
// S: S-Mode Transponder installed
// T: Transponder Mode A/C installed
// U: SSR transponder Mode S (including Mode 1, 2 and 3/A, no 4) installed
// X: Transponder Mode X installed
// Z: No ADS-B Out

export const EquipmentSchema = z.enum(['D', 'F', 'G', 'I', 'O', 'P', 'R', 'S', 'T', 'U', 'X', 'Z']);


/*
 * Transponder
 */
// A: Transponder Mode A (without Mode C)
// C: Transponder Mode A/C
// S: Mode S transponder

// Mode S transponders are classified by their ability to transmit aircraft identification (ACID), pressure altitude, and advanced data:
// S: Transmits pressure altitude and ACID.
// E: Mode S with 1090 MHz Extended Squitter (ADS-B Out).
// H: Mode S with Enhanced Surveillance.
// L: Mode S with Enhanced Surveillance and Extended Squitter (ADS-B Out).
// I: Mode S with ACID, no pressure altitude.
// P: Mode S with pressure altitude, no ACID.
// X: Mode S with neither ACID nor pressure altitude.

export const TransponderSchema = z.enum(['A', 'C', 'S', 'E', 'H', 'L', 'I', 'P', 'X']);


/*
 * Radio equipment
 */
// The specific values used to define radio communication and data link capabilities are categorized below.
// This is a string of single-letter or letter-number codes.
// Voice Communication Radios
//   V (VHF RTF): Standard Very High Frequency voice radio.
//   Y (VHF with 8.33 kHz spacing): Indicates your VHF radio supports 8.33 kHz channel spacing, which is mandatory in European airspace.
//   H (HF RTF): High Frequency voice radio, typically required for long-distance oceanic or remote flights.
//   U (UHF RTF): Ultra High Frequency voice radio, primarily used by military aircraft.
// Controller-Pilot Data Link Communications (CPDLC)
//   J1: CPDLC ATN VDL Mode 2.
//   J2: CPDLC FANS 1/A HFDL.
//   J3: CPDLC FANS 1/A VDL Mode A.
//   J4: CPDLC FANS 1/A VDL Mode 2.
//   J5: CPDLC FANS 1/A SATCOM (Inmarsat).
//   J6: CPDLC FANS 1/A SATCOM (MTSAT).
//   J7: CPDLC FANS 1/A SATCOM (Iridium).
// Satellite Voice (Satvoice)
//   M1: ATC Satvoice via Inmarsat.
//   M2: ATC Satvoice via MTSAT.
// M3: ATC Satvoice via Iridium.
// General & Shortcut Codes
// S (Standard): A powerful shortcut letter. Entering S tells ATC you have a standard suite of VHF radio (V), VOR (O), and ILS (L). If you use S, you do not need to list V, O, or L separately.
// N (Nil): Used if the aircraft has no functional communication or navigation equipment for the route.
// Z (Other): Used if you have other specialized communication capabilities not covered by the standard letters (specific details must then be clarified in Item 18)

export const RadioEquipmentEnum = z.enum([
    // General & Voice
    'N', 'S', 'V', 'Y', 'H', 'U', 'Z',
    // CPDLC Data Link
    'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7',
    // Satvoice
    'M1', 'M2', 'M3'
]);

export const RadioEquipmentArraySchema = z.array(RadioEquipmentEnum);


/*
 * Emergency Radio
 */
// Specifies the available frequencies or beacons built for emergency communication:
// U (UHF): Operational radio capability on the military distress frequency (243.0 MHz).
// V (VHF): Operational radio capability on the international civilian distress frequency (121.5 MHz).
// E (ELT): Presence of a serviceable Emergency Locator Transmitter (or Emergency Location Beacon).

export const EmergencyRadioEnum = z.enum(['U', 'V', 'E']);

export const EmergencyRadioArraySchema = z.array(EmergencyRadioEnum);


/*
 * Survival Equipment
 */
// Indicates specialized, terrain-specific survival gear kits packed on the aircraft:
// P (Polar): Gear designed for arctic, snowy, or extreme-cold environments.
// D (Desert): Gear tailored for high heat and arid conditions.
// M (Maritime): Specialized oceanic or open-water survival supplies.
// J (Jungle): Survival equipment dedicated to tropical or dense wilderness areas.

export const SurvivalEquipmentEnum = z.enum(['P', 'D', 'M', 'J']);

export const SurvivalEquipmentArraySchema = z.array(SurvivalEquipmentEnum);


/*
 * Life Jackets
 */
// Defines the capabilities of the personal flotation devices (PFDs) carried for the passengers and crew:
// L (Light): Jackets are equipped with integrated survivor locator lights.
// F (Fluorescein): Jackets include a fluorescein dye marker packets to color the water for easy aerial spotting.
// U (UHF radio): Jackets have emergency UHF radio beacons.
// V (VHF radio): Jackets have emergency VHF radio transmitters.

export const LifeJacketEnum = z.enum(['L', 'F', 'U', 'V']);

export const LifeJacketArraySchema = z.array(LifeJacketEnum);


/*
 * Dinghies Capacity
 */
// If life rafts or dinghies are carried on board:
// Number: Total quantity of rafts onboard.
// Total Capacity: Combined passenger limit across all rafts (e.g., two 6-person rafts = 12).
// Covered: True/False or Yes/No indicating if the rafts have built-in weather canopies.
// Color: The high-visibility color of the raft fabric (commonly ORANGE or YELLOW)

export const DinghiesCapacitySchema = z.object({
    carried: z.boolean(),
    number: z.number().int().nonnegative().optional(),
    total_capacity: z.number().int().nonnegative().optional(),
    covered: z.boolean().optional(),
    color: z.string().toUpperCase().optional(),
}).refine((data) => !data.carried || (data.number !== undefined && data.total_capacity !== undefined), {
    message: "El número y la capacidad total son obligatorios si se llevan balsas",
    path: ["number"]
});


// Declaración del esquema de validación con Zod para especificaciones de aeronaves
export const AircraftSpecsSchema = z.object({
    // Especificaciones básicas
    basic_specs: z.object({
        // Modelo de aeronave
        model: z.string().min(1, "El modelo de avión es obligatorio"),

        // Tipo de aeronave
        type: AircraftTypeSchema,

        // Número de registro de la aeronave
        registration: RegistrationSchema,

        // Capacidad de pasajeros (Pilotos + Pasajeros)
        pax_count: z.number().nonnegative().int(),
    }),

    // Especificaciones técnicas
    technical_specs: z.object({
        // Tipo de equipo de radio comunicación
        equipment: z.array(EquipmentSchema),

        // Tipo de transponder
        transponder: TransponderSchema,

        // Reglas de vuelo permitidas
        flight_rules: FlightRulesSchema,

        // Categorías estándar de la OACI para estela turbulenta
        wake_turbulence_category: WakeTurbulenceCategorySchema,

        // Capacidad total de combustible usable en galones
        fuel_capacity_gallons: z.number().positive("La capacidad de combustible debe ser positiva"),
    }),

    // Especificaciones de operación
    operating_specs: z.object({
        // Velocidad verdadera de crucero en nudos (debe ser positiva)
        cruise_speed_knots: z.number().positive("La velocidad debe ser un número positivo"),

        // Consumo de combustible por hora (galones por Hora)
        fuel_burn_rate_gph: z.number().positive("El régimen de consumo debe ser positivo"),

        // Altitud máxima o techo de servicio en pies (número entero positivo)
        service_ceiling_feet: z.number().int().positive("El techo de servicio debe ser un entero positivo"),

        // Peso máximo al despegue en libras
        max_takeoff_weight_lbs: z.number().positive("El peso máximo de despegue debe ser positivo"),

        // Distancia mínima de carrera de despegue requerida en pies
        takeoff_distance_feet: z.number().int().positive("La distancia de despegue debe ser un entero positivo"),

        // Distancia de aterrizaje requerida en pies
        landing_distance_feet: z.number().int().positive("La distancia de aterrizaje debe ser un entero positivo"),

        // Régimen o tasa de ascenso en pies por minuto
        rate_of_climb_fpm: z.number().int().nonnegative("El régimen de ascenso no puede ser negativo"),
    }),

    // Equipo de emergencia
    emergency: z.object({
        // Equipo de radio comunicación
        radio_equipment: RadioEquipmentArraySchema,

        // Equipo de supervivencia
        survival_equipment: SurvivalEquipmentArraySchema,

        // Chalecos salvavidas
        life_jacket_equipment: LifeJacketArraySchema,

        // Capacidad de balsas salvavidas
        dinghies_capacity: DinghiesCapacitySchema,
    }),

    // Aeropuerto base / de origen de la aeronave
    base_airport: AirportSchema.optional(),

    // Observaciones
    notes: z.string().optional(),
});

// Extracción del tipo de TypeScript basado en el esquema de Zod
export type AircraftSpecs = z.infer<typeof AircraftSpecsSchema>;


// Default values matching the Zod schema structure for AircraftSpecs
export const defaultAircraftSpecs: AircraftSpecs = {
    basic_specs: {
        model: "Cessna 172 Skyhawk",
        type: "C172",
        registration: "ZP1234",
        pax_count: 10,
    },
    technical_specs: {
        equipment: ["S", "D", "G"],
        transponder: "S",
        flight_rules: "IFR",
        wake_turbulence_category: "M",
        fuel_capacity_gallons: 56,
    },
    operating_specs: {
        cruise_speed_knots: 124,
        fuel_burn_rate_gph: 8.5,
        service_ceiling_feet: 14000,
        max_takeoff_weight_lbs: 2550,
        takeoff_distance_feet: 1630,
        landing_distance_feet: 1335,
        rate_of_climb_fpm: 730,
    },
    emergency: {
        radio_equipment: ["V", "U"],
        survival_equipment: ["J"],
        life_jacket_equipment: ["L"],
        dinghies_capacity: {
            carried: true,
            number: 1,
            total_capacity: 4,
            covered: false,
            color: "YELLOW",
        },
    },
    notes: ""
};