/**
 * Presupuestos (cotizaciones) de vuelos: documento previo a la reserva.
 *
 * Dos capas:
 *  - `lines`: lo que se COBRA al cliente. Cada línea tiene un valor sugerido editable y un
 *    interruptor `visible`: las ocultas se suman a "Servicio de vuelo" en la hoja del cliente
 *    (ej. comisión de la pasarela). Todos los montos son SIN IVA; el cliente paga + IVA 10 %.
 *  - `costs`: costos operativos estimados (solo para la admin): margen del vuelo y estimación
 *    que después completa GIO con los valores reales.
 *
 * Colección `quotes/{quoteId}`. La hoja pública se comparte con un token (colección
 * `quote-links`, solo servidor), igual que los links de pago.
 */
import { Timestamp } from "firebase/firestore";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export type QuoteLineKind =
    | "flight" // Servicio de vuelo (horas × tarifa). Siempre visible: absorbe las ocultas.
    | "copilot"
    | "overnight" // Pernocte
    | "hangar" // Hangaraje / estacionamiento
    | "fees" // Tasas aeroportuarias / plan de vuelo, si se cobran aparte
    | "gateway_fee" // Comisión de la pasarela de pago
    | "other";

export interface QuoteLine {
    id: string;
    kind: QuoteLineKind;
    label: string;
    /** Detalle opcional que ve el cliente (ej. "2 noches × USD 100"). */
    detail?: string;
    /** Valor calculado por el sistema (USD sin IVA). null para líneas agregadas a mano. */
    suggestedUsd: number | null;
    /** Valor que se cobra (USD sin IVA). */
    amountUsd: number;
    /** true: aparece en la hoja del cliente. false: se suma a "Servicio de vuelo". */
    visible: boolean;
}

export type QuoteCostKind =
    | "fuel"
    | "pilot"
    | "copilot"
    | "pilot_overnight"
    | "flight_plan" // Plan de vuelo DINAC (tripulación y pasajeros)
    | "hangar"
    | "overhaul" // Reserva de mantenimiento por hora
    | "gateway_fee"
    | "other";

export interface QuoteCost {
    id: string;
    kind: QuoteCostKind;
    label: string;
    detail?: string;
    suggestedUsd: number | null;
    amountUsd: number;
}

export interface QuoteTrip {
    origin_airport_ident: string;
    origin_name?: string;
    origin_timezone?: string;
    destination_airport_ident: string;
    destination_name?: string;
    destination_timezone?: string;
}

export interface QuoteSchedule {
    roundtrip: boolean;
    outbound_flight_departure_time: Date | Timestamp;
    return_flight_departure_time: Date | Timestamp | null;
}

/** Parámetros con los que se calcularon las líneas sugeridas (para poder recalcular). */
export interface QuotePricingInputs {
    billable_hours: number;
    block_factor: number;
    distance_nm: number;
    cruise_speed_knots: number;
    price_per_hour_usd: number;
    overnight_nights: number;
    overnight_fee_usd: number;
    hangar_per_night_usd: number;
    copilot_per_hour_usd: number;
    gateway_fee_pct: number;
}

export interface QuoteTotals {
    /** Suma de las líneas (sin IVA). */
    subtotalSuggestedUsd: number;
    /** Si la admin escribe el total a mano (sin IVA). null = se usa el sugerido. */
    manualSubtotalUsd: number | null;
    /** Subtotal final sin IVA. */
    subtotalUsd: number;
    ivaPct: number;
    ivaUsd: number;
    /** Total a pagar con IVA (lo que cobra Bancard). */
    totalUsd: number;
    /** Costos operativos estimados. */
    estimatedCostUsd: number;
    /** Margen = subtotal − costos estimados. */
    marginUsd: number;
    marginPct: number | null;
}

export interface QuoteDoc extends QuoteTotals {
    id: string;
    aircraftId: string;
    ownerId: string;
    aircraftRegistration: string;
    aircraftModel: string;

    /** Cliente registrado (users/{id}); puede faltar si es un prospecto. */
    clientId: string | null;
    clientName: string;
    clientPhone?: string;
    clientEmail?: string;

    trip: QuoteTrip;
    schedule: QuoteSchedule;
    passengers: number;
    withCopilot: boolean;

    pricing: QuotePricingInputs;
    lines: QuoteLine[];
    costs: QuoteCost[];

    /** Nota visible en la hoja del cliente. */
    notes?: string;
    /** Nota interna (no sale en la hoja). */
    internalNotes?: string;

    status: QuoteStatus;
    version: number;
    validUntil: Date | Timestamp;

    sentAt?: Date | Timestamp | null;
    acceptedAt?: Date | Timestamp | null;
    acceptedVia?: "link" | "manual" | null;
    acceptedBy?: string | null;
    rejectedAt?: Date | Timestamp | null;
    reservationId?: string | null;

    createdBy: string;
    createdAt?: Date | Timestamp;
    updatedAt?: Date | Timestamp;
}

/** Línea tal como la ve el cliente (ocultas y ajuste manual ya sumados al servicio de vuelo). */
export interface QuoteClientLine {
    label: string;
    detail?: string;
    amountUsd: number;
}

export interface QuoteClientView {
    lines: QuoteClientLine[];
    subtotalUsd: number;
    ivaPct: number;
    ivaUsd: number;
    totalUsd: number;
}

export interface CreateQuoteLinkResult {
    url: string;
    expiresAt: string;
}
