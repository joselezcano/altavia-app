/**
 * Links públicos de presupuestos (hoja para el cliente por WhatsApp).
 *
 *  1. La encargada / owner / admin llama a `createQuoteLink` desde la app: se genera un
 *     token aleatorio y se guarda SOLO su hash en `quote-links/{sha256(token)}`. Si el
 *     presupuesto estaba en borrador, pasa a "enviado".
 *  2. El cliente abre https://<hosting>/presupuesto/?t=<token>.
 *  3. La página llama a `/api/quote` (rewrite de Hosting → `quoteLinkApi`):
 *     - action "info":   la hoja (solo líneas visibles; las ocultas se suman al servicio de vuelo).
 *     - action "accept": el cliente acepta; la reserva la crea después la admin desde la app.
 *
 * Nunca se exponen los costos internos ni el margen.
 */
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

const QUOTES = "quotes";
const LINKS = "quote-links";
const DEFAULT_USD_TO_PYG_RATE = 7850;

interface QuoteLineData {
  kind: string;
  label: string;
  detail?: string;
  amountUsd: number;
  visible: boolean;
}

const baseUrl = () => (process.env.PAYMENT_LINK_BASE_URL?.trim() || "https://altavia-app.web.app").replace(/\/$/, "");
const hashToken = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const toDate = (v: any): Date | null => (v instanceof Timestamp ? v.toDate() : v?.toDate ? v.toDate() : v ? new Date(v) : null);

/** Admin, dueño de la aeronave o encargada que la gestiona (mismo criterio que firestore.rules). */
async function assertCanManageAircraft(uid: string, aircraftId: string): Promise<void> {
  const db = getFirestore();
  const roles: string[] = ((await db.collection("users").doc(uid).get()).data()?.roles as string[]) || [];
  if (roles.includes("ADMIN")) return;
  if (roles.includes("OWNER")) {
    const owner = (await db.collection("AircraftSpecs").doc(aircraftId).get()).data()?.ownerId;
    if (owner === uid) return;
  }
  if (roles.includes("PILOT")) {
    const pilot = (await db.collection("pilots").doc(uid).get()).data();
    if (pilot?.isEncargado === true && (pilot.managed_aircrafts || []).includes(aircraftId)) return;
  }
  throw new HttpsError("permission-denied", "No tenés permisos sobre esta aeronave.");
}

/** Hoja del cliente: mismo criterio que buildClientView de la app. */
function clientLines(lines: QuoteLineData[], subtotalUsd: number, subtotalSuggestedUsd: number) {
  const hidden = lines.filter((l) => !l.visible && l.kind !== "flight").reduce((a, l) => a + (Number(l.amountUsd) || 0), 0);
  const adjustment = (Number(subtotalUsd) || 0) - (Number(subtotalSuggestedUsd) || 0);
  return lines
    .filter((l) => l.kind === "flight" || l.visible)
    .filter((l) => l.kind === "flight" || Number(l.amountUsd) !== 0)
    .map((l) => ({
      label: l.label,
      detail: l.kind === "flight" && (hidden !== 0 || adjustment !== 0) ? null : l.detail ?? null,
      amountUsd: round2(l.kind === "flight" ? (Number(l.amountUsd) || 0) + hidden + adjustment : l.amountUsd),
    }));
}

async function usdToPyg(): Promise<number> {
  try {
    const dolar = Number((await getFirestore().collection("Contadores").doc("cambioDelDia").get()).data()?.dolar);
    return Number.isFinite(dolar) && dolar > 0 ? dolar : DEFAULT_USD_TO_PYG_RATE;
  } catch {
    return DEFAULT_USD_TO_PYG_RATE;
  }
}

/** Callable: genera el link público de un presupuesto. */
export const createQuoteLink = onCall<{ quoteId: string }>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debés iniciar sesión.");
  const quoteId = request.data?.quoteId;
  if (!quoteId || typeof quoteId !== "string") throw new HttpsError("invalid-argument", "Falta quoteId.");

  const db = getFirestore();
  const ref = db.collection(QUOTES).doc(quoteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "El presupuesto no existe.");
  const quote = snap.data()!;
  await assertCanManageAircraft(request.auth.uid, quote.aircraftId);

  if (quote.status === "converted") {
    throw new HttpsError("failed-precondition", "Este presupuesto ya se convirtió en reserva.");
  }

  const validUntil = toDate(quote.validUntil) ?? new Date(Date.now() + 7 * 86_400_000);
  // El link vence con el presupuesto (y nunca antes de 24 h desde ahora).
  const expiresAt = new Date(Math.max(validUntil.getTime(), Date.now() + 86_400_000));
  const token = crypto.randomBytes(24).toString("base64url");

  await db.collection(LINKS).doc(hashToken(token)).set({
    quoteId,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
  if (quote.status === "draft" || quote.status === "expired") {
    await ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }

  return { url: `${baseUrl()}/presupuesto/?t=${token}`, expiresAt: expiresAt.toISOString() };
});

/** HTTP público (rewrite de Hosting /api/quote): API de la hoja /presupuesto. */
export const quoteLinkApi = onRequest(async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const action = req.body?.action;
  if (!token || token.length < 20 || !["info", "accept"].includes(action)) {
    res.status(400).json({ status: "invalid" });
    return;
  }

  try {
    const db = getFirestore();
    const linkSnap = await db.collection(LINKS).doc(hashToken(token)).get();
    if (!linkSnap.exists) {
      res.status(404).json({ status: "invalid" });
      return;
    }
    const link = linkSnap.data()!;
    const quoteRef = db.collection(QUOTES).doc(link.quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
      res.status(404).json({ status: "invalid" });
      return;
    }
    const q = quoteSnap.data()!;
    const linkExpired = (link.expiresAt as Timestamp).toMillis() < Date.now();
    const quoteExpired = (toDate(q.validUntil)?.getTime() ?? 0) < Date.now();
    const accepted = q.status === "accepted" || q.status === "converted";

    if (action === "accept") {
      if (accepted) {
        res.status(200).json({ status: "accepted" });
        return;
      }
      if (q.status === "rejected") {
        res.status(200).json({ status: "rejected" });
        return;
      }
      if (linkExpired || quoteExpired) {
        res.status(200).json({ status: "expired" });
        return;
      }
      await quoteRef.update({
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedVia: "link",
        acceptedBy: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Aviso a quien armó el presupuesto.
      if (q.createdBy) {
        await db.collection("notifications").add({
          userId: q.createdBy,
          type: "quote_accepted",
          quoteId: link.quoteId,
          title: "Presupuesto aceptado",
          message: `${q.clientName || "El cliente"} aceptó el presupuesto ${q.trip?.origin_airport_ident || ""} → ${q.trip?.destination_airport_ident || ""}. Ya podés crear la reserva.`,
          read: false,
          created_at: new Date(),
        });
      }
      res.status(200).json({ status: "accepted" });
      return;
    }

    // action === "info"
    const subtotalUsd = round2(q.subtotalUsd);
    const rate = await usdToPyg();
    res.status(200).json({
      status: accepted ? "accepted" : q.status === "rejected" ? "rejected" : linkExpired || quoteExpired ? "expired" : "open",
      number: String(link.quoteId).slice(-6).toUpperCase(),
      version: q.version || 1,
      clientName: q.clientName || "",
      aircraft: { model: q.aircraftModel || "", registration: q.aircraftRegistration || "" },
      trip: {
        origin: q.trip?.origin_airport_ident || "",
        originName: q.trip?.origin_name || "",
        destination: q.trip?.destination_airport_ident || "",
        destinationName: q.trip?.destination_name || "",
      },
      roundtrip: q.schedule?.roundtrip === true,
      outbound: toDate(q.schedule?.outbound_flight_departure_time)?.toISOString() ?? null,
      return: toDate(q.schedule?.return_flight_departure_time)?.toISOString() ?? null,
      passengers: q.passengers || 0,
      lines: clientLines(q.lines || [], subtotalUsd, q.subtotalSuggestedUsd ?? subtotalUsd),
      subtotalUsd,
      ivaPct: q.ivaPct ?? 0.1,
      ivaUsd: round2(q.ivaUsd),
      totalUsd: round2(q.totalUsd),
      totalPygEstimate: Math.round(round2(q.totalUsd) * rate),
      validUntil: toDate(q.validUntil)?.toISOString() ?? null,
      notes: q.notes || "",
      issuedAt: toDate(q.updatedAt ?? q.createdAt)?.toISOString() ?? null,
      acceptedAt: toDate(q.acceptedAt)?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[quoteLinkApi] Error:", err);
    res.status(500).json({ status: "error", message: "Error interno" });
  }
});
