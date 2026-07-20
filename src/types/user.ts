import { z } from "zod";

// Base User Schema (Common to all roles, stored in 'users' collection)
export const BaseUserSchema = z.object({
  uid: z.string(),
  email: z.string().email("Correo electrónico inválido"),
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "El apellido es obligatorio"),
  roles: z.array(z.enum(["ADMIN", "CLIENT", "PILOT", "OWNER"])),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type BaseUser = z.infer<typeof BaseUserSchema>;

// Pilot Profile Schema (Stored in 'pilots' collection)
export const PilotProfileSchema = z.object({
  uid: z.string(),
  ownerId: z.string().nullable().optional(),
  isEncargado: z.boolean().default(false),
  managed_aircrafts: z.array(z.string()).default([]),
});

export type PilotProfile = z.infer<typeof PilotProfileSchema>;

// Owner Profile Schema (Stored in 'owners' collection)
export const OwnerProfileSchema = z.object({
  uid: z.string(),
  companyName: z.string().optional(),
});

export type OwnerProfile = z.infer<typeof OwnerProfileSchema>;

// Client Profile Schema (Stored in 'clients' collection)
export const ClientProfileSchema = z.object({
  uid: z.string(),
  acceptedTermsVersion: z.string().optional(),
});

export type ClientProfile = z.infer<typeof ClientProfileSchema>;

// Admin Profile Schema (Stored in 'admin-users' collection)
export const AdminProfileSchema = z.object({
  uid: z.string(),
  permissions: z.array(z.string()).default([]),
});

export type AdminProfile = z.infer<typeof AdminProfileSchema>;
