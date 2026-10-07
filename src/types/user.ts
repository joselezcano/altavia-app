import { z } from "zod";
import { KycDataSchema } from "./kyc";

// Base User Schema (Common to all roles, stored in 'users' collection)
export const BaseUserSchema = z.object({
  uid: z.string(),
  email: z.string().email("Correo electrónico inválido"),
  firstName: z.string().min(1, "El nombre es obligatorio"), // podría no ser igual al documento de identidad
  lastName: z.string().min(1, "El apellido es obligatorio"), // podría no ser igual al documento de identidad
  roles: z.array(z.enum(["ADMIN", "CLIENT", "PILOT", "OWNER"])),
  kycVerified: z.boolean().optional(),
  kycData: KycDataSchema.optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type BaseUser = z.infer<typeof BaseUserSchema>;

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

// Client Registration Form Schema
export const RegisterClientSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "El apellido es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme su contraseña"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type RegisterClientForm = z.infer<typeof RegisterClientSchema>;
