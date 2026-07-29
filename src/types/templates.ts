import { z } from "zod";
import {
  AircraftTypeSchema,
  EquipmentSchema,
  TransponderSchema,
  FlightRulesSchema,
  WakeTurbulenceCategorySchema,
  EmergencyRadioArraySchema,
  SurvivalEquipmentArraySchema,
  LifeJacketArraySchema,
  DinghiesCapacitySchema,
} from "@/types/owner";

export const AircraftTemplateSchema = z.object({
  // Basic Template Info
  template_info: z.object({
    name: z.string().min(1, "El nombre de la plantilla es obligatorio"),
    type: AircraftTypeSchema,
    model: z.string().min(1, "El modelo base es obligatorio"),
    default_pax_count: z.number().int().nonnegative(),
  }),

  // Same technical specs as AircraftSpecs
  technical_specs: z.object({
    equipment: z.array(EquipmentSchema),
    transponder: TransponderSchema,
    flight_rules: FlightRulesSchema,
    wake_turbulence_category: WakeTurbulenceCategorySchema,
    fuel_capacity_gallons: z.number().positive(),
  }),

  // Same operating specs as AircraftSpecs
  operating_specs: z.object({
    cruise_speed_knots: z.number().positive(),
    fuel_burn_rate_gph: z.number().positive(),
    service_ceiling_feet: z.number().int().positive(),
    max_takeoff_weight_lbs: z.number().positive(),
    takeoff_distance_feet: z.number().int().positive(),
    landing_distance_feet: z.number().int().positive(),
    rate_of_climb_fpm: z.number().int().nonnegative(),
  }),

  // Same emergency specs as AircraftSpecs
  emergency: z.object({
    radio_equipment: EmergencyRadioArraySchema,
    survival_equipment: SurvivalEquipmentArraySchema,
    life_jacket_equipment: LifeJacketArraySchema,
    dinghies_capacity: DinghiesCapacitySchema,
  }),
});

export type AircraftTemplate = z.infer<typeof AircraftTemplateSchema>;
