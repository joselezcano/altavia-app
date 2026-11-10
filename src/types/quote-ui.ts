/**
 * Tipos de las pantallas de presupuestos (editor en new-booking, lista y detalle).
 * El modelo de datos está en src/types/quote.ts.
 */
import type { AircraftOperationsConfig } from "./aircraft-operations";
import type { Airport } from "./all-roles";
import type { FlightQuote } from "./pricing";
import type { BaseUser } from "./user";
import type { QuoteCost, QuoteDoc, QuoteLine, QuotePricingInputs, QuoteStatus, QuoteTotals } from "./quote";

/** Entrada del hook useQuoteDraft (estado del editor del paso 3 de new-booking). */
export interface QuoteDraftParams {
    flightQuote: FlightQuote;
    /** Ajustes de GIO de la aeronave (null si no se pudieron leer: costos en 0). */
    cfg: AircraftOperationsConfig | null;
    /** false mientras se leen los Ajustes de GIO (no se recalcula hasta tenerlos). */
    cfgReady: boolean;
    passengers: number;
    distanceNm: number;
    cruiseSpeedKnots: number;
    /** Presupuesto que se edita (null = nuevo). */
    initial: QuoteDoc | null;
}

/** Ítem que la admin agrega a mano ("Agregar ítem"). */
export interface QuoteManualLineInput {
    label: string;
    detail?: string;
    amountUsd: number;
    visible: boolean;
}

export interface QuoteManualCostInput {
    label: string;
    amountUsd: number;
}

/** Estado y acciones del editor de presupuesto. */
export interface QuoteDraftState {
    withCopilot: boolean;
    setWithCopilot: (v: boolean) => void;
    /** USD por hora que se COBRA al cliente por el copiloto (texto del input). */
    copilotChargeInput: string;
    setCopilotChargeInput: (v: string) => void;
    /** USD por hora que se le PAGA al copiloto (costo; texto del input). */
    copilotPayInput: string;
    setCopilotPayInput: (v: string) => void;

    lines: QuoteLine[];
    setLineAmount: (id: string, amountUsd: number) => void;
    resetLineToSuggested: (id: string) => void;
    setLineVisible: (id: string, visible: boolean) => void;
    addLine: (input: QuoteManualLineInput) => void;
    removeLine: (id: string) => void;

    /** Costos editables (sin la comisión de la pasarela, que sigue al total). */
    costs: QuoteCost[];
    setCostAmount: (id: string, amountUsd: number) => void;
    resetCostToSuggested: (id: string) => void;
    addCost: (input: QuoteManualCostInput) => void;
    removeCost: (id: string) => void;

    /** null = se usa el subtotal sugerido. Texto del input del total a mano (sin IVA). */
    manualSubtotalInput: string | null;
    setManualSubtotalInput: (v: string | null) => void;

    notes: string;
    setNotes: (v: string) => void;
    internalNotes: string;
    setInternalNotes: (v: string) => void;
    validityDaysInput: string;
    setValidityDaysInput: (v: string) => void;

    pricing: QuotePricingInputs;
    /** Totales con los costos completos (incluye la comisión de la pasarela). */
    totals: QuoteTotals & { costs: QuoteCost[] };
}

export interface QuoteEditorProps {
    draft: QuoteDraftState;
    flightQuote: FlightQuote;
    /** Gs por USD (useExchangeRate). 0 si no hay. */
    exchangeRate: number;
    /** true si la aeronave no tiene Ajustes de GIO (los costos sugeridos usan valores por defecto). */
    costsFromDefaults?: boolean;
}

export interface AmountInputProps {
    value: number;
    onChange: (value: number) => void;
    placeholder?: string;
    large?: boolean;
    editable?: boolean;
}

/** Chips de la lista de presupuestos. */
export type QuoteListFilter = "all" | "draft" | "sent" | "accepted" | "converted" | "closed";

/** Estado para mostrar: un enviado con la validez vencida se muestra como vencido. */
export type QuoteDisplayStatus = QuoteStatus;

/** Filas del editor (src/components/quote/quote-editor.tsx). */
export interface QuoteLineRowProps {
    line: QuoteLine;
    draft: QuoteDraftState;
}

export interface QuoteCostRowProps {
    cost: QuoteCost;
    draft: QuoteDraftState;
}

export interface QuoteSuggestedHintProps {
    item: { suggestedUsd: number | null; amountUsd: number };
    onReset: () => void;
}

/** Formulario de new-booking (nuevo o editando un presupuesto). */
export interface NewBookingFormProps {
    initialQuote: QuoteDoc | null;
    initialClient?: BaseUser | null;
    initialOrigin?: Airport;
    initialDestination?: Airport;
    /** Se llama al guardar un presupuesto nuevo (reinicia el formulario). */
    onQuoteSaved?: () => void;
}

export interface QuoteEditLoaderProps {
    quoteId: string;
}

/** Pantallas de presupuestos (lista y detalle), compartidas por admin, owner y encargada. */
export interface QuoteStatusBadgeProps {
    status: QuoteStatus;
}

export interface QuoteDetailsActionProps {
    label: string;
    icon: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "danger" | "success" | "whatsapp";
    disabled?: boolean;
    loading?: boolean;
}
