/**
 * Plan de negocio y simulador (lógica pura, sin Firebase).
 *
 * Reproduce las hojas de "Rentabilidad_Cessna414_ZP-BOC.xlsx": Gastos Fijos, Gastos
 * Variables, Escenarios (con punto de equilibrio), Recuperación de Inversión y
 * Fee CESA + Plataforma. Correcciones respecto de la planilla:
 *  - La reserva de overhaul es POR HORA (reservaHora de GIO), no un monto fijo mensual.
 *    El modo fijo se mantiene solo para verificar contra la planilla.
 *  - El seguro cambia con o sin CESA (y reemplaza la línea "Seguro" de los fijos de GIO).
 *  - Se eliminan las columnas "contado" (duplicaban HOY 8,5 hs y CESA 20 hs).
 *  - Las tarifas son IVA incluido: se trabaja con el ingreso neto de IVA.
 *
 * Los costos operativos salen de la configuración de GIO; acá no se duplican.
 * Verificación: tests/business-plan/verify-spreadsheet.mjs
 */
import {
    AircraftOperationsConfig,
    FixedMonthlyExpense,
    OperationalExpenseDoc,
    OperationalFlightDoc,
    PeriodOperationalStats,
} from "@/types/aircraft-operations";
import {
    BuildCostBaseOptions,
    BusinessPlan,
    BusinessPlanScenarioId,
    PlanCostBase,
    PlanCumulativeRoi,
    PlanDeviationRow,
    PlanFixedCostLine,
    PlanRealMonthResult,
    PlanScenarioInput,
    PlanScenarioResult,
    PlanScenarioToggles,
    PlanThirdPartyResult,
    RealMonthOptions,
} from "@/types/business-plan";
import {
    computeMonthStats,
    getFlightPlanCostUsd,
    getHourlyFuelCostUsd,
    getMonthKey,
    getMonthlyFixedCostsUsd,
    getSafeTc,
    num,
} from "@/utils/aircraft-operations-calc";

// ----------------------------------------------------------------- valores por defecto

/** Valores por defecto tomados de la hoja "Supuestos" de la planilla. */
export const BUSINESS_PLAN_DEFAULTS = {
    horasHoyMin: 7,
    horasHoyMax: 10,
    horasCesaConservador: 15,
    horasCesaObjetivo: 20,
    tarifasCesa: [1200, 1300, 1400],
    tarifasCesaIncluyenIva: false,
    seguroAnualSinCesa: 3628,
    seguroAnualConCesa: 14500,
    inspeccionesAnuales: 8000,
    aceiteHoraUsd: 1.5,
    imprevistosHoraUsd: 25,
    otrasTasasVueloUsd: 70,
    pasajerosPromedio: 2,
    duracionVueloTipicoHs: 1.8,
    precioCompraUsd: 229091,
    avionicaUsd: 45000,
    plataformaCostoUsd: 14000,
    plataformaRecuperoMeses: 18,
    tercerosAeronaves: 4,
    tercerosHorasMes: 10,
    feeCesaMonomotor: 20,
    feeCesaBimotor: 32,
    feeCesaTurbohelice: 50,
    feePasarelaPct: 0.025,
    ivaPct: 0.1,
    comisionBancardPct: 0.025,
    irePct: 0.1,
    // Conservador: por defecto se descuentan la comisión y el IRE (la planilla no los descontaba).
    descontarBancard: true,
    descontarIre: true,
    // El CESA todavía no está vigente.
    cesaVigente: false,
    escenarioReferencia: "hoy_prom" as BusinessPlanScenarioId,
} as const;

export function createDefaultBusinessPlan(
    aircraftId: string,
    ownerId = "",
    aircraftRegistration = "",
    aircraftModel = ""
): BusinessPlan {
    return {
        ...BUSINESS_PLAN_DEFAULTS,
        tarifasCesa: [...BUSINESS_PLAN_DEFAULTS.tarifasCesa],
        aircraftId,
        ownerId,
        aircraftRegistration,
        aircraftModel,
        fijosGioExcluidos: null,
    };
}

export const SCENARIO_LABELS: Record<BusinessPlanScenarioId, string> = {
    hoy_min: "Hoy · mínimo",
    hoy_prom: "Hoy · promedio",
    hoy_max: "Hoy · máximo",
    cesa_conservador: "Con CESA · conservador",
    cesa_objetivo: "Con CESA · objetivo",
};

// ------------------------------------------------------------------ gastos fijos (GIO)

const REPLACED_FIXED_IDS = ["fix-ins", "fix-hab"];
const REPLACED_FIXED_NAME = /seguro|habilitaci|inspecci/i;

/** Líneas de los fijos de GIO que el plan reemplaza por defecto (seguro e inspecciones/habilitaciones). */
export function isFixedLineReplacedByDefault(f: FixedMonthlyExpense): boolean {
    return REPLACED_FIXED_IDS.includes(f.id) || REPLACED_FIXED_NAME.test(f.n || "");
}

export function resolveExcludedFixedIds(plan: BusinessPlan, cfg: AircraftOperationsConfig): string[] {
    if (Array.isArray(plan.fijosGioExcluidos)) return plan.fijosGioExcluidos;
    return (cfg.fijos || []).filter(isFixedLineReplacedByDefault).map((f) => f.id);
}

function fixedLineUsd(f: FixedMonthlyExpense, cfg: AircraftOperationsConfig): number {
    return getMonthlyFixedCostsUsd({ ...cfg, fijos: [f] });
}

// --------------------------------------------------------------------- base de costos

/**
 * Hojas "Gastos Fijos" y "Gastos Variables": arma la base de costos del plan a partir
 * de la configuración de GIO más los supuestos propios del plan.
 */
export function buildPlanCostBase(
    plan: BusinessPlan,
    gioCfg: AircraftOperationsConfig,
    options: BuildCostBaseOptions = {}
): PlanCostBase {
    const cfg: AircraftOperationsConfig =
        options.tc && options.tc > 0 ? { ...gioCfg, tc: options.tc } : gioCfg;
    const tc = getSafeTc(cfg);

    const duracion = Math.max(0.1, num(plan.duracionVueloTipicoHs));
    const tasasPorVueloUsd = getFlightPlanCostUsd(num(plan.pasajerosPromedio), cfg) + num(plan.otrasTasasVueloUsd);

    const combustible = getHourlyFuelCostUsd(cfg);
    const piloto = num(cfg.pilotajeHora);
    const aceite = num(plan.aceiteHoraUsd);
    const imprevistos = num(plan.imprevistosHoraUsd);
    const tasas = tasasPorVueloUsd / duracion;

    const excluded = resolveExcludedFixedIds(plan, cfg);
    const fijosGio: PlanFixedCostLine[] = [];
    const fijosGioReemplazados: PlanFixedCostLine[] = [];
    (cfg.fijos || []).forEach((f) => {
        const line: PlanFixedCostLine = { id: f.id, concepto: f.n, usdMes: fixedLineUsd(f, cfg), origen: "gio" };
        if (excluded.includes(f.id)) fijosGioReemplazados.push(line);
        else fijosGio.push(line);
    });

    const fijosComunes: PlanFixedCostLine[] = [
        ...fijosGio,
        {
            id: "plan-inspecciones",
            concepto: "Inspecciones / habilitaciones (anual ÷ 12)",
            usdMes: num(plan.inspeccionesAnuales) / 12,
            origen: "plan",
        },
    ];

    return {
        tc,
        ivaPct: num(plan.ivaPct),
        comisionBancardPct: num(plan.comisionBancardPct),
        irePct: num(plan.irePct),
        variableHora: {
            combustible,
            piloto,
            aceite,
            imprevistos,
            tasas,
            total: combustible + piloto + aceite + imprevistos + tasas,
        },
        tasasPorVueloUsd,
        duracionVueloTipicoHs: duracion,
        overhaul: options.overhaul ?? { modo: "por_hora", usdHora: num(cfg.reservaHora) },
        fijosComunes,
        fijosComunesMes: fijosComunes.reduce((acc, l) => acc + l.usdMes, 0),
        seguroMesSinCesa: num(plan.seguroAnualSinCesa) / 12,
        seguroMesConCesa: num(plan.seguroAnualConCesa) / 12,
        fijosGioReemplazados,
        inversionAvion: num(plan.precioCompraUsd),
        inversionAvionica: num(plan.avionicaUsd),
    };
}

export function getSeguroMes(base: PlanCostBase, conCesa: boolean): number {
    return conCesa ? base.seguroMesConCesa : base.seguroMesSinCesa;
}

/** Fijos del mes sin overhaul: comunes + seguro según el estado del CESA. */
export function getFijosMes(base: PlanCostBase, conCesa: boolean): number {
    return base.fijosComunesMes + getSeguroMes(base, conCesa);
}

function safeDiv(a: number, b: number): number | null {
    return b > 0 && Number.isFinite(a / b) ? a / b : null;
}

// ------------------------------------------------------------------------- escenarios

/** Hoja "Escenarios" (una columna) + recuperación de la inversión. */
export function computeScenario(base: PlanCostBase, input: PlanScenarioInput): PlanScenarioResult {
    const h = Math.max(0, num(input.horasMes));
    const tarifa = Math.max(0, num(input.tarifaHora));
    const ivaFactor = 1 + Math.max(0, base.ivaPct);

    // La tarifa puede venir con IVA incluido (la de hoy, de GIO) o neta (las de CESA).
    const incluyeIva = input.tarifaIncluyeIva !== false;
    const ingresoBruto = incluyeIva ? h * tarifa : h * tarifa * ivaFactor;
    const ingresoNeto = incluyeIva ? ingresoBruto / ivaFactor : h * tarifa;
    const iva = ingresoBruto - ingresoNeto;
    // La comisión de la pasarela se cobra sobre el monto total pagado (IVA incluido).
    const comisionBancard = input.descontarBancard ? ingresoBruto * base.comisionBancardPct : 0;

    const costoVariableHora = base.variableHora.total;
    const costoVariableMes = h * costoVariableHora;

    const overhaulMes = base.overhaul.modo === "por_hora" ? h * base.overhaul.usdHora : base.overhaul.usdMes;
    const overhaulHora = base.overhaul.modo === "por_hora" ? base.overhaul.usdHora : safeDiv(base.overhaul.usdMes, h);

    const seguroMes = getSeguroMes(base, input.conCesa);
    const fijosMes = base.fijosComunesMes + seguroMes;

    const costoTotal = costoVariableMes + overhaulMes + fijosMes + comisionBancard;
    const resultadoAntesIre = ingresoNeto - costoTotal;
    const ire = input.descontarIre && resultadoAntesIre > 0 ? resultadoAntesIre * base.irePct : 0;
    const resultado = resultadoAntesIre - ire;

    // Punto de equilibrio: costos que no dependen de las horas ÷ contribución por hora.
    const netoHora = incluyeIva ? tarifa / ivaFactor : tarifa;
    const brutoHora = incluyeIva ? tarifa : tarifa * ivaFactor;
    const comisionHora = input.descontarBancard ? brutoHora * base.comisionBancardPct : 0;
    const overhaulVariableHora = base.overhaul.modo === "por_hora" ? base.overhaul.usdHora : 0;
    const contribucionHora = netoHora - comisionHora - costoVariableHora - overhaulVariableHora;
    const costosNoHorarios = fijosMes + (base.overhaul.modo === "fijo_mensual" ? base.overhaul.usdMes : 0);
    const equilibrioHorasMes = contribucionHora > 0 ? costosNoHorarios / contribucionHora : null;

    // Margen de un vuelo típico: (tarifa − variable − overhaul equivalente por hora) × duración.
    const margenVueloTipico =
        (netoHora - comisionHora - costoVariableHora - (overhaulHora ?? 0)) * base.duracionVueloTipicoHs;

    const inversionTotal = base.inversionAvion + base.inversionAvionica;

    return {
        input,
        ingresoBruto,
        iva,
        ingresoNeto,
        comisionBancard,
        costoVariableHora,
        costoVariableMes,
        overhaulMes,
        overhaulHora,
        seguroMes,
        fijosMes,
        costoTotal,
        resultadoAntesIre,
        ire,
        resultado,
        contribucionHora,
        margenVueloTipico,
        equilibrioHorasMes,
        recuperoMesesAvion: resultado > 0 ? base.inversionAvion / resultado : null,
        recuperoMesesAvionAvionica: resultado > 0 ? inversionTotal / resultado : null,
        roiAnualPct: inversionTotal > 0 ? (resultado * 12) / inversionTotal : null,
    };
}

/** Tarifa de hoy: la de venta de GIO (tarifaHora, IVA incluido). */
export function getTarifaHoy(cfg: AircraftOperationsConfig): number {
    return num(cfg.tarifaHora);
}

/** Los 5 escenarios de la hoja (sin las columnas "contado", que estaban duplicadas). */
export function buildPlanScenarioInputs(
    plan: BusinessPlan,
    tarifaHoy: number,
    toggles: PlanScenarioToggles
): PlanScenarioInput[] {
    const prom = (num(plan.horasHoyMin) + num(plan.horasHoyMax)) / 2;
    const tarifaCesa = num(plan.tarifasCesa[0]);
    const mk = (
        id: BusinessPlanScenarioId,
        horasMes: number,
        tarifaHora: number,
        conCesa: boolean
    ): PlanScenarioInput => ({
        id,
        etiqueta: SCENARIO_LABELS[id],
        horasMes,
        tarifaHora,
        // Hoy: tarifa de GIO (IVA incluido). Con CESA: según el plan (por defecto, sin IVA).
        tarifaIncluyeIva: conCesa ? plan.tarifasCesaIncluyenIva === true : true,
        conCesa,
        ...toggles,
    });
    return [
        mk("hoy_min", num(plan.horasHoyMin), tarifaHoy, false),
        mk("hoy_prom", prom, tarifaHoy, false),
        mk("hoy_max", num(plan.horasHoyMax), tarifaHoy, false),
        mk("cesa_conservador", num(plan.horasCesaConservador), tarifaCesa, true),
        mk("cesa_objetivo", num(plan.horasCesaObjetivo), tarifaCesa, true),
    ];
}

export function computeScenarioTable(
    base: PlanCostBase,
    plan: BusinessPlan,
    tarifaHoy: number,
    toggles: PlanScenarioToggles
): PlanScenarioResult[] {
    return buildPlanScenarioInputs(plan, tarifaHoy, toggles).map((s) => computeScenario(base, s));
}

export function findScenario(
    results: PlanScenarioResult[],
    id: BusinessPlanScenarioId
): PlanScenarioResult | undefined {
    return results.find((r) => r.input.id === id);
}

/**
 * Comparativo de las 3 tarifas con CESA × horas conservador / objetivo (Resumen B43:H51).
 * Con las horas conservador es también la hoja "Recuperación de Inversión".
 */
export function computeTariffComparison(
    base: PlanCostBase,
    plan: BusinessPlan,
    toggles: PlanScenarioToggles
): PlanScenarioResult[] {
    const horas = [num(plan.horasCesaConservador), num(plan.horasCesaObjetivo)];
    const out: PlanScenarioResult[] = [];
    horas.forEach((h, hi) => {
        plan.tarifasCesa.forEach((t, ti) => {
            out.push(
                computeScenario(base, {
                    id: `tarifa${ti + 1}_${hi === 0 ? "conservador" : "objetivo"}`,
                    etiqueta: `USD ${formatNumber(t)} · ${formatNumber(h)} hs`,
                    horasMes: h,
                    tarifaHora: num(t),
                    tarifaIncluyeIva: plan.tarifasCesaIncluyenIva === true,
                    conCesa: true,
                    ...toggles,
                })
            );
        });
    });
    return out;
}

// ----------------------------------------------------------------- terceros (CESA)

/** Hoja "Fee CESA + Plataforma". Los fees se toman netos (la planilla no les aplica IVA). */
export function computeThirdPartyFees(plan: BusinessPlan): PlanThirdPartyResult {
    const aeronaves = Math.max(1, num(plan.tercerosAeronaves));
    const meses = Math.max(1, num(plan.plataformaRecuperoMeses));
    const costo = num(plan.plataformaCostoUsd);
    const horasMes = num(plan.tercerosHorasMes);
    const feePlataformaSugerido = costo / (meses * aeronaves);

    const cats: { id: "monomotor" | "bimotor" | "turbohelice"; etiqueta: string; feeHora: number }[] = [
        { id: "monomotor", etiqueta: "Monomotor liviano", feeHora: num(plan.feeCesaMonomotor) },
        { id: "bimotor", etiqueta: "Bimotor liviano", feeHora: num(plan.feeCesaBimotor) },
        { id: "turbohelice", etiqueta: "Turbohélice / mayor capacidad", feeHora: num(plan.feeCesaTurbohelice) },
    ];

    return {
        aeronaves,
        horasMes,
        plataformaCostoUsd: costo,
        plataformaRecuperoMeses: meses,
        feePlataformaSugerido,
        sensibilidad: [12, 18, 24].map((m) => ({ meses: m, feeMes: costo / (m * aeronaves) })),
        categorias: cats.map((c) => {
            const ingresoFeeHoraMes = horasMes * c.feeHora;
            const totalPorAeronave = ingresoFeeHoraMes + feePlataformaSugerido;
            return {
                ...c,
                ingresoFeeHoraMes,
                feePlataformaMes: feePlataformaSugerido,
                totalPorAeronave,
                totalFlota: totalPorAeronave * aeronaves,
            };
        }),
        feePasarelaPct: num(plan.feePasarelaPct),
    };
}

// --------------------------------------------------------------- real (GIO) vs plan

/**
 * Resultado real de un mes a partir de las estadísticas de GIO (computeMonthStats).
 * El precio cargado en GIO es IVA incluido (la fila de una reserva copia `price`), así que
 * se descuenta el IVA. Los fijos se toman de la base del plan (fijos de GIO sin las líneas
 * que reemplaza el plan + seguro e inspecciones del plan) para que real y plan sean comparables.
 * Los gastos de mantenimiento salen del fondo de overhaul (igual que en GIO).
 */
export function computeRealMonth(
    monthKey: string,
    stats: PeriodOperationalStats,
    base: PlanCostBase,
    options: RealMonthOptions
): PlanRealMonthResult {
    const conDatos = stats.activo;
    const ivaFactor = 1 + Math.max(0, base.ivaPct);
    const ingresoBruto = stats.ingreso;
    const ingresoNeto = ingresoBruto / ivaFactor;
    const comisionBancard = options.descontarBancard ? ingresoBruto * base.comisionBancardPct : 0;
    const fijosMes = conDatos || options.cobrarFijosSinActividad ? getFijosMes(base, options.conCesa) : 0;
    const costoTotal = stats.directo + stats.reserva + fijosMes + stats.otros + comisionBancard;
    const resultadoAntesIre = ingresoNeto - costoTotal;
    const ire = options.descontarIre && resultadoAntesIre > 0 ? resultadoAntesIre * base.irePct : 0;

    const contribHora =
        stats.horas > 0
            ? (ingresoNeto - comisionBancard - stats.directo - stats.reserva) / stats.horas
            : null;
    const equilibrioHorasMes =
        contribHora !== null && contribHora > 0 ? (fijosMes + stats.otros) / contribHora : null;

    return {
        monthKey,
        conDatos,
        vuelos: stats.vuelos,
        horas: stats.horas,
        ingresoBruto,
        ingresoNeto,
        comisionBancard,
        costoVariableMes: stats.directo,
        overhaulMes: stats.reserva,
        fijosMes,
        otrosMes: stats.otros,
        costoTotal,
        resultadoAntesIre,
        ire,
        resultado: resultadoAntesIre - ire,
        equilibrioHorasMes,
    };
}

function deviation(
    id: string,
    concepto: string,
    real: number,
    plan: number,
    mejorSiMayor: boolean,
    unidad: "usd" | "horas" = "usd"
): PlanDeviationRow {
    const desvio = real - plan;
    return {
        id,
        concepto,
        real,
        plan,
        desvio,
        desvioPct: Math.abs(plan) > 0.0001 ? desvio / Math.abs(plan) : null,
        mejorSiMayor,
        unidad,
    };
}

export function buildDeviationRows(real: PlanRealMonthResult, plan: PlanScenarioResult): PlanDeviationRow[] {
    return [
        deviation("horas", "Horas voladas", real.horas, plan.input.horasMes, true, "horas"),
        deviation("ingreso", "Ingreso neto de IVA", real.ingresoNeto, plan.ingresoNeto, true),
        deviation("comision", "Comisión Bancard", real.comisionBancard, plan.comisionBancard, false),
        deviation("variable", "Costo variable (combustible, piloto, tasas…)", real.costoVariableMes, plan.costoVariableMes, false),
        deviation("overhaul", "Reserva de overhaul", real.overhaulMes, plan.overhaulMes, false),
        deviation("fijos", "Gastos fijos + otros gastos", real.fijosMes + real.otrosMes, plan.fijosMes, false),
        deviation("costo", "Costo total", real.costoTotal, plan.costoTotal, false),
        deviation("ire", "IRE estimado", real.ire, plan.ire, false),
        deviation("resultado", "Resultado", real.resultado, plan.resultado, true),
    ];
}

/** Meses (YYYY-MM) con al menos un vuelo o gasto cargado en GIO, ordenados. */
export function getGioActiveMonthKeys(
    flights: OperationalFlightDoc[],
    expenses: OperationalExpenseDoc[]
): string[] {
    const set = new Set<string>();
    flights.forEach((f) => f.fecha && set.add(getMonthKey(f.fecha)));
    expenses.forEach((g) => g.fecha && set.add(getMonthKey(g.fecha)));
    return Array.from(set)
        .filter((k) => /^\d{4}-\d{2}$/.test(k))
        .sort();
}

/** ROI acumulado real: suma del resultado real de los meses con datos de GIO contra la inversión. */
export function computeCumulativeRealRoi(
    flights: OperationalFlightDoc[],
    expenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig,
    base: PlanCostBase,
    options: RealMonthOptions
): PlanCumulativeRoi {
    let acumulado = 0;
    const meses = getGioActiveMonthKeys(flights, expenses).map((monthKey) => {
        const stats = computeMonthStats(monthKey, flights, expenses, cfg);
        const real = computeRealMonth(monthKey, stats, base, { ...options, cobrarFijosSinActividad: false });
        acumulado += real.resultado;
        return { monthKey, resultado: real.resultado, acumulado };
    });

    const inversionAvion = base.inversionAvion;
    const inversionTotal = base.inversionAvion + base.inversionAvionica;
    const promedioMensual = meses.length > 0 ? acumulado / meses.length : null;
    const restantes = (inv: number): number | null =>
        promedioMensual !== null && promedioMensual > 0 ? Math.max(0, inv - acumulado) / promedioMensual : null;

    return {
        meses,
        totalResultado: acumulado,
        promedioMensual,
        inversionAvion,
        inversionTotal,
        pctRecuperadoAvion: safeDiv(acumulado, inversionAvion),
        pctRecuperadoTotal: safeDiv(acumulado, inversionTotal),
        mesesRestantesAvion: restantes(inversionAvion),
        mesesRestantesTotal: restantes(inversionTotal),
    };
}

// ------------------------------------------------------------------------ formato

export function formatNumber(v: number, maxDecimals = 0): string {
    return num(v).toLocaleString("es-PY", { maximumFractionDigits: maxDecimals });
}

export function formatPct(v: number | null, decimals = 1): string {
    if (v === null || !Number.isFinite(v)) return "—";
    return (
        (v * 100).toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: decimals }) + " %"
    );
}

export function formatMonths(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return "No recupera";
    return v.toLocaleString("es-PY", { maximumFractionDigits: 1 }) + " meses";
}

export function formatGs(usd: number, tc: number): string {
    const gs = Math.round(num(usd) * Math.max(1, num(tc)));
    return (gs < 0 ? "−" : "") + "Gs " + Math.abs(gs).toLocaleString("es-PY");
}
