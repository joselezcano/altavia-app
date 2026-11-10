/**
 * Armado y cálculo de presupuestos (lógica pura, sin Firebase).
 *
 * - buildSuggestedQuote: a partir de la cotización por hora (computeFlightQuote) y los
 *   Ajustes de GIO de la aeronave, arma las líneas a cobrar y los costos estimados sugeridos.
 * - recomputeQuoteTotals: subtotal (sugerido o a mano), IVA, total, costos y margen.
 * - buildClientView: lo que ve el cliente (las líneas ocultas y el ajuste manual se suman
 *   a "Servicio de vuelo").
 * Todos los montos son USD SIN IVA salvo los totales con IVA.
 */
import { AircraftOperationsConfig } from "@/types/aircraft-operations";
import { FlightQuote } from "@/types/pricing";
import {
    QuoteClientView,
    QuoteCost,
    QuoteCostKind,
    QuoteLine,
    QuoteLineKind,
    QuotePricingInputs,
    QuoteTotals,
} from "@/types/quote";
import { IVA_PCT } from "@/utils/flight-pricing";

/** Comisión de Bancard por defecto (se cobra sobre el total con IVA). */
export const DEFAULT_GATEWAY_FEE_PCT = 0.025;
/** Validez por defecto del presupuesto. */
export const DEFAULT_QUOTE_VALIDITY_DAYS = 7;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => {
    const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => n.toLocaleString("es-PY", { maximumFractionDigits: 2 });

let idCounter = 0;
export function newQuoteItemId(prefix: string): string {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export interface BuildSuggestedQuoteInput {
    flightQuote: FlightQuote;
    /** Ajustes de GIO de la aeronave (costos). Si no hay, los costos quedan en 0 para completar a mano. */
    cfg: AircraftOperationsConfig | null;
    passengers: number;
    withCopilot: boolean;
    /** Lo que se le COBRA al cliente por hora de copiloto (por defecto 0: se completa si hay copiloto). */
    copilotChargePerHourUsd?: number;
    /** Lo que se le PAGA al copiloto por hora (costo; por defecto 0). */
    copilotPayPerHourUsd?: number;
    gatewayFeePct?: number;
    distanceNm: number;
    cruiseSpeedKnots: number;
}

export interface SuggestedQuote {
    pricing: QuotePricingInputs;
    lines: QuoteLine[];
    costs: QuoteCost[];
}

function line(kind: QuoteLineKind, label: string, amount: number, visible: boolean, detail?: string): QuoteLine {
    const v = round2(amount);
    return { id: newQuoteItemId(kind), kind, label, detail, suggestedUsd: v, amountUsd: v, visible };
}

function cost(kind: QuoteCostKind, label: string, amount: number, detail?: string): QuoteCost {
    const v = round2(amount);
    return { id: newQuoteItemId(kind), kind, label, detail, suggestedUsd: v, amountUsd: v };
}

export function buildSuggestedQuote(input: BuildSuggestedQuoteInput): SuggestedQuote {
    const q = input.flightQuote;
    const h = q.billableHours;
    const nights = q.nights;
    const gatewayPct = input.gatewayFeePct ?? DEFAULT_GATEWAY_FEE_PCT;
    const copilotCharge = num(input.copilotChargePerHourUsd ?? 0);
    const copilotPay = num(input.copilotPayPerHourUsd ?? 0);

    // ---------------- líneas a cobrar
    const lines: QuoteLine[] = [
        line("flight", "Servicio de vuelo", q.flightTotalUsd, true, `${fmt(h)} h × USD ${fmt(q.pricePerHourUsd)}`),
    ];
    if (input.withCopilot) {
        lines.push(line("copilot", "Copiloto", h * copilotCharge, true, `${fmt(h)} h × USD ${fmt(copilotCharge)}`));
    }
    if (nights > 0) {
        lines.push(
            line("overnight", "Pernocte", nights * q.overnightFeeUsd, true, `${nights} ${nights === 1 ? "noche" : "noches"} × USD ${fmt(q.overnightFeeUsd)}`)
        );
        lines.push(
            line("hangar", "Hangaraje / estacionamiento", nights * q.hangarPerNightUsd, true, `${nights} ${nights === 1 ? "noche" : "noches"} × USD ${fmt(q.hangarPerNightUsd)}`)
        );
    }
    // Comisión de la pasarela: oculta por defecto (queda dentro del servicio de vuelo).
    const baseForFee = lines.reduce((acc, l) => acc + l.amountUsd, 0);
    lines.push(
        line("gateway_fee", "Comisión de la pasarela de pago", baseForFee * (1 + IVA_PCT) * gatewayPct, false, `${fmt(gatewayPct * 100)} % sobre el total con IVA`)
    );

    // ---------------- costos operativos estimados (de los Ajustes de GIO)
    const cfg = input.cfg;
    const tc = cfg && num(cfg.tc) > 0 ? num(cfg.tc) : 0;
    const departures = Math.max(1, q.legs.length);
    const costs: QuoteCost[] = [];
    const fuelPerHour = cfg && tc > 0 ? (num(cfg.consumoLt) * num(cfg.precioLtGs)) / tc : 0;
    costs.push(cost("fuel", "Combustible", h * fuelPerHour, cfg ? `${fmt(h)} h × ${fmt(num(cfg.consumoLt))} L/h` : undefined));
    costs.push(cost("pilot", "Piloto", h * num(cfg?.pilotajeHora), `${fmt(h)} h × USD ${fmt(num(cfg?.pilotajeHora))}`));
    if (input.withCopilot) {
        costs.push(cost("copilot", "Copiloto", h * copilotPay, `${fmt(h)} h × USD ${fmt(copilotPay)}`));
    }
    if (nights > 0) {
        const pernoctePiloto = num(cfg?.pilotoPernocteUsd ?? 100) * (input.withCopilot ? 2 : 1);
        costs.push(cost("pilot_overnight", "Pernocte de la tripulación", nights * pernoctePiloto, `${nights} × USD ${fmt(pernoctePiloto)}`));
        costs.push(cost("hangar", "Hangaraje / estacionamiento", nights * q.hangarPerNightUsd));
    }
    const crew = input.withCopilot ? 2 : 1;
    const planGs = num(cfg?.planBaseGs) + Math.max(0, input.passengers) * num(cfg?.planPersonaGs);
    costs.push(
        cost(
            "flight_plan",
            "Plan de vuelo y tasas (DINAC)",
            tc > 0 ? (planGs / tc) * departures : 0,
            `${departures} ${departures === 1 ? "salida" : "salidas"} · ${crew} trip. + ${Math.max(0, input.passengers)} pax`
        )
    );
    costs.push(cost("overhaul", "Reserva de mantenimiento", h * num(cfg?.reservaHora), `${fmt(h)} h × USD ${fmt(num(cfg?.reservaHora))}`));

    const pricing: QuotePricingInputs = {
        billable_hours: h,
        block_factor: q.blockFactor,
        distance_nm: input.distanceNm,
        cruise_speed_knots: input.cruiseSpeedKnots,
        price_per_hour_usd: q.pricePerHourUsd,
        overnight_nights: nights,
        overnight_fee_usd: q.overnightFeeUsd,
        hangar_per_night_usd: q.hangarPerNightUsd,
        copilot_per_hour_usd: copilotCharge,
        gateway_fee_pct: gatewayPct,
    };

    return { pricing, lines, costs };
}

/** Totales del presupuesto. La comisión de la pasarela como COSTO sigue al total con IVA. */
export function recomputeQuoteTotals(
    lines: QuoteLine[],
    costs: QuoteCost[],
    manualSubtotalUsd: number | null,
    gatewayFeePct = DEFAULT_GATEWAY_FEE_PCT,
    ivaPct = IVA_PCT
): QuoteTotals & { costs: QuoteCost[] } {
    const subtotalSuggestedUsd = round2(lines.reduce((acc, l) => acc + num(l.amountUsd), 0));
    const subtotalUsd = manualSubtotalUsd !== null && manualSubtotalUsd >= 0 ? round2(manualSubtotalUsd) : subtotalSuggestedUsd;
    const ivaUsd = round2(subtotalUsd * ivaPct);
    const totalUsd = round2(subtotalUsd + ivaUsd);

    // La comisión real de la pasarela es un costo sobre lo que efectivamente se cobra.
    const gatewayCost = round2(totalUsd * gatewayFeePct);
    const hasGatewayCost = costs.some((c) => c.kind === "gateway_fee");
    const nextCosts = hasGatewayCost
        ? costs.map((c) => (c.kind === "gateway_fee" ? { ...c, suggestedUsd: gatewayCost, amountUsd: gatewayCost } : c))
        : [
              ...costs,
              {
                  id: newQuoteItemId("gateway_fee"),
                  kind: "gateway_fee" as QuoteCostKind,
                  label: "Comisión de la pasarela",
                  detail: `${fmt(gatewayFeePct * 100)} % del total con IVA`,
                  suggestedUsd: gatewayCost,
                  amountUsd: gatewayCost,
              },
          ];

    const estimatedCostUsd = round2(nextCosts.reduce((acc, c) => acc + num(c.amountUsd), 0));
    const marginUsd = round2(subtotalUsd - estimatedCostUsd);
    return {
        subtotalSuggestedUsd,
        manualSubtotalUsd: manualSubtotalUsd !== null && manualSubtotalUsd >= 0 ? round2(manualSubtotalUsd) : null,
        subtotalUsd,
        ivaPct,
        ivaUsd,
        totalUsd,
        estimatedCostUsd,
        marginUsd,
        marginPct: subtotalUsd > 0 ? marginUsd / subtotalUsd : null,
        costs: nextCosts,
    };
}

/**
 * Hoja del cliente: solo las líneas visibles. Las ocultas y la diferencia del total escrito
 * a mano se suman a "Servicio de vuelo", así la suma de las líneas da el subtotal.
 */
export function buildClientView(lines: QuoteLine[], totals: Pick<QuoteTotals, "subtotalUsd" | "subtotalSuggestedUsd" | "ivaPct" | "ivaUsd" | "totalUsd">): QuoteClientView {
    const hidden = lines.filter((l) => !l.visible && l.kind !== "flight").reduce((acc, l) => acc + num(l.amountUsd), 0);
    const adjustment = totals.subtotalUsd - totals.subtotalSuggestedUsd;
    const out = lines
        .filter((l) => l.kind === "flight" || l.visible)
        .filter((l) => l.kind === "flight" || num(l.amountUsd) !== 0)
        .map((l) => ({
            label: l.label,
            detail: l.kind === "flight" && (hidden !== 0 || adjustment !== 0) ? undefined : l.detail,
            amountUsd: round2(l.kind === "flight" ? num(l.amountUsd) + hidden + adjustment : num(l.amountUsd)),
        }));
    return {
        lines: out,
        subtotalUsd: totals.subtotalUsd,
        ivaPct: totals.ivaPct,
        ivaUsd: totals.ivaUsd,
        totalUsd: totals.totalUsd,
    };
}
