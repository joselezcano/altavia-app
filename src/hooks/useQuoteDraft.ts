/**
 * Estado del editor de presupuesto (paso 3 de new-booking).
 *
 * RECÁLCULO (mecanismo):
 *  - Las sugerencias salen de buildSuggestedQuote (ruta, fechas, ida y vuelta, pasajeros,
 *    copiloto, tarifa de la aeronave y Ajustes de GIO). Se arma una "firma" con los conceptos
 *    y valores sugeridos; cuando la firma cambia, se combinan las sugerencias nuevas con lo que
 *    hay en pantalla, concepto por concepto (por `kind`):
 *      · Un monto se considera EDITADO A MANO si es distinto de su sugerido (amountUsd ≠ suggestedUsd).
 *        Ese monto se respeta; solo se actualiza su "sugerido" (que se ve con "usar sugerido").
 *      · Un monto no editado toma el sugerido nuevo.
 *      · Se conserva el interruptor "Mostrar en el presupuesto" de cada concepto.
 *      · Conceptos que dejan de aplicar (ej. sin noches → sin pernocte; sin copiloto) se quitan.
 *      · Los ítems agregados a mano (suggestedUsd = null) no se tocan nunca.
 *  - El total escrito a mano (sin IVA) tampoco se toca: se vuelve al sugerido con su botón.
 *  - Al EDITAR un presupuesto guardado no se recalcula al abrir: la primera firma (con la
 *    aeronave y los Ajustes de GIO ya cargados) se toma como punto de partida, y solo se
 *    recalcula si después cambian los datos del vuelo.
 * No se guarda ninguna marca extra: "editado" se deduce de los datos, así sobrevive al guardar.
 */
import { QuoteCost, QuoteLine } from "@/types/quote";
import { QuoteDraftParams, QuoteDraftState, QuoteManualCostInput, QuoteManualLineInput } from "@/types/quote-ui";
import { buildSuggestedQuote, DEFAULT_QUOTE_VALIDITY_DAYS, newQuoteItemId, recomputeQuoteTotals } from "@/utils/quote-builder";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const parseNum = (v: string | null | undefined) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};

/** true si la admin cambió el monto sugerido. */
export function isItemEdited(item: { suggestedUsd: number | null; amountUsd: number }): boolean {
    return item.suggestedUsd !== null && Math.abs(round2(item.amountUsd) - round2(item.suggestedUsd)) > 0.004;
}

type Item = QuoteLine | QuoteCost;

function mergeSuggested<T extends Item>(prev: T[], next: T[]): T[] {
    const out: T[] = [];
    for (const s of next) {
        const old = prev.find((p) => p.kind === s.kind && p.suggestedUsd !== null);
        if (!old) {
            out.push(s);
            continue;
        }
        out.push({
            ...old,
            detail: s.detail,
            suggestedUsd: s.suggestedUsd,
            amountUsd: isItemEdited(old) ? old.amountUsd : s.amountUsd,
        });
    }
    prev.filter((p) => p.suggestedUsd === null).forEach((p) => out.push(p));
    return out;
}

function initialValidityDays(validUntil: unknown): string {
    const d = (validUntil as any)?.toDate ? (validUntil as any).toDate() : validUntil instanceof Date ? validUntil : null;
    if (!d) return String(DEFAULT_QUOTE_VALIDITY_DAYS);
    const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    return String(days >= 1 ? days : DEFAULT_QUOTE_VALIDITY_DAYS);
}

export function useQuoteDraft(params: QuoteDraftParams): QuoteDraftState {
    const { flightQuote, cfg, cfgReady, passengers, distanceNm, cruiseSpeedKnots, initial } = params;

    const [withCopilot, setWithCopilot] = useState<boolean>(initial?.withCopilot ?? false);
    const [copilotChargeInput, setCopilotChargeInput] = useState<string>(
        initial ? String(initial.pricing?.copilot_per_hour_usd ?? 0) : "0"
    );
    const [copilotPayInput, setCopilotPayInput] = useState<string>(() => {
        const hours = initial?.pricing?.billable_hours ?? 0;
        const c = initial?.costs?.find((x) => x.kind === "copilot");
        return c && hours > 0 ? String(round2((c.suggestedUsd ?? c.amountUsd) / hours)) : "0";
    });
    const [lines, setLines] = useState<QuoteLine[]>(initial?.lines ?? []);
    // La comisión de la pasarela como costo la agrega recomputeQuoteTotals (sigue al total).
    const [costs, setCosts] = useState<QuoteCost[]>((initial?.costs ?? []).filter((c) => c.kind !== "gateway_fee"));
    const [manualSubtotalInput, setManualSubtotalInput] = useState<string | null>(
        initial && initial.manualSubtotalUsd !== null && initial.manualSubtotalUsd !== undefined
            ? String(initial.manualSubtotalUsd)
            : null
    );
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const [internalNotes, setInternalNotes] = useState(initial?.internalNotes ?? "");
    const [validityDaysInput, setValidityDaysInput] = useState(
        initial ? initialValidityDays(initial.validUntil) : String(DEFAULT_QUOTE_VALIDITY_DAYS)
    );

    const gatewayFeePct = initial?.pricing?.gateway_fee_pct;
    const copilotCharge = parseNum(copilotChargeInput);
    const copilotPay = parseNum(copilotPayInput);

    const suggestion = useMemo(
        () =>
            buildSuggestedQuote({
                flightQuote,
                cfg,
                passengers,
                withCopilot,
                copilotChargePerHourUsd: copilotCharge,
                copilotPayPerHourUsd: copilotPay,
                gatewayFeePct,
                distanceNm,
                cruiseSpeedKnots,
            }),
        [flightQuote, cfg, passengers, withCopilot, copilotCharge, copilotPay, gatewayFeePct, distanceNm, cruiseSpeedKnots]
    );

    const signature = useMemo(
        () =>
            JSON.stringify([
                suggestion.lines.map((l) => [l.kind, l.suggestedUsd, l.detail ?? ""]),
                suggestion.costs.map((c) => [c.kind, c.suggestedUsd, c.detail ?? ""]),
            ]),
        [suggestion]
    );

    const lastSignature = useRef<string | null>(null);
    useEffect(() => {
        if (!cfgReady) return;
        if (lastSignature.current === signature) return;
        const isFirst = lastSignature.current === null;
        lastSignature.current = signature;
        // Edición: al abrir se respetan los montos guardados.
        if (isFirst && initial) return;
        setLines((prev) => mergeSuggested(prev, suggestion.lines));
        setCosts((prev) => mergeSuggested(prev, suggestion.costs));
    }, [signature, cfgReady, suggestion, initial]);

    // ------------------------------------------------------------- líneas
    const setLineAmount = useCallback((id: string, amountUsd: number) => {
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, amountUsd: round2(amountUsd) } : l)));
    }, []);
    const resetLineToSuggested = useCallback((id: string) => {
        setLines((prev) => prev.map((l) => (l.id === id && l.suggestedUsd !== null ? { ...l, amountUsd: l.suggestedUsd } : l)));
    }, []);
    const setLineVisible = useCallback((id: string, visible: boolean) => {
        // "Servicio de vuelo" siempre visible: absorbe las ocultas.
        setLines((prev) => prev.map((l) => (l.id === id && l.kind !== "flight" ? { ...l, visible } : l)));
    }, []);
    const addLine = useCallback((input: QuoteManualLineInput) => {
        setLines((prev) => [
            ...prev,
            {
                id: newQuoteItemId("other"),
                kind: "other",
                label: input.label.trim(),
                detail: input.detail?.trim() || undefined,
                suggestedUsd: null,
                amountUsd: round2(input.amountUsd),
                visible: input.visible,
            },
        ]);
    }, []);
    const removeLine = useCallback((id: string) => {
        setLines((prev) => prev.filter((l) => !(l.id === id && l.suggestedUsd === null)));
    }, []);

    // ------------------------------------------------------------- costos
    const setCostAmount = useCallback((id: string, amountUsd: number) => {
        setCosts((prev) => prev.map((c) => (c.id === id ? { ...c, amountUsd: round2(amountUsd) } : c)));
    }, []);
    const resetCostToSuggested = useCallback((id: string) => {
        setCosts((prev) => prev.map((c) => (c.id === id && c.suggestedUsd !== null ? { ...c, amountUsd: c.suggestedUsd } : c)));
    }, []);
    const addCost = useCallback((input: QuoteManualCostInput) => {
        setCosts((prev) => [
            ...prev,
            {
                id: newQuoteItemId("other"),
                kind: "other",
                label: input.label.trim(),
                suggestedUsd: null,
                amountUsd: round2(input.amountUsd),
            },
        ]);
    }, []);
    const removeCost = useCallback((id: string) => {
        setCosts((prev) => prev.filter((c) => !(c.id === id && c.suggestedUsd === null)));
    }, []);

    // ------------------------------------------------------------- totales
    const manualSubtotal = manualSubtotalInput === null ? null : parseNum(manualSubtotalInput);
    const totals = useMemo(
        () => recomputeQuoteTotals(lines, costs, manualSubtotal, suggestion.pricing.gateway_fee_pct),
        [lines, costs, manualSubtotal, suggestion.pricing.gateway_fee_pct]
    );

    return {
        withCopilot,
        setWithCopilot,
        copilotChargeInput,
        setCopilotChargeInput,
        copilotPayInput,
        setCopilotPayInput,
        lines,
        setLineAmount,
        resetLineToSuggested,
        setLineVisible,
        addLine,
        removeLine,
        costs,
        setCostAmount,
        resetCostToSuggested,
        addCost,
        removeCost,
        manualSubtotalInput,
        setManualSubtotalInput,
        notes,
        setNotes,
        internalNotes,
        setInternalNotes,
        validityDaysInput,
        setValidityDaysInput,
        pricing: suggestion.pricing,
        totals,
    };
}
