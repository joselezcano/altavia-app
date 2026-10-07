import { z } from "zod";

// Verification status returned by Didit or stored in Firestore
export type KycVerificationStatus = "pending" | "approved" | "declined" | "expired" | "resubmitted";

// Structured data for verified KYC information stored in Firestore under 'users/{uid}'
export const KycDataSchema = z.object({
  documentType: z.string().optional(),
  country: z.string().optional(),
  verifiedAt: z.string(),
  provider: z.string().default("didit.me"),
  session_id: z.string().optional(),
  status: z.enum(["pending", "approved", "declined", "expired", "resubmitted"]).optional(),
  rawPayload: z.any().optional(),
});

export type KycData = z.infer<typeof KycDataSchema>;

// Response type returned by the startKycSession Cloud Function
export interface StartKycSessionResponse {
  success: boolean;
  url?: string;
  sessionToken?: string;
  sessionId?: string;
  error?: string;
}

// Internal response from Didit OAuth token API (POST /auth/token/)
export interface DiditAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Internal response from Didit V3 Create Session API (POST /v3/session/)
export interface DiditCreateSessionResponse {
  session_id: string;
  url: string;
  session_token: string;
}

// Webhook payload sent by Didit to the diditWebhook HTTP Endpoint
export interface DiditWebhookPayload {
  session_id: string;
  vendor_data: string; // Firebase UID
  status: "Approved" | "Declined" | "In Review" | "Resubmission Requested";
  created_at?: string;
  workflow_id?: string;
  decision?: {
    status: string;
    details?: any;
  };
}
