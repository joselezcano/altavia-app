import { z } from "zod";

/**
 * Plan de negocio por aeronave (colección `business-plans/{aircraftId}`, solo ADMIN).
 *
 * Integra la planilla "Rentabilidad_Cessna414_ZP-BOC.xlsx". Los costos operativos
 * (combustible, piloto, tasas DINAC, reserva de overhaul por hora, gastos fijos y tipo
 * de cambio) NO se guardan acá: se leen de la configuración de GIO de la aeronave
 * (`owner_aircraft_operations_config`). Acá van solo los supuestos que GIO no tiene.
 */

export const BUSINESS_PLAN_COLLECTION = "business-plans";

export const BUSINESS_PLAN_SCENARIO_IDS = [
    "hoy_min",
    "hoy_prom",
    "hoy_max",
    "cesa_conservador",
    "cesa_objetivo",
] as const;

export type BusinessPlanScenarioId = (typeof BUSINESS_PLAN_SCENARIO_IDS)[number];

const montoSchema = z.number().nonnegative();
const pctSchema = z.number().min(0).max(1);

export const BusinessPlanSchema = z.object({
    aircraftId: z.string().min(1),
    ownerId: z.string(),
    aircraftRegistration: z.string(),
    aircraftModel: z.string(),

    // Horas de vuelo por mes
    horasHoyMin: montoSchema,
    horasHoyMax: montoSchema,
    horasCesaConservador: montoSchema,
    horasCesaObjetivo: montoSchema,

    // Tarifas a evaluar con CESA (USD por hora). La tarifa de hoy sale de GIO (tarifaHora, IVA incluido).
    tarifasCesa: z.array(montoSchema).length(3),
    // Las tarifas con CESA se cargan SIN IVA (decisión del 06/11/2026); el IVA se suma al cobrar.
    tarifasCesaIncluyenIva: z.boolean().optional(),

    // Gastos fijos que define el plan (reemplazan las líneas equivalentes de GIO)
    seguroAnualSinCesa: montoSchema,
    seguroAnualConCesa: montoSchema,
    inspeccionesAnuales: montoSchema,

    // Costos que GIO no registra por hora
    aceiteHoraUsd: montoSchema,
    imprevistosHoraUsd: montoSchema,
    otrasTasasVueloUsd: montoSchema, // "Tasa de plataforma privada" de la planilla (USD por vuelo)
    pasajerosPromedio: montoSchema,
    duracionVueloTipicoHs: z.number().positive(),

    // Inversión
    precioCompraUsd: montoSchema,
    avionicaUsd: montoSchema,

    // Plataforma AltaGo y aeronaves de terceros (CESA)
    plataformaCostoUsd: montoSchema,
    plataformaRecuperoMeses: z.number().positive(),
    tercerosAeronaves: z.number().positive(),
    tercerosHorasMes: montoSchema,
    feeCesaMonomotor: montoSchema,
    feeCesaBimotor: montoSchema,
    feeCesaTurbohelice: montoSchema,
    feePasarelaPct: pctSchema,

    // Impuestos y comisiones
    ivaPct: pctSchema,
    comisionBancardPct: pctSchema,
    irePct: pctSchema,
    descontarBancard: z.boolean(),
    descontarIre: z.boolean(),

    // Estado de la operación
    cesaVigente: z.boolean(),
    escenarioReferencia: z.enum(BUSINESS_PLAN_SCENARIO_IDS),

    // IDs de gastos fijos de GIO que reemplaza el plan (seguro, habilitaciones).
    // null = detección automática por id/nombre.
    fijosGioExcluidos: z.array(z.string()).nullable(),

    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
});

export type BusinessPlan = z.infer<typeof BusinessPlanSchema>;

/** Campos numéricos del plan (los que se editan con un TextInput). */
export type BusinessPlanNumericKey = {
    [K in keyof BusinessPlan]-?: BusinessPlan[K] extends number ? K : never;
}[keyof BusinessPlan];

export interface BusinessPlanQueryResult {
    plan: BusinessPlan;
    exists: boolean; // false = valores por defecto, todavía sin guardar
    invalidStored: boolean; // true = el documento guardado no pasó la validación y se usan los valores por defecto
}

/** Reserva de overhaul: por hora (como GIO) o monto fijo mensual (solo para comparar con la planilla). */
export type OverhaulMode =
    | { modo: "por_hora"; usdHora: number }
    | { modo: "fijo_mensual"; usdMes: number };

export interface PlanFixedCostLine {
    id: string;
    concepto: string;
    usdMes: number;
    origen: "gio" | "plan";
}

export interface PlanVariableCostPerHour {
    combustible: number;
    piloto: number;
    aceite: number;
    imprevistos: number;
    tasas: number; // tasas por vuelo prorrateadas por la duración del vuelo típico
    total: number;
}

export interface PlanCostBase {
    tc: number;
    ivaPct: number;
    comisionBancardPct: number;
    irePct: number;
    variableHora: PlanVariableCostPerHour;
    tasasPorVueloUsd: number;
    duracionVueloTipicoHs: number;
    overhaul: OverhaulMode;
    fijosComunes: PlanFixedCostLine[]; // aplican con y sin CESA (no incluyen seguro ni overhaul)
    fijosComunesMes: number;
    seguroMesSinCesa: number;
    seguroMesConCesa: number;
    fijosGioReemplazados: PlanFixedCostLine[]; // líneas de GIO que el plan reemplaza (informativo)
    inversionAvion: number;
    inversionAvionica: number;
}

export interface PlanScenarioInput {
    id: string;
    etiqueta: string;
    horasMes: number;
    tarifaHora: number; // USD por hora
    /** true (por defecto): la tarifa ya incluye IVA. false: es neta y el cliente paga tarifa × (1 + IVA). */
    tarifaIncluyeIva?: boolean;
    conCesa: boolean;
    descontarBancard: boolean;
    descontarIre: boolean;
}

export interface PlanScenarioResult {
    input: PlanScenarioInput;
    ingresoBruto: number;
    iva: number;
    ingresoNeto: number;
    comisionBancard: number;
    costoVariableHora: number;
    costoVariableMes: number;
    overhaulMes: number;
    overhaulHora: number | null; // equivalente por hora (con 0 horas en modo fijo no hay equivalente)
    seguroMes: number;
    fijosMes: number; // fijos comunes + seguro (sin overhaul)
    costoTotal: number; // variable + overhaul + fijos + comisión
    resultadoAntesIre: number;
    ire: number;
    resultado: number;
    contribucionHora: number;
    margenVueloTipico: number;
    equilibrioHorasMes: number | null;
    recuperoMesesAvion: number | null;
    recuperoMesesAvionAvionica: number | null;
    roiAnualPct: number | null; // resultado × 12 ÷ (avión + aviónica)
}

export interface PlanRealMonthResult {
    monthKey: string;
    conDatos: boolean;
    vuelos: number;
    horas: number;
    ingresoBruto: number;
    ingresoNeto: number;
    comisionBancard: number;
    costoVariableMes: number; // combustible + piloto + tasas reales de GIO
    overhaulMes: number;
    fijosMes: number;
    otrosMes: number; // gastos sueltos de GIO que no son mantenimiento
    costoTotal: number;
    resultadoAntesIre: number;
    ire: number;
    resultado: number;
    equilibrioHorasMes: number | null;
}

export interface PlanDeviationRow {
    id: string;
    concepto: string;
    real: number;
    plan: number;
    desvio: number; // real − plan
    desvioPct: number | null;
    mejorSiMayor: boolean; // true para ingresos y horas; false para costos
    unidad: "usd" | "horas";
}

export interface PlanThirdPartyCategory {
    id: "monomotor" | "bimotor" | "turbohelice";
    etiqueta: string;
    feeHora: number;
    ingresoFeeHoraMes: number;
    feePlataformaMes: number;
    totalPorAeronave: number;
    totalFlota: number;
}

export interface PlanThirdPartyResult {
    aeronaves: number;
    horasMes: number;
    plataformaCostoUsd: number;
    plataformaRecuperoMeses: number;
    feePlataformaSugerido: number;
    sensibilidad: { meses: number; feeMes: number }[];
    categorias: PlanThirdPartyCategory[];
    feePasarelaPct: number;
}

export interface PlanCumulativeRoiMonth {
    monthKey: string;
    resultado: number;
    acumulado: number;
}

export interface PlanCumulativeRoi {
    meses: PlanCumulativeRoiMonth[];
    totalResultado: number;
    promedioMensual: number | null;
    inversionAvion: number;
    inversionTotal: number;
    pctRecuperadoAvion: number | null;
    pctRecuperadoTotal: number | null;
    mesesRestantesAvion: number | null; // al ritmo del promedio real
    mesesRestantesTotal: number | null;
}

export interface PlanScenarioToggles {
    descontarBancard: boolean;
    descontarIre: boolean;
}

export type BusinessPlanTab = "actual" | "escenarios" | "simulador" | "terceros" | "roi";

export interface BuildCostBaseOptions {
    tc?: number; // tipo de cambio del simulador (si no, el de GIO)
    overhaul?: OverhaulMode; // solo para verificar contra la planilla (overhaul fijo mensual)
}

export interface RealMonthOptions extends PlanScenarioToggles {
    conCesa: boolean;
    cobrarFijosSinActividad?: boolean; // true: los fijos se cuentan aunque el mes no tenga movimientos
}
