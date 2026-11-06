/**
 * Verificación de firmas de webhooks de Didit.me.
 */
import * as crypto from "crypto";

export interface DiditWebhookBody {
  event_id?: string;
  session_id?: string;
  status?: string;
  webhook_type?: string;
  vendor_data?: string;
  environment?: string;
  timestamp?: number;
  decision?: Record<string, any>;
}

/** Tolerancia de X-Timestamp según la documentación de Didit. */
const DIDIT_MAX_SKEW_SECONDS = 300;

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a.toLowerCase(), "utf8");
  const bb = Buffer.from(b.toLowerCase(), "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Didit serializa los floats enteros como enteros (ej. 1.0 → 1). */
function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, shortenFloats(v)])
    );
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function sortKeysDeep(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(sortKeysDeep);
  if (data !== null && typeof data === "object") {
    return Object.keys(data as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((data as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return data;
}

/**
 * Verifica la firma de un webhook de Didit (https://docs.didit.me/integration/webhooks):
 * 1. X-Signature-V2: HMAC-SHA256 (hex) del JSON canónico (claves ordenadas, compacto, Unicode sin escapar).
 * 2. X-Signature: HMAC-SHA256 (hex) de los bytes crudos del body.
 * Ambas aceptan también su header "-Previous" (24 h tras rotar el secreto).
 * X-Timestamp debe estar dentro de ±300 s.
 * X-Signature-Simple (deprecado) NO se acepta: no cubre vendor_data ni decision.
 */
export function verifyDiditSignature(
  req: { get(name: string): string | undefined; body: unknown; rawBody?: Buffer },
  secret: string
): { ok: true; method: string } | { ok: false; reason: string } {
  const timestamp = req.get("X-Timestamp");
  if (!timestamp) return { ok: false, reason: "falta X-Timestamp" };
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > DIDIT_MAX_SKEW_SECONDS) {
    return { ok: false, reason: `X-Timestamp fuera de rango (${timestamp})` };
  }

  const candidates = (header: string) =>
    [req.get(header), req.get(`${header}-Previous`)].filter((v): v is string => !!v);

  const v2Sigs = candidates("X-Signature-V2");
  if (v2Sigs.length && req.body && typeof req.body === "object") {
    const canonical = JSON.stringify(sortKeysDeep(shortenFloats(req.body)));
    const expected = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (v2Sigs.some((sig) => timingSafeEqualHex(expected, sig))) {
      return { ok: true, method: "X-Signature-V2" };
    }
  }

  const rawSigs = candidates("X-Signature");
  if (rawSigs.length && req.rawBody) {
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    if (rawSigs.some((sig) => timingSafeEqualHex(expected, sig))) {
      return { ok: true, method: "X-Signature" };
    }
  }

  return { ok: false, reason: "ninguna firma (V2 / raw) coincide" };
}
