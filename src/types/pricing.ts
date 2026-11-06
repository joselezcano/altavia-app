import { z } from "zod";

export const ModelPricingSchema = z.object({
  model: z.string().min(1, "El modelo es obligatorio"), // ej. "C172"
  defaultPricePerMile: z.number().nonnegative("La tarifa debe ser un número positivo"),
  updatedAt: z.any().optional(),
});

export type ModelPricing = z.infer<typeof ModelPricingSchema>;

/**
 * Tarifa por hora de una aeronave (IVA incluido). La escribe SOLO el servidor
 * (Cloud Function syncAircraftPricing) a partir de los Ajustes de GIO
 * (owner_aircraft_operations_config), para que el buscador del cliente pueda leerla.
 */
export const AircraftPricingSchema = z.object({
  pricePerHourUsd: z.number().nonnegative(),
  overnightFeeUsd: z.number().nonnegative(),
  hangarPerNightUsd: z.number().nonnegative(),
  /** Factor de bloque: horas Hobbs / horas en línea recta (rodaje, ascenso, desvíos). Ej. 1.12 */
  blockFactor: z.number().positive().optional(),
  updatedAt: z.any().optional(),
});

export type AircraftPricing = z.infer<typeof AircraftPricingSchema>;

/** Un tramo de la cotización (incluye reposicionamientos en vacío). */
export interface FlightQuoteLeg {
  from: string; // ident OACI
  to: string;
  distanceNm: number;
  hours: number;
  kind: "positioning" | "passenger" | "return_empty";
}

/** Cotización por hora de vuelo: horas facturables × tarifa + pernoctes. Todo en USD, IVA incluido. */
export interface FlightQuote {
  legs: FlightQuoteLeg[];
  billableHours: number;
  /** Factor aplicado a las horas en línea recta (1 = sin ajuste). */
  blockFactor: number;
  pricePerHourUsd: number;
  flightTotalUsd: number;
  nights: number;
  overnightFeeUsd: number;
  hangarPerNightUsd: number;
  overnightTotalUsd: number;
  totalUsd: number;
  /** false si la aeronave todavía no tiene tarifa por hora cargada. */
  hasPricing: boolean;
}
