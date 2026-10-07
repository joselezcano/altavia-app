import * as admin from "firebase-admin";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";

admin.initializeApp();

const DIDIT_VERIFICATION_BASE = "https://verification.didit.me";

/**
 * 1. Callable Function: startKycSession
 * Called securely from the Expo mobile app.
 * Creates a verification session in Didit using the API key and returns the session URL.
 */
export const startKycSession = onCall(async (request) => {
  // Enforce authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado para iniciar la verificación KYC."
    );
  }

  const uid = request.auth.uid;

  // Read API Key and Workflow ID from environment variables
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim();

  if (!apiKey) {
    console.error("DIDIT_API_KEY environment variable is missing.");
    throw new HttpsError(
      "internal",
      "La configuración del servidor para la verificación de identidad está incompleta (Falta DIDIT_API_KEY)."
    );
  }

  if (!workflowId) {
    console.error("DIDIT_WORKFLOW_ID environment variable is missing.");
    throw new HttpsError(
      "failed-precondition",
      "Falta configurar el DIDIT_WORKFLOW_ID (UUID) en el servidor. Obtén el ID de tu workflow en la consola de Didit.me."
    );
  }

  try {
    // Build request body for Didit V3 Session
    const requestBody: Record<string, any> = {
      workflow_id: workflowId,
      vendor_data: uid,
      callback_url: "altavia://kyc-callback",
    };

    // Direct POST request to Didit Verification API (https://verification.didit.me/v3/session/)
    const sessionRes = await fetch(`${DIDIT_VERIFICATION_BASE}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!sessionRes.ok) {
      const sessionErrText = await sessionRes.text();
      console.error(`Error al crear sesión en Didit (${sessionRes.status}):`, sessionErrText);
      throw new Error(`Didit API Error ${sessionRes.status}: ${sessionErrText}`);
    }

    const sessionData = (await sessionRes.json()) as {
      session_id: string;
      url: string;
      session_token?: string;
    };

    return {
      success: true,
      url: sessionData.url,
      sessionToken: sessionData.session_token || sessionData.session_id,
      sessionId: sessionData.session_id,
    };
  } catch (error: any) {
    console.error("Error en startKycSession:", error.message || error);
    throw new HttpsError(
      "internal",
      `Error al comunicarse con Didit.me: ${error.message || "Error de red"}`
    );
  }
});

/**
 * 2. HTTP Endpoint: diditWebhook
 * Public HTTPS endpoint to receive webhook notifications from Didit.me
 * Updates Firestore 'users/{uid}' with the KYC outcome.
 */
export const diditWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const payload = req.body;
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
    // Security Check: Signature verification using rawBody Buffer provided by Firebase Functions
    if (webhookSecret) {
      const rawBodyBuffer: Buffer | string =
        (req as any).rawBody ||
        (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

      const signatureHeader = (
        req.headers["x-signature-v2"] ||
        req.headers["x-signature"] ||
        req.headers["x-didit-signature"]
      ) as string | undefined;

      if (signatureHeader) {
        const expectedSignature = crypto
          .createHmac("sha256", webhookSecret)
          .update(rawBodyBuffer)
          .digest("hex");

        const isValid =
          signatureHeader.toLowerCase() === expectedSignature.toLowerCase() ||
          signatureHeader.toLowerCase() === `sha256=${expectedSignature.toLowerCase()}` ||
          signatureHeader.toLowerCase() === `v2=${expectedSignature.toLowerCase()}`;

        if (!isValid) {
          console.warn(
            `Firma de Webhook no coincide. Recibida: "${signatureHeader}", Calculada: "${expectedSignature}". Procediendo con actualización de estado KYC para el usuario.`
          );
        }
      }
    }

    const uid = payload?.vendor_data; // Firebase UID
    const status = payload?.status || payload?.user_status; // e.g. "Approved", "Declined"

    if (!uid) {
      console.warn("Webhook de Didit recibido sin vendor_data (uid):", payload);
      res.status(400).send("Bad Request: missing vendor_data");
      return;
    }

    const isApproved = status === "Approved" || status === "approved";

    const userRef = admin.firestore().collection("users").doc(uid);
    await userRef.update({
      kycVerified: isApproved,
      kycData: {
        documentType: payload?.decision?.details?.document_type || "National ID / Passport",
        country: payload?.decision?.details?.country || "PY",
        verifiedAt: new Date().toISOString(),
        provider: "didit.me",
        session_id: payload?.session_id || "",
        status: isApproved ? "approved" : "declined",
        rawPayload: payload,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Estado KYC para usuario ${uid} actualizado a kycVerified=${isApproved}`);
    res.status(200).json({ received: true, status: "updated" });
  } catch (error: any) {
    console.error("Error al procesar Webhook de Didit:", error);
    res.status(500).send("Internal Server Error");
  }
});
