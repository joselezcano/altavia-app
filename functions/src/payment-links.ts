/**
 * Links de pago para enviar por WhatsApp.
 *
 * Flujo:
 *  1. La encargada / owner / admin llama a `createPaymentLink` desde la app.
 *     Se genera un token aleatorio de un solo uso (vence en 48 h) y se guarda
 *     SOLO su hash en `payment-links/{sha256(token)}`.
 *  2. El cliente abre https://<hosting>/pagar/?t=<token> (Firebase Hosting).
 *  3. La página llama a `/api/payment-link` (rewrite de Hosting → `paymentLinkApi`):
 *     - action "info":     resumen de la reserva (sin datos personales).
 *     - action "checkout": crea el single_buy y devuelve el process_id para el iframe de Bancard.
 *     - action "status":   consulta get_confirmation al volver de Bancard.
 *
 * Variable de entorno opcional: PAYMENT_LINK_BASE_URL (default https://altavia-app.web.app).
 */
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import {
  assertCanChargeReservation,
  checkReservationPayment,
  createSingleBuyForReservation,
  isReservationPaid,
  loadReservation,
} from "./bancard";

const LINKS = "payment-links";
const LINK_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_USD_TO_PYG_RATE = 7850;

interface PaymentLinkDoc {
  reservationId: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export interface CreatePaymentLinkResult {
  url: string;
  expiresAt: string;
  amountUsd: number;
  amountPygEstimate: number;
}

type PaymentLinkAction = "info" | "checkout" | "status";

const baseUrl = () => (process.env.PAYMENT_LINK_BASE_URL?.trim() || "https://altavia-app.web.app").replace(/\/$/, "");
const hashToken = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");

async function estimatePyg(amountUsd: number): Promise<number> {
  try {
    const snap = await getFirestore().collection("Contadores").doc("cambioDelDia").get();
    const dolar = Number(snap.data()?.dolar);
    return Math.round(amountUsd * (Number.isFinite(dolar) && dolar > 0 ? dolar : DEFAULT_USD_TO_PYG_RATE));
  } catch {
    return Math.round(amountUsd * DEFAULT_USD_TO_PYG_RATE);
  }
}

/** Callable: genera un link de pago para una reserva en `awaiting_payment`. */
export const createPaymentLink = onCall<{ reservationId: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debés iniciar sesión.");
  }
  const reservationId = request.data?.reservationId;
  if (!reservationId || typeof reservationId !== "string") {
    throw new HttpsError("invalid-argument", "Falta reservationId.");
  }

  const reservation = await loadReservation(reservationId);
  await assertCanChargeReservation(request.auth.uid, reservation);

  if (isReservationPaid(reservation)) {
    throw new HttpsError("failed-precondition", "Esta reserva ya está pagada.");
  }
  if (reservation.internal_status !== "awaiting_payment") {
    throw new HttpsError("failed-precondition", "Primero hay que aprobar la reserva (asignar tripulación).");
  }
  const amountUsd = Number(reservation.price);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new HttpsError("failed-precondition", "La reserva no tiene un precio válido.");
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  await getFirestore().collection(LINKS).doc(hashToken(token)).set({
    reservationId,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  const result: CreatePaymentLinkResult = {
    url: `${baseUrl()}/pagar/?t=${token}`,
    expiresAt: expiresAt.toISOString(),
    amountUsd,
    amountPygEstimate: await estimatePyg(amountUsd),
  };
  return result;
});

/** HTTP público (vía rewrite de Hosting): API de la página /pagar. */
export const paymentLinkApi = onRequest(async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const action = req.body?.action as PaymentLinkAction;
  if (!token || token.length < 20 || !["info", "checkout", "status"].includes(action)) {
    res.status(400).json({ status: "invalid" });
    return;
  }

  try {
    const tokenHash = hashToken(token);
    const linkSnap = await getFirestore().collection(LINKS).doc(tokenHash).get();
    if (!linkSnap.exists) {
      res.status(404).json({ status: "invalid" });
      return;
    }
    const link = linkSnap.data() as PaymentLinkDoc;
    const reservation = await loadReservation(link.reservationId);
    const paid = isReservationPaid(reservation);

    // Un link vencido sigue sirviendo para consultar el estado, no para pagar.
    const expired = link.expiresAt.toMillis() < Date.now();

    if (action === "status") {
      const result = paid ? { status: "approved" } : await checkReservationPayment(link.reservationId);
      res.status(200).json(result);
      return;
    }

    if (paid) {
      res.status(200).json({ status: "paid" });
      return;
    }
    if (expired) {
      res.status(200).json({ status: "expired" });
      return;
    }
    if (reservation.internal_status !== "awaiting_payment") {
      res.status(200).json({ status: "unavailable" });
      return;
    }

    const amountUsd = Number(reservation.price) || 0;
    const r = reservation as typeof reservation & {
      schedule?: { outbound_flight_departure_time?: Timestamp };
    };

    if (action === "info") {
      res.status(200).json({
        status: "awaiting_payment",
        amountUsd,
        amountPygEstimate: await estimatePyg(amountUsd),
        origin: reservation.trip?.origin_airport_ident || "",
        destination: reservation.trip?.destination_airport_ident || "",
        departure: r.schedule?.outbound_flight_departure_time?.toDate?.().toISOString() ?? null,
        expiresAt: link.expiresAt.toDate().toISOString(),
      });
      return;
    }

    // action === "checkout"
    const pageUrl = `${baseUrl()}/pagar/?t=${encodeURIComponent(token)}`;
    const buy = await createSingleBuyForReservation(link.reservationId, {
      createdBy: `payment-link:${tokenHash.slice(0, 12)}`,
      returnUrl: `${pageUrl}&r=1`,
      cancelUrl: `${pageUrl}&c=1`,
    });
    res.status(200).json({
      status: "checkout",
      processId: buy.processId,
      checkoutBaseUrl: buy.checkoutBaseUrl,
      environment: buy.environment,
      amountPyg: buy.amountPyg,
      amountUsd: buy.amountUsd,
    });
  } catch (err: any) {
    console.error("[paymentLinkApi] Error:", err);
    const message = err instanceof HttpsError ? err.message : "Error interno";
    res.status(err instanceof HttpsError && err.code === "failed-precondition" ? 409 : 500).json({
      status: "error",
      message,
    });
  }
});
