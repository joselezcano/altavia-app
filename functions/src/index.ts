import * as admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();

export { bancardConfirm, bancardGetConfirmation, bancardSingleBuy } from "./bancard";
export { createPaymentLink, paymentLinkApi } from "./payment-links";
export { claimPreRegisteredProfile } from "./profile-claim";
export { syncReservationToGio } from "./gio-sync";
export { syncAircraftPricing } from "./pricing-sync";
export { assignAircraftToCreator, removeUnlinkedPilotFromReservations } from "./pilot-sync";
import { DiditWebhookBody, verifyDiditSignature } from "./didit";

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

  const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("DIDIT_WEBHOOK_SECRET no configurado: se rechazan todos los webhooks.");
    res.status(500).send("Webhook secret not configured");
    return;
  }

  const verification = verifyDiditSignature(req, webhookSecret);
  if (!verification.ok) {
    console.warn(`Webhook de Didit rechazado: ${verification.reason}`);
    res.status(401).json({ message: "Invalid signature" });
    return;
  }

  try {
    const payload = req.body as DiditWebhookBody;
    const webhookType = payload?.webhook_type;

    // Solo procesamos eventos de sesión KYC.
    if (webhookType !== "status.updated" && webhookType !== "data.updated") {
      res.status(200).json({ received: true, ignored: webhookType || "unknown" });
      return;
    }

    const uid = payload?.vendor_data; // Firebase UID (enviado en startKycSession)
    const status = payload?.status; // "Approved" | "Declined" | "In Review" | ...

    if (!uid) {
      console.warn("Webhook de Didit recibido sin vendor_data (uid):", payload?.session_id);
      res.status(200).json({ received: true, ignored: "missing vendor_data" });
      return;
    }

    const userRef = getFirestore().collection("users").doc(uid);
    const update: Record<string, unknown> = {
      "kycData.provider": "didit.me",
      "kycData.session_id": payload?.session_id || "",
      "kycData.status": status || "",
      "kycData.environment": payload?.environment || null,
      "kycData.lastEventId": payload?.event_id || null,
      "kycData.updatedAt": new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // kycVerified solo cambia con un resultado final; los estados intermedios
    // (In Progress, In Review, etc.) no deben revocar una verificación previa.
    if (status === "Approved") {
      update.kycVerified = true;
      update["kycData.verifiedAt"] = new Date().toISOString();
      update["kycData.documentType"] =
        payload?.decision?.id_verification?.document_type ||
        payload?.decision?.details?.document_type ||
        null;
      update["kycData.country"] =
        payload?.decision?.id_verification?.issuing_state ||
        payload?.decision?.details?.country ||
        null;
    } else if (status === "Declined" || status === "Kyc Expired") {
      update.kycVerified = false;
    }

    if (payload?.decision) {
      update["kycData.rawDecision"] = payload.decision;
    }

    await userRef.update(update);

    console.log(`KYC de ${uid}: ${status} (verificado por ${verification.method})`);
    res.status(200).json({ received: true, status: "updated" });
  } catch (error: any) {
    console.error("Error al procesar Webhook de Didit:", error);
    res.status(500).send("Internal Server Error");
  }
});

/**
 * 3. Scheduled Function: cambioDelDia
 * Se ejecuta 3 veces al día (cada 8 horas) en la zona horaria de Asunción.
 * Consulta la cotización en Cambios Chaco y actualiza el documento Contadores/cambioDelDia en Firestore.
 */
export const cambioDelDia = onSchedule(
  {
    schedule: "every 8 hours",
    timeZone: "America/Asuncion",
  },
  async () => {
    try {
      console.log("[cambioDelDia] Consultando Cambios Chaco...");
      const res = await fetch("https://www.cambioschaco.com.py/api/branch_office/1/exchange");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as {
        updateTs?: string;
        items?: Array<{
          isoCode: string;
          purchasePrice: number;
          salePrice: number;
        }>;
      };

      const usdItem = data.items?.find((item) => item.isoCode === "USD") || data.items?.[0];
      if (!usdItem) {
        throw new Error("No se encontró la cotización para USD en la respuesta de Cambios Chaco");
      }

      const venta = parseInt(String(usdItem.salePrice), 10);
      const compra = parseInt(String(usdItem.purchasePrice), 10);

      console.log(`[cambioDelDia] Dólar obtenido - Venta: ${venta}, Compra: ${compra}`);

      const db = getFirestore();
      await db.collection("Contadores").doc("cambioDelDia").set(
        {
          dolar: venta,
          compra: compra,
          venta: venta,
          source: "Cambios Chaco - Sucursal 1",
          chacoUpdateTs: data.updateTs || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("[cambioDelDia] Documento Contadores/cambioDelDia actualizado exitosamente.");
    } catch (error: any) {
      console.error("[cambioDelDia] Error al actualizar el dólar:", error);
    }

    return;
  }
);
