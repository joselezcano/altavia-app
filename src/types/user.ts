import { z } from "zod";
import { KycDataSchema } from "./kyc";

// Base User Schema (Common to all roles, stored in 'users' collection)
export type PersonType = "individual" | "company";
export type NationalityType = "paraguayan" | "foreign";
export type DocumentType = "CI" | "PASSPORT" | "DNI";

export const REFERRAL_SOURCES = [
  { id: "friend_recommendation", label: "Recomendación de un conocido o cliente" },
  { id: "pilot_or_owner", label: "Piloto o Propietario de aeronave" },
  { id: "social_media", label: "Redes Sociales (Instagram / TikTok)" },
  { id: "google_press", label: "Búsqueda en Google / Prensa" },
  { id: "other", label: "Otro medio" },
] as const;

export type ReferralSourceId = (typeof REFERRAL_SOURCES)[number]["id"];

export const BaseUserSchema = z.object({
  uid: z.string(),
  email: z.string().email("Correo electrónico inválido"),
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "El apellido es obligatorio"),
  roles: z.array(z.enum(["ADMIN", "CLIENT", "PILOT", "OWNER"])),
  personType: z.enum(["individual", "company"]).optional(),
  phone: z.string().optional(),
  profileCompleted: z.boolean().optional(),
  referralSource: z.string().optional(),
  termsAcceptedAt: z.any().optional(),
  termsVersion: z.string().optional(),
  
  // Specific to individual
  nationalityType: z.enum(["paraguayan", "foreign"]).optional(),
  documentType: z.enum(["CI", "PASSPORT", "DNI"]).optional(),
  documentNumber: z.string().optional(),

  // Specific to company
  businessName: z.string().optional(),
  taxId: z.string().optional(),
  representativeName: z.string().optional(),
  representativeDoc: z.string().optional(),

  // Deletion / Anonymization flag (DINAC compliance)
  deleted: z.boolean().optional(),
  deletedAt: z.any().optional(),

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
  taxId: z.string().optional(),
  personType: z.enum(["individual", "company"]).optional(),
  deleted: z.boolean().optional(),
});

export type OwnerProfile = z.infer<typeof OwnerProfileSchema>;

// Client Profile Schema (Stored in 'clients' collection)
export const ClientProfileSchema = z.object({
  uid: z.string(),
  personType: z.enum(["individual", "company"]).optional(),
  acceptedTermsVersion: z.string().optional(),
  referralSource: z.string().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
  deleted: z.boolean().optional(),
});

export type ClientProfile = z.infer<typeof ClientProfileSchema>;

// Admin Profile Schema (Stored in 'admin-users' collection)
export const AdminProfileSchema = z.object({
  uid: z.string(),
  permissions: z.array(z.string()).default([]),
});

export type AdminProfile = z.infer<typeof AdminProfileSchema>;

// Client Registration Form Schema (Legacy / Fallback)
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

// Dynamic Onboarding Step 2: Individual
export const IndividualOnboardingSchema = z.object({
  firstName: z.string().min(2, "El nombre es obligatorio"),
  lastName: z.string().min(2, "El apellido es obligatorio"),
  nationalityType: z.enum(["paraguayan", "foreign"]),
  documentType: z.enum(["CI", "PASSPORT", "DNI"]),
  documentNumber: z.string().min(3, "El número de documento es obligatorio"),
  phone: z.string().min(6, "El número de teléfono es obligatorio"),
});

export type IndividualOnboardingForm = z.infer<typeof IndividualOnboardingSchema>;

// Dynamic Onboarding Step 2: Company
export const CompanyOnboardingSchema = z.object({
  businessName: z.string().min(2, "La razón social es obligatoria"),
  taxId: z.string().min(5, "El RUC o ID fiscal es obligatorio"),
  representativeName: z.string().min(2, "El nombre del representante legal es obligatorio"),
  representativeDoc: z.string().min(3, "El documento del representante es obligatorio"),
  phone: z.string().min(6, "El teléfono de contacto de la empresa es obligatorio"),
});

export type CompanyOnboardingForm = z.infer<typeof CompanyOnboardingSchema>;


/** Resultado de la Cloud Function claimPreRegisteredProfile (unión de perfil precargado). */
export interface ClaimProfileResult {
  claimed: boolean;
  mergedProfiles: number;
  movedReservations: number;
}
