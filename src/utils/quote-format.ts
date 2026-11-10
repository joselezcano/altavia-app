/**
 * Utilidades de presentación de presupuestos (lista, detalle, WhatsApp y hoja PDF).
 * Montos en USD SIN IVA salvo los totales con IVA.
 */
import { BRAND_COLORS } from "@/constants/brand";
import { QuoteCost, QuoteDoc, QuoteStatus } from "@/types/quote";
import { QuoteListFilter } from "@/types/quote-ui";
import { ReservationEstimatedCosts } from "@/types/reservation-create";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const toDateSafe = (v: unknown): Date | null => {
    if (!v) return null;
    const d = (v as any)?.toDate ? (v as any).toDate() : v instanceof Date ? v : new Date(v as any);
    return isNaN(d.getTime()) ? null : d;
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
    draft: "Borrador",
    sent: "Enviado",
    accepted: "Aceptado",
    converted: "Convertido",
    rejected: "Rechazado",
    expired: "Vencido",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, { bg: string; fg: string }> = {
    draft: { bg: "#F1F5F9", fg: "#475569" },
    sent: { bg: BRAND_COLORS.surfaceTint, fg: BRAND_COLORS.azur },
    accepted: { bg: "#DCFCE7", fg: "#15803D" },
    converted: { bg: BRAND_COLORS.navy, fg: "#FFFFFF" },
    rejected: { bg: "#FEE2E2", fg: "#B91C1C" },
    expired: { bg: "#FEF3C7", fg: "#B45309" },
};

export const QUOTE_FILTERS: { id: QuoteListFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "draft", label: "Borrador" },
    { id: "sent", label: "Enviado" },
    { id: "accepted", label: "Aceptado" },
    { id: "converted", label: "Convertido" },
    { id: "closed", label: "Rechazado o vencido" },
];

/** Número corto del presupuesto: los últimos 6 caracteres del id. */
export function quoteShortNumber(id: string): string {
    return (id || "").slice(-6).toUpperCase();
}

/** true si la fecha ya pasó. */
export function isPastDate(d: Date | null | undefined): boolean {
    return !!d && d.getTime() < Date.now();
}

/** Un presupuesto enviado cuya validez ya pasó se muestra como vencido. */
export function quoteDisplayStatus(q: Pick<QuoteDoc, "status" | "validUntil">, now = new Date()): QuoteStatus {
    if (q.status === "sent") {
        const until = toDateSafe(q.validUntil);
        if (until && until.getTime() < now.getTime()) return "expired";
    }
    return q.status;
}

export function quoteMatchesFilter(q: QuoteDoc, filter: QuoteListFilter): boolean {
    if (filter === "all") return true;
    const s = quoteDisplayStatus(q);
    if (filter === "closed") return s === "rejected" || s === "expired";
    return s === filter;
}

export function formatUsd(n: number): string {
    return `USD ${round2(n).toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatGs(n: number): string {
    return `₲ ${Math.round(n).toLocaleString("es-PY")}`;
}

export function formatQuoteDate(v: unknown, withTime = true): string {
    const d = toDateSafe(v);
    if (!d) return "—";
    return withTime
        ? d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "Asunción (SGAS)" o el ident si no hay nombre. */
export function quoteAirportLabel(name: string | undefined, ident: string): string {
    return name ? `${name} (${ident})` : ident;
}

export function quoteRouteLabel(q: QuoteDoc, short = false): string {
    const from = short ? q.trip.origin_airport_ident : quoteAirportLabel(q.trip.origin_name, q.trip.origin_airport_ident);
    const to = short ? q.trip.destination_airport_ident : quoteAirportLabel(q.trip.destination_name, q.trip.destination_airport_ident);
    return `${from} → ${to}${q.schedule.roundtrip ? " → " + (short ? q.trip.origin_airport_ident : "regreso") : ""}`;
}

/**
 * Costos estimados del presupuesto → estimated_costs de la reserva (GIO arranca la fila
 * del vuelo con ellos). El piloto va por hora. La reserva de mantenimiento y la comisión
 * de la pasarela no se pasan: GIO las calcula con sus propios Ajustes.
 */
export function estimatedCostsFromQuote(costs: QuoteCost[], billableHours: number): ReservationEstimatedCosts {
    const sum = (kind: QuoteCost["kind"]) =>
        costs.filter((c) => c.kind === kind).reduce((acc, c) => acc + (Number(c.amountUsd) || 0), 0);
    const has = (kind: QuoteCost["kind"]) => costs.some((c) => c.kind === kind);
    const out: ReservationEstimatedCosts = {};
    if (has("fuel")) out.fuel_usd = round2(sum("fuel"));
    if (has("pilot") && billableHours > 0) out.pilot_per_hour_usd = round2(sum("pilot") / billableHours);
    if (has("copilot")) out.copilot_usd = round2(sum("copilot"));
    if (has("pilot_overnight")) out.crew_overnight_usd = round2(sum("pilot_overnight"));
    if (has("flight_plan")) out.flight_plan_usd = round2(sum("flight_plan"));
    if (has("hangar")) out.hangar_usd = round2(sum("hangar"));
    if (has("other")) out.other_usd = round2(sum("other"));
    return out;
}

/**
 * Teléfono en formato internacional para wa.me (solo dígitos). Números de Paraguay:
 * "0981 123 456" → "595981123456". null si no hay un número usable.
 */
export function phoneForWhatsApp(phone: string | undefined | null): string | null {
    if (!phone) return null;
    const trimmed = phone.trim();
    let digits = trimmed.replace(/\D/g, "");
    if (!digits) return null;
    if (trimmed.startsWith("+")) return digits.length >= 8 ? digits : null;
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("595")) {
        // ya tiene el código de país
    } else if (digits.startsWith("0")) digits = `595${digits.slice(1)}`;
    else if (digits.length === 9 && digits.startsWith("9")) digits = `595${digits}`;
    return digits.length >= 8 ? digits : null;
}

/** Link de WhatsApp con el mensaje (sin número si el cliente no tiene teléfono). */
export function whatsappUrl(phone: string | null, text: string): string {
    const encoded = encodeURIComponent(text);
    return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildQuoteWhatsAppMessage(q: QuoteDoc, url: string | null): string {
    const firstName = (q.clientName || "").trim().split(/\s+/)[0] || "";
    const lines = [
        `Hola${firstName ? " " + firstName : ""}, te comparto el presupuesto de AltaGo #${quoteShortNumber(q.id)}.`,
        `Ruta: ${quoteRouteLabel(q)}`,
        `Fecha: ${formatQuoteDate(q.schedule.outbound_flight_departure_time)} hs` +
            (q.schedule.roundtrip && q.schedule.return_flight_departure_time
                ? ` (regreso ${formatQuoteDate(q.schedule.return_flight_departure_time)} hs)`
                : ""),
        `Total ${formatUsd(q.subtotalUsd)} + IVA (${formatUsd(q.totalUsd)} con IVA).`,
    ];
    if (url) lines.push(`Podés verlo y aceptarlo acá: ${url}`);
    lines.push(`Válido hasta el ${formatQuoteDate(q.validUntil, false)}.`);
    return lines.join("\n");
}
