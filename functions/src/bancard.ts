/**
 * Integración Bancard vPOS 2.0 (Single Buy v1.24) — lado servidor.
 *
 * La clave privada de Bancard NUNCA debe estar en la app: el token MD5 y el
 * monto a cobrar se calculan aquí, a partir de la reserva guardada en Firestore.
 *
 * Variables de entorno (functions/.env):
 *   BANCARD_PUBLIC_KEY, BANCARD_PRIVATE_KEY
 *   BANCARD_ENV            "staging" | "production" (default: staging)
 *   BANCARD_RETURN_URL     (default: https://altago.com.py/checkout/finish)
 *   BANCARD_CANCEL_URL     (default: https://altago.com.py/checkout/cancel)
 *
 * URL de confirmación a cargar en el portal de comercios de Bancard:
 *   https://us-central1-<proyecto>.cloudfunctions.net/bancardConfirm
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

const DEFAULT_USD_TO_PYG_RATE = 7850;
const RESERVATIONS = "aircraft-reservation";
const TRANSACTIONS = "bancard-transactions";

type BancardEnv = "staging" | "production";

interface BancardServerConfig {
  env: BancardEnv;
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  returnUrl: string;
  cancelUrl: string;
}

interface BancardMessage {
  key: string;
  level: string;
  dsc: string;
}

/** Elemento `operation` que Bancard envía a la URL de confirmación. */
interface BancardConfirmOperation {
  token: string;
  shop_process_id: string | number;
  response?: string;
  response_details?: string;
  amount: string;
  currency: string;
  authorization_number?: string;
  ticket_number?: string | number;
  response_code?: string;
  response_description?: string;
  extended_response_description?: string;
  security_information?: Record<string, unknown>;
}

interface BancardGetConfirmationResponse {
  status: "success" | "error";
  confirmation?: BancardConfirmOperation;
  messages?: BancardMessage[];
}

export interface ReservationData {
  aircraftId: string;
  clientId?: string;
  price?: number;
  internal_status?: string;
  client_status?: string;
  trip?: { origin_airport_ident?: string; destination_airport_ident?: string };
  bancard_shop_process_id?: number;
}

export interface BancardSingleBuyResult {
  processId: string;
  shopProcessId: number;
  amountPyg: number;
  amountUsd: number;
  exchangeRate: number;
  environment: BancardEnv;
  checkoutBaseUrl: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface BancardConfirmationResult {
  status: "approved" | "declined" | "pending";
  responseCode?: string;
  responseDescription?: string;
  authorizationNumber?: string;
  ticketNumber?: string;
}

function getConfig(): BancardServerConfig {
  const publicKey = process.env.BANCARD_PUBLIC_KEY?.trim();
  const privateKey = process.env.BANCARD_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    throw new HttpsError(
      "failed-precondition",
      "Falta configurar BANCARD_PUBLIC_KEY / BANCARD_PRIVATE_KEY en el servidor."
    );
  }
  const env: BancardEnv = process.env.BANCARD_ENV?.trim() === "production" ? "production" : "staging";
  return {
    env,
    baseUrl: env === "production" ? "https://vpos.infonet.com.py" : "https://vpos.infonet.com.py:8888",
    publicKey,
    privateKey,
    returnUrl: process.env.BANCARD_RETURN_URL?.trim() || "https://altago.com.py/checkout/finish",
    cancelUrl: process.env.BANCARD_CANCEL_URL?.trim() || "https://altago.com.py/checkout/cancel",
  };
}

const md5 = (s: string) => crypto.createHash("md5").update(s, "utf8").digest("hex");

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a.toLowerCase(), "utf8");
  const bb = Buffer.from(b.toLowerCase(), "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** shop_process_id entero de hasta 15 dígitos. */
function generateShopProcessId(): number {
  const ts = Date.now() % 1_000_000_000_000; // 12 dígitos
  const rnd = crypto.randomInt(100, 1000); // 3 dígitos
  return Number(`${ts}${rnd}`);
}

async function getExchangeRate(): Promise<number> {
  try {
    const snap = await getFirestore().collection("Contadores").doc("cambioDelDia").get();
    const dolar = Number(snap.data()?.dolar);
    return Number.isFinite(dolar) && dolar > 0 ? dolar : DEFAULT_USD_TO_PYG_RATE;
  } catch (err) {
    console.warn("[bancard] No se pudo leer Contadores/cambioDelDia, usando fallback:", err);
    return DEFAULT_USD_TO_PYG_RATE;
  }
}

/**
 * Puede iniciar el cobro: el cliente de la reserva, un ADMIN, el OWNER de la
 * aeronave o un PILOT encargado que gestione esa aeronave.
 */
export async function assertCanChargeReservation(uid: string, reservation: ReservationData): Promise<void> {
  if (reservation.clientId && reservation.clientId === uid) return;

  const db = getFirestore();
  const userSnap = await db.collection("users").doc(uid).get();
  const roles: string[] = (userSnap.data()?.roles as string[]) || [];

  if (roles.includes("ADMIN")) return;

  if (roles.includes("OWNER")) {
    const aircraftSnap = await db.collection("AircraftSpecs").doc(reservation.aircraftId).get();
    if (aircraftSnap.data()?.ownerId === uid) return;
  }

  if (roles.includes("PILOT")) {
    const pilotSnap = await db.collection("pilots").doc(uid).get();
    const pilot = pilotSnap.data();
    if (pilot?.isEncargado === true) {
      const managed: string[] = pilot.managed_aircrafts || [];
      if (managed.includes(reservation.aircraftId)) return;
    }
  }

  throw new HttpsError("permission-denied", "No tenés permisos para cobrar esta reserva.");
}

/**
 * DATOS FISCALES DE DEMOSTRACIÓN (no válidos ante la DNIT).
 * Reemplazar por la emisión real SIFEN/e-Kuatia cuando esté el certificado digital.
 */
function buildDemoInvoice() {
  const serial = crypto.randomInt(1000, 10000);
  const tail = crypto.randomInt(1_000_000_000, 10_000_000_000);
  return {
    invoice_number: `001-001-000${serial}`,
    invoice_timbrado: "17492831",
    invoice_cdc: `01800987654001001000${serial}120261016${tail}`,
    invoice_is_demo: true,
  };
}

/**
 * Aplica el resultado de una confirmación de Bancard (venga del POST de
 * Bancard o de la consulta get_confirmation). Idempotente.
 */
async function applyConfirmation(
  shopProcessId: string,
  op: BancardConfirmOperation,
  source: "bancard_confirm" | "get_confirmation"
): Promise<BancardConfirmationResult> {
  const db = getFirestore();
  const txRef = db.collection(TRANSACTIONS).doc(shopProcessId);
  const approved = op.response_code === "00" && (op.response ?? "S") === "S";

  const result: BancardConfirmationResult = {
    status: approved ? "approved" : "declined",
    responseCode: op.response_code,
    responseDescription: op.response_description,
    authorizationNumber: op.authorization_number,
    ticketNumber: op.ticket_number != null ? String(op.ticket_number) : undefined,
  };

  await db.runTransaction(async (t) => {
    const txSnap = await t.get(txRef);
    if (!txSnap.exists) {
      throw new Error(`Transacción Bancard ${shopProcessId} desconocida`);
    }
    const tx = txSnap.data() as { reservationId: string; amountFormatted: string; status: string };

    // El monto confirmado debe coincidir con el que iniciamos.
    if (Number(op.amount).toFixed(2) !== Number(tx.amountFormatted).toFixed(2)) {
      throw new Error(
        `Monto confirmado (${op.amount}) no coincide con el iniciado (${tx.amountFormatted}) para ${shopProcessId}`
      );
    }

    if (tx.status === "approved") return; // ya procesada

    // Lecturas antes de escrituras (requisito de las transacciones de Firestore).
    const resRef = db.collection(RESERVATIONS).doc(tx.reservationId);
    const res = approved
      ? ((await t.get(resRef)).data() as (ReservationData & { price?: number }) | undefined)
      : undefined;

    t.update(txRef, {
      status: result.status,
      response_code: op.response_code ?? null,
      response_description: op.response_description ?? null,
      authorization_number: op.authorization_number ?? null,
      ticket_number: result.ticketNumber ?? null,
      security_information: op.security_information ?? null,
      confirmedVia: source,
      confirmedAt: FieldValue.serverTimestamp(),
    });

    if (approved) {
      const invoice = buildDemoInvoice();

      t.update(resRef, {
        client_status: "confirmed",
        internal_status: "confirmed",
        paid_at: FieldValue.serverTimestamp(),
        payment_method: "bancard_vpos",
        payment_transaction_id: result.ticketNumber ?? shopProcessId,
        payment_authorization_number: op.authorization_number ?? null,
        bancard_shop_process_id: Number(shopProcessId),
        ...invoice,
        status_notes: `Pago aprobado por Bancard vPOS (autorización ${op.authorization_number ?? "-"}). Factura Nº ${invoice.invoice_number}.`,
      });

      if (res?.clientId) {
        t.set(db.collection("notifications").doc(), {
          userId: res.clientId,
          reservationId: tx.reservationId,
          type: "payment_confirmed",
          title: "¡Pago Confirmado y Factura Emitida!",
          message: `Tu pago vía Bancard fue aprobado (autorización ${op.authorization_number ?? "-"}). Factura Nº ${invoice.invoice_number}.`,
          read: false,
          created_at: FieldValue.serverTimestamp(),
          routeText: `${res.trip?.origin_airport_ident ?? ""} ➔ ${res.trip?.destination_airport_ident ?? ""}`,
          amountUsd: res.price ?? 0,
        });
      }
    }
  });

  return result;
}

interface SingleBuyOptions {
  createdBy: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export async function loadReservation(reservationId: string): Promise<ReservationData> {
  const snap = await getFirestore().collection(RESERVATIONS).doc(reservationId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "La reserva no existe.");
  }
  return snap.data() as ReservationData;
}

export function isReservationPaid(r: ReservationData): boolean {
  return r.client_status === "confirmed" || r.internal_status === "confirmed";
}

/**
 * Crea el single_buy para una reserva en `awaiting_payment`.
 * El monto sale de `reservation.price` (USD) × cambio del día; nunca del cliente.
 * La autorización la verifica quien llama.
 */
export async function createSingleBuyForReservation(
  reservationId: string,
  opts: SingleBuyOptions
): Promise<BancardSingleBuyResult> {
  const cfg = getConfig();
  const db = getFirestore();
  const reservation = await loadReservation(reservationId);

  if (isReservationPaid(reservation)) {
    throw new HttpsError("failed-precondition", "Esta reserva ya está pagada.");
  }
  if (reservation.internal_status !== "awaiting_payment") {
    throw new HttpsError(
      "failed-precondition",
      "La reserva todavía no fue aprobada por operaciones (estado distinto de awaiting_payment)."
    );
  }
  const amountUsd = Number(reservation.price);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new HttpsError("failed-precondition", "La reserva no tiene un precio válido.");
  }

  const exchangeRate = await getExchangeRate();
  const amountPyg = Math.round(amountUsd * exchangeRate);
  const amountFormatted = `${amountPyg}.00`;
  const currency = "PYG";
  const shopProcessId = generateShopProcessId();
  const token = md5(`${cfg.privateKey}${shopProcessId}${amountFormatted}${currency}`);
  const returnUrl = opts.returnUrl || cfg.returnUrl;
  const cancelUrl = opts.cancelUrl || cfg.cancelUrl;

  const origin = reservation.trip?.origin_airport_ident || "";
  const dest = reservation.trip?.destination_airport_ident || "";
  const description = `Vuelo ${origin}-${dest}`.slice(0, 20);

  // `billing` NO se envía: activa la validación TAXIT y falla si el timbrado no está vinculado.
  const payload = {
    public_key: cfg.publicKey,
    operation: {
      token,
      shop_process_id: shopProcessId,
      amount: amountFormatted,
      currency,
      description,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  let data: { status?: string; process_id?: string; messages?: BancardMessage[] } | null = null;
  let httpStatus = 0;
  try {
    const res = await fetch(`${cfg.baseUrl}/vpos/api/0.3/single_buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    httpStatus = res.status;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!data) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err: any) {
    console.error("[single_buy] Error de red con Bancard:", err);
    throw new HttpsError("unavailable", `No se pudo conectar con Bancard: ${err?.message || err}`);
  }

  if (data.status !== "success" || !data.process_id) {
    const msg =
      data.messages?.map((m) => `${m.key}: ${m.dsc}`).join(" | ") || `Respuesta inesperada (HTTP ${httpStatus})`;
    console.error("[single_buy] Bancard rechazó single_buy:", msg);
    throw new HttpsError("aborted", `Bancard: ${msg}`);
  }

  await db.collection(TRANSACTIONS).doc(String(shopProcessId)).set({
    reservationId,
    shopProcessId,
    processId: data.process_id,
    amountUsd,
    amountPyg,
    amountFormatted,
    currency,
    exchangeRate,
    environment: cfg.env,
    status: "pending",
    createdBy: opts.createdBy,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection(RESERVATIONS).doc(reservationId).update({
    bancard_shop_process_id: shopProcessId,
    bancard_process_id: data.process_id,
  });

  return {
    processId: data.process_id,
    shopProcessId,
    amountPyg,
    amountUsd,
    exchangeRate,
    environment: cfg.env,
    checkoutBaseUrl: cfg.baseUrl,
    returnUrl,
    cancelUrl,
  };
}

/**
 * Consulta a Bancard (get_confirmation) el último pago iniciado de la reserva y
 * registra el resultado en Firestore. La autorización la verifica quien llama.
 */
export async function checkReservationPayment(reservationId: string): Promise<BancardConfirmationResult> {
  const cfg = getConfig();
  const reservation = await loadReservation(reservationId);

  if (isReservationPaid(reservation)) {
    return { status: "approved" };
  }
  const shopProcessId = reservation.bancard_shop_process_id;
  if (!shopProcessId) {
    return { status: "pending", responseDescription: "No hay un pago Bancard iniciado." };
  }

  const token = md5(`${cfg.privateKey}${shopProcessId}get_confirmation`);
  let data: BancardGetConfirmationResponse;
  try {
    const res = await fetch(`${cfg.baseUrl}/vpos/api/0.3/single_buy/confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_key: cfg.publicKey,
        operation: { token, shop_process_id: shopProcessId },
      }),
      signal: AbortSignal.timeout(15000),
    });
    data = (await res.json()) as BancardGetConfirmationResponse;
  } catch (err: any) {
    throw new HttpsError("unavailable", `No se pudo consultar a Bancard: ${err?.message || err}`);
  }

  if (data.status !== "success" || !data.confirmation) {
    // PaymentNotFoundError = el usuario todavía no completó el pago.
    return {
      status: "pending",
      responseDescription: data.messages?.map((m) => `${m.key}: ${m.dsc}`).join(" | "),
    };
  }

  try {
    return await applyConfirmation(String(shopProcessId), data.confirmation, "get_confirmation");
  } catch (err: any) {
    console.error("[get_confirmation] Error al aplicar confirmación:", err);
    throw new HttpsError("internal", err?.message || "No se pudo registrar la confirmación.");
  }
}

/** Callable usada por la app (WebView dentro de la app). */
export const bancardSingleBuy = onCall<{ reservationId: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debés iniciar sesión para pagar.");
  }
  const reservationId = request.data?.reservationId;
  if (!reservationId || typeof reservationId !== "string") {
    throw new HttpsError("invalid-argument", "Falta reservationId.");
  }
  await assertCanChargeReservation(request.auth.uid, await loadReservation(reservationId));
  return createSingleBuyForReservation(reservationId, { createdBy: request.auth.uid });
});

/**
 * HTTP: URL de confirmación invocada por Bancard al finalizar el pago (single_buy_confirm).
 * Valida token = md5(private_key + shop_process_id + "confirm" + amount + currency).
 */
export const bancardConfirm = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  let cfg: BancardServerConfig;
  try {
    cfg = getConfig();
  } catch (err) {
    console.error("[bancardConfirm] Configuración incompleta:", err);
    res.status(500).json({ status: "error" });
    return;
  }

  const op = (req.body?.operation ?? null) as BancardConfirmOperation | null;
  if (!op || op.shop_process_id == null || !op.token || op.amount == null || !op.currency) {
    res.status(400).json({ status: "error", message: "operation incompleta" });
    return;
  }

  const shopProcessId = String(op.shop_process_id);
  const expected = md5(`${cfg.privateKey}${shopProcessId}confirm${op.amount}${op.currency}`);
  if (!safeEqualHex(expected, String(op.token))) {
    console.warn(`[bancardConfirm] Token inválido para shop_process_id ${shopProcessId}`);
    res.status(401).json({ status: "error", message: "invalid token" });
    return;
  }

  try {
    const result = await applyConfirmation(shopProcessId, op, "bancard_confirm");
    console.log(`[bancardConfirm] ${shopProcessId} → ${result.status} (${op.response_code})`);
    res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("[bancardConfirm] Error al aplicar confirmación:", err);
    // Igual respondemos 200 para no dejar la traza como inválida; el estado se
    // puede reconciliar luego con bancardGetConfirmation.
    res.status(200).json({ status: "success" });
  }
});

/**
 * Callable: consulta a Bancard si el pago de la reserva fue confirmado y actualiza
 * Firestore. La app la usa al volver del checkout y como respaldo si la
 * confirmación de Bancard no llegó.
 */
export const bancardGetConfirmation = onCall<{ reservationId: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debés iniciar sesión.");
  }
  const reservationId = request.data?.reservationId;
  if (!reservationId || typeof reservationId !== "string") {
    throw new HttpsError("invalid-argument", "Falta reservationId.");
  }
  await assertCanChargeReservation(request.auth.uid, await loadReservation(reservationId));
  return checkReservationPayment(reservationId);
});
