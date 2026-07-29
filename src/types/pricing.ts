import { z } from "zod";

export const ModelPricingSchema = z.object({
  model: z.string().min(1, "El modelo es obligatorio"), // ej. "C172"
  defaultPricePerMile: z.number().nonnegative("La tarifa debe ser un número positivo"),
  updatedAt: z.any().optional(),
});

export type ModelPricing = z.infer<typeof ModelPricingSchema>;
