import {
    AccountsPayableSummary,
    AircraftOperationsConfig,
    FixedMonthlyExpense,
    FlightFinancialCalc,
    FuelPaymentScheduleItem,
    MonthSummaryRow,
    OperationalCurrency,
    OperationalExpenseDoc,
    OperationalFlightDoc,
    OperationalFlightDraft,
    OverhaulFundStatus,
    PayableItem,
    PayableMethod,
    PayableStatus,
    PaymentCondition,
    PeriodOperationalStats,
} from "@/types/aircraft-operations";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export const MES_NAMES_LOWER = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
];

export const MES_NAMES_CAP = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
];

export const DEFAULT_FIXED_EXPENSES: FixedMonthlyExpense[] = [
    { id: "fix-hangar", n: "Hangaraje", m: 550, c: "USD" },
    { id: "fix-admin", n: "Administración", m: 2200000, c: "GS" },
    { id: "fix-clean", n: "Limpieza", m: 500000, c: "GS" },
    { id: "fix-ins", n: "Seguro", m: 0, c: "USD" },
    { id: "fix-hab", n: "Habilitaciones (anual / 12)", m: 667, c: "USD" }, // 8000 USD por año
];

/**
 * Factor de bloque por defecto: las horas Hobbs reales superan a distancia / crucero
 * por rodaje, ascenso y desvíos. 1.12 ≈ Asunción–Ciudad del Este 1,6 h teóricas → 1,8 h Hobbs.
 */
export const DEFAULT_BLOCK_FACTOR = 1.12;

export function createDefaultOperationsConfig(
    ownerId: string,
    aircraftId = "zp-boc-default",
    aircraftRegistration = "ZP-BOC",
    aircraftModel = "Cessna 414"
): AircraftOperationsConfig {
    return {
        ownerId,
        aircraftId,
        aircraftRegistration,
        aircraftModel,
        tc: 5970,
        consumoLt: 160,
        precioLtGs: 14200,
        pilotajeHora: 100,
        planBaseGs: 180000,
        planPersonaGs: 15000,
        reservaHora: 119,
        tarifaHora: 900,
        pernocteUsd: 100,
        hangarNocheUsd: 0,
        pilotoPernocteUsd: 100,
        factorBloque: DEFAULT_BLOCK_FACTOR,
        fijos: DEFAULT_FIXED_EXPENSES.map((f) => ({ ...f })),
    };
}

export function num(v: unknown): number {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
        const cleaned = v.replace(/,/g, ".").trim();
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

export function hasValue(x: unknown): boolean {
    return x !== null && x !== undefined && String(x).trim() !== "";
}

export function getSafeTc(cfg: AircraftOperationsConfig): number {
    return Math.max(1, num(cfg.tc));
}

export function convertToUsd(
    value: unknown,
    currency: OperationalCurrency | undefined,
    cfg: AircraftOperationsConfig
): number {
    const val = num(value);
    return currency === "GS" ? val / getSafeTc(cfg) : val;
}

export function formatAmt(v: number): string {
    return Math.abs(Math.round(num(v))).toLocaleString("es-PY");
}

export function formatUsd(v: number): string {
    const val = num(v);
    return (val < -0.5 ? "−" : "") + "$" + formatAmt(val);
}

export function formatSignedUsd(v: number): string {
    const val = num(v);
    return (val < 0 ? "−" : "+") + "$" + formatAmt(val);
}

export function formatGsFromUsd(vUsd: number, cfg: AircraftOperationsConfig): string {
    const gs = Math.round(num(vUsd) * getSafeTc(cfg));
    return (gs < 0 ? "−" : "") + "Gs " + Math.abs(gs).toLocaleString("es-PY");
}

export function formatHours(v: number): string {
    return (
        num(v).toLocaleString("es-PY", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }) + " hs"
    );
}

export function getTodayIso(): string {
    const d = new Date();
    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}

export function getMonthKey(isoDate: string | undefined): string {
    return (isoDate || "").slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
    if (!monthKey) return "—";
    const parts = monthKey.split("-");
    if (parts.length < 2) return monthKey;
    const mIdx = Number(parts[1]) - 1;
    const monthName = MES_NAMES_CAP[mIdx] || parts[1];
    return `${monthName} ${parts[0]}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
    const parts = monthKey.split("-");
    let year = Number(parts[0]) || new Date().getFullYear();
    let monthZero = (Number(parts[1]) || 1) - 1 + delta;
    year += Math.floor(monthZero / 12);
    monthZero = ((monthZero % 12) + 12) % 12;
    return `${year}-${String(monthZero + 1).padStart(2, "0")}`;
}

export function addDaysToIso(iso: string, days: number): string {
    const p = (iso || "").split("-");
    if (p.length !== 3) return iso;
    const d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    d.setUTCDate(d.getUTCDate() + Math.round(num(days)));
    return (
        d.getUTCFullYear() +
        "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getUTCDate()).padStart(2, "0")
    );
}

export function formatIsoToDmy(iso: string): string {
    const p = (iso || "").split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso || "";
}

export function formatIsoShortDayMonth(iso: string): string {
    if (!iso || iso.length < 10) return iso || "";
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function getFuelCreditDays(v: { fuelDias?: number | string | null }): number {
    const n = num(v.fuelDias);
    return n > 0 ? Math.round(n) : 30;
}

export function getFuelDueDate(v: {
    fecha: string;
    fuelPago?: string;
    fuelDias?: number | string | null;
}): string {
    return v.fuelPago === "credito"
        ? addDaysToIso(v.fecha, getFuelCreditDays(v))
        : v.fecha;
}

/**
 * Costo estándar de combustible por hora en USD según Ajustes
 */
export function getHourlyFuelCostUsd(cfg: AircraftOperationsConfig): number {
    return num(cfg.consumoLt) * (num(cfg.precioLtGs) / getSafeTc(cfg));
}

/**
 * Total de gastos fijos mensuales convertidos a USD
 */
export function getMonthlyFixedCostsUsd(cfg: AircraftOperationsConfig): number {
    let total = 0;
    const tc = getSafeTc(cfg);
    (cfg.fijos || []).forEach((f) => {
        total += f.c === "GS" ? num(f.m) / tc : num(f.m);
    });
    return total;
}

/**
 * Costo de plan de vuelo DINAC en Guaraníes según cantidad de pasajeros
 */
export function getFlightPlanCostGs(
    pasajeros: number,
    cfg: AircraftOperationsConfig
): number {
    const pax = Math.max(0, num(pasajeros));
    return num(cfg.planBaseGs) + pax * num(cfg.planPersonaGs);
}

/**
 * Costo de plan de vuelo DINAC en USD según cantidad de pasajeros
 */
export function getFlightPlanCostUsd(
    pasajeros: number,
    cfg: AircraftOperationsConfig
): number {
    return getFlightPlanCostGs(pasajeros, cfg) / getSafeTc(cfg);
}

/**
 * Margen de contribución teórico por hora según Ajustes
 */
export function getHourlyContributionCfg(cfg: AircraftOperationsConfig): number {
    return (
        num(cfg.tarifaHora) -
        getHourlyFuelCostUsd(cfg) -
        num(cfg.pilotajeHora) -
        num(cfg.reservaHora) -
        getFlightPlanCostUsd(1, cfg) / 1.7
    );
}

/**
 * Calcula todos los valores financieros (en USD) de un vuelo o borrador
 */
export function calcFlightFinancials(
    v: Partial<OperationalFlightDoc | OperationalFlightDraft>,
    cfg: AircraftOperationsConfig
): FlightFinancialCalc {
    const h = num(v.horas);
    const p = Math.max(0, Math.round(num(v.pasajeros)));
    const tc = getSafeTc(cfg);
    const ing = v.moneda === "GS" ? num(v.precio) / tc : num(v.precio);

    // 1. Combustible: por litros x precio por litro, o importe total
    let fu = 0;
    if (v.fuelModo === "total") {
        fu = hasValue(v.fuelTotal)
            ? convertToUsd(v.fuelTotal, v.fuelCur, cfg)
            : h * getHourlyFuelCostUsd(cfg);
    } else if (hasValue(v.litros) || hasValue(v.precioLt)) {
        const L = hasValue(v.litros) ? num(v.litros) : h * num(cfg.consumoLt);
        const pl = hasValue(v.precioLt)
            ? convertToUsd(v.precioLt, v.precioLtCur, cfg)
            : num(cfg.precioLtGs) / tc;
        fu = L * pl;
    } else if (hasValue(v.fuelTotal)) {
        fu = convertToUsd(v.fuelTotal, v.fuelCur, cfg);
    } else {
        fu = h * getHourlyFuelCostUsd(cfg);
    }

    // 2. Piloto: precio por hora propio del vuelo o el de Ajustes
    let pi = 0;
    if (hasValue(v.pilotoHora)) {
        pi = h * convertToUsd(v.pilotoHora, v.pilotoHoraCur, cfg);
    } else {
        pi = h * num(cfg.pilotajeHora);
    }
    // Pernocte del piloto por cada noche fuera de base.
    const noches = Math.max(0, Math.round(num((v as Partial<OperationalFlightDoc>).noches)));
    pi += noches * num(cfg.pilotoPernocteUsd ?? 100);

    // 3. Plan de vuelo / Tasas DINAC: base y por pasajero propios o de Ajustes
    let ta = 0;
    if (hasValue(v.planBase) || hasValue(v.planPersona)) {
        const pb = hasValue(v.planBase)
            ? convertToUsd(v.planBase, v.planCur, cfg)
            : num(cfg.planBaseGs) / tc;
        const pxp = hasValue(v.planPersona)
            ? convertToUsd(v.planPersona, v.planCur, cfg)
            : num(cfg.planPersonaGs) / tc;
        ta = pb + p * pxp;
    } else {
        ta = getFlightPlanCostUsd(p, cfg);
    }

    // Hangaraje fuera de base (se suma a tasas y planes de vuelo).
    ta += num((v as Partial<OperationalFlightDoc>).hangarUsd);

    const dir = fu + pi + ta;
    const res = h * num(cfg.reservaHora);

    return {
        horas: h,
        ingreso: ing,
        fuel: fu,
        piloto: pi,
        tasas: ta,
        directo: dir,
        reserva: res,
        margen: ing - dir,
        resultado: ing - dir - res,
    };
}

export function getExpenseAmountUsd(
    g: OperationalExpenseDoc,
    cfg: AircraftOperationsConfig
): number {
    return g.moneda === "GS" ? num(g.monto) / getSafeTc(cfg) : num(g.monto);
}

export function isMaintenanceExpense(g: OperationalExpenseDoc): boolean {
    return g.tipo === "mantenimiento";
}

export function computePeriodStats(
    list: OperationalFlightDoc[],
    glist: OperationalExpenseDoc[],
    nFijos: number,
    cfg: AircraftOperationsConfig
): PeriodOperationalStats {
    const s: PeriodOperationalStats = {
        vuelos: list.length,
        horas: 0,
        ingreso: 0,
        fuel: 0,
        piloto: 0,
        tasas: 0,
        directo: 0,
        reserva: 0,
        margen: 0,
        otros: 0,
        mant: 0,
        fijos: 0,
        costoTotal: 0,
        resultado: 0,
        contrib: 0,
        necesarias: null,
        activo: list.length > 0 || glist.length > 0,
        mesesActivos: nFijos,
        list,
        glist,
    };

    list.forEach((v) => {
        const k = calcFlightFinancials(v, cfg);
        s.horas += k.horas;
        s.ingreso += k.ingreso;
        s.fuel += k.fuel;
        s.piloto += k.piloto;
        s.tasas += k.tasas;
        s.directo += k.directo;
        s.reserva += k.reserva;
        s.margen += k.margen;
    });

    glist.forEach((g) => {
        if (isMaintenanceExpense(g)) {
            s.mant += getExpenseAmountUsd(g, cfg);
        } else {
            s.otros += getExpenseAmountUsd(g, cfg);
        }
    });

    s.fijos = getMonthlyFixedCostsUsd(cfg) * nFijos;
    s.costoTotal = s.directo + s.reserva + s.fijos + s.otros;
    s.resultado = s.margen - s.reserva - s.fijos - s.otros;
    s.contrib =
        s.horas > 0
            ? (s.margen - s.reserva) / s.horas
            : getHourlyContributionCfg(cfg);
    s.necesarias = s.contrib > 0 ? (s.fijos + s.otros) / s.contrib : null;

    return s;
}

export function computeMonthStats(
    monthKey: string,
    allFlights: OperationalFlightDoc[],
    allExpenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig
): PeriodOperationalStats {
    const fl = allFlights.filter((v) => getMonthKey(v.fecha) === monthKey);
    const gs = allExpenses.filter((g) => getMonthKey(g.fecha) === monthKey);
    const activeMonths = fl.length > 0 || gs.length > 0 ? 1 : 0;
    const stats = computePeriodStats(fl, gs, activeMonths, cfg);
    stats.activo = activeMonths === 1;
    return stats;
}

export function computeYearStats(
    yearStr: string,
    allFlights: OperationalFlightDoc[],
    allExpenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig
): { yearStats: PeriodOperationalStats; monthlyRows: MonthSummaryRow[] } {
    let activeMonths = 0;
    const monthlyRows: MonthSummaryRow[] = [];

    for (let i = 1; i <= 12; i++) {
        const mKey = `${yearStr}-${String(i).padStart(2, "0")}`;
        const ms = computeMonthStats(mKey, allFlights, allExpenses, cfg);
        if (ms.activo) activeMonths++;
        monthlyRows.push({
            monthKey: mKey,
            monthIndex: i - 1,
            monthName: MES_NAMES_CAP[i - 1],
            stats: ms,
        });
    }

    const fl = allFlights.filter((v) => (v.fecha || "").slice(0, 4) === yearStr);
    const gs = allExpenses.filter((g) => (g.fecha || "").slice(0, 4) === yearStr);
    const yearStats = computePeriodStats(fl, gs, activeMonths, cfg);
    yearStats.mesesActivos = activeMonths;
    yearStats.activo = activeMonths > 0;

    return { yearStats, monthlyRows };
}

export function computeOverhaulFund(
    allFlights: OperationalFlightDoc[],
    allExpenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig
): OverhaulFundStatus {
    let ap = 0;
    let us = 0;
    allFlights.forEach((v) => {
        ap += calcFlightFinancials(v, cfg).reserva;
    });
    allExpenses.forEach((g) => {
        if (isMaintenanceExpense(g)) {
            us += getExpenseAmountUsd(g, cfg);
        }
    });
    return {
        ap,
        us,
        sa: ap - us,
    };
}

export function computeMonthFuelPayments(
    monthKey: string,
    allFlights: OperationalFlightDoc[],
    cfg: AircraftOperationsConfig
): {
    paymentsDueInMonth: FuelPaymentScheduleItem[];
    totalMonthFuelUsd: number;
    futurePendingFuelUsd: number;
} {
    const paymentsDueInMonth = allFlights
        .filter((x) => x.fecha && getMonthKey(getFuelDueDate(x)) === monthKey)
        .map((x) => ({
            flight: x,
            dueDate: getFuelDueDate(x),
            amountUsd: calcFlightFinancials(x, cfg).fuel,
            isCredit: x.fuelPago === "credito",
            creditDays: getFuelCreditDays(x),
        }))
        .filter((p) => p.amountUsd > 0.5)
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

    const totalMonthFuelUsd = paymentsDueInMonth.reduce(
        (acc, item) => acc + item.amountUsd,
        0
    );

    const hoy = getTodayIso();
    let futurePendingFuelUsd = 0;
    allFlights.forEach((x) => {
        if (x.fecha && getFuelDueDate(x) > hoy) {
            futurePendingFuelUsd += calcFlightFinancials(x, cfg).fuel;
        }
    });

    return {
        paymentsDueInMonth,
        totalMonthFuelUsd,
        futurePendingFuelUsd,
    };
}

// ============================================================================
// CUENTAS POR PAGAR (seguimiento de pagos; no cambia el resultado del mes,
// que sigue siendo por devengado).
// ============================================================================

export const PAYABLE_METHOD_LABELS: Record<PayableMethod, string> = {
    transferencia: "Transferencia",
    efectivo: "Efectivo",
    cheque: "Cheque",
    tarjeta: "Tarjeta",
    otro: "Otro",
};

export const PAYABLE_METHODS: PayableMethod[] = [
    "transferencia",
    "efectivo",
    "cheque",
    "tarjeta",
    "otro",
];

/** Plazo por defecto de una factura a crédito (días). */
export const DEFAULT_PAYABLE_DAYS = 30;

/** Días entre dos fechas ISO (to - from). */
export function diffDaysIso(fromIso: string, toIso: string): number {
    const parse = (iso: string) => {
        const p = (iso || "").split("-");
        if (p.length !== 3) return NaN;
        return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    };
    const a = parse(fromIso);
    const b = parse(toIso);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.round((b - a) / 86400000);
}

/** true si el texto es una fecha AAAA-MM-DD válida. */
export function isValidIsoDate(iso: string | null | undefined): boolean {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const p = iso.split("-").map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return (
        d.getUTCFullYear() === p[0] &&
        d.getUTCMonth() === p[1] - 1 &&
        d.getUTCDate() === p[2]
    );
}

export function getExpensePaymentCondition(g: OperationalExpenseDoc): PaymentCondition {
    return g.condicionPago === "credito" ? "credito" : "contado";
}

/** Vencimiento de un gasto: el cargado, o factura (o fecha del gasto) + 30 días. Contado = su fecha. */
export function getExpenseDueDate(g: OperationalExpenseDoc): string {
    if (getExpensePaymentCondition(g) !== "credito") return g.fecha;
    if (isValidIsoDate(g.vencimiento)) return g.vencimiento as string;
    const base = isValidIsoDate(g.facturaFecha) ? (g.facturaFecha as string) : g.fecha;
    return addDaysToIso(base, DEFAULT_PAYABLE_DAYS);
}

/** Gasto al contado (o documento viejo sin condición) = pagado. A crédito: según estadoPago. */
export function getExpensePaymentStatus(g: OperationalExpenseDoc): PayableStatus {
    if (getExpensePaymentCondition(g) !== "credito") return "pagado";
    return g.estadoPago === "pagado" ? "pagado" : "pendiente";
}

/**
 * Estado de pago del combustible de un vuelo.
 * - Contado: pagado.
 * - Crédito con fuelEstadoPago: el registrado.
 * - Crédito sin fuelEstadoPago (vuelos cargados antes de este módulo): pendiente mientras
 *   no venza; ya vencido se asume pagado en su vencimiento (mismo criterio que
 *   "Pagos de combustible", que da por hecho que sale de la caja ese día).
 */
export function getFuelPaymentStatus(v: OperationalFlightDoc, hoy = getTodayIso()): PayableStatus {
    if (v.fuelPago !== "credito") return "pagado";
    if (v.fuelEstadoPago === "pagado" || v.fuelEstadoPago === "pendiente") {
        return v.fuelEstadoPago;
    }
    return getFuelDueDate(v) >= hoy ? "pendiente" : "pagado";
}

function buildExpensePayable(
    g: OperationalExpenseDoc,
    cfg: AircraftOperationsConfig,
    hoy: string
): PayableItem {
    const esCredito = getExpensePaymentCondition(g) === "credito";
    const estado = getExpensePaymentStatus(g);
    const vencimiento = getExpenseDueDate(g);
    const dias = diffDaysIso(hoy, vencimiento);
    return {
        key: `gasto-${g.id}`,
        kind: "gasto",
        sourceId: g.id,
        ownerId: g.ownerId,
        concepto: g.concepto || "Gasto",
        proveedor: g.proveedor || "",
        proveedorRuc: g.proveedorRuc || null,
        facturaNumero: g.facturaNumero || null,
        facturaFotoUrl: g.facturaFotoUrl || null,
        fecha: g.fecha,
        vencimiento,
        amountUsd: getExpenseAmountUsd(g, cfg),
        esCredito,
        estado,
        fechaPago:
            estado === "pagado"
                ? esCredito
                    ? g.fechaPago || vencimiento
                    : g.fecha
                : null,
        medioPago: estado === "pagado" ? g.medioPago || null : null,
        reciboFotoUrl: g.reciboFotoUrl || null,
        notasPago: g.notasPago || null,
        pagoAsumido: false,
        vencido: estado === "pendiente" && dias < 0,
        diasParaVencer: dias,
        expense: g,
    };
}

function buildFuelPayable(
    v: OperationalFlightDoc,
    cfg: AircraftOperationsConfig,
    hoy: string
): PayableItem {
    const esCredito = v.fuelPago === "credito";
    const estado = getFuelPaymentStatus(v, hoy);
    const vencimiento = getFuelDueDate(v);
    const dias = diffDaysIso(hoy, vencimiento);
    const ruta = v.ruta ? ` · ${v.ruta}` : "";
    return {
        key: `combustible-${v.id}`,
        kind: "combustible",
        sourceId: v.id,
        ownerId: v.ownerId,
        concepto: `Combustible del vuelo del ${formatIsoToDmy(v.fecha)}${ruta}`,
        proveedor: v.fuelProveedor || "",
        proveedorRuc: null,
        facturaNumero: v.fuelFacturaNumero || null,
        facturaFotoUrl: v.fuelFacturaFotoUrl || null,
        fecha: v.fecha,
        vencimiento,
        amountUsd: calcFlightFinancials(v, cfg).fuel,
        esCredito,
        estado,
        fechaPago:
            estado === "pagado"
                ? esCredito
                    ? v.fuelFechaPago || vencimiento
                    : v.fecha
                : null,
        medioPago: estado === "pagado" ? v.fuelMedioPago || null : null,
        reciboFotoUrl: v.fuelReciboFotoUrl || null,
        notasPago: v.fuelNotasPago || null,
        pagoAsumido: esCredito && estado === "pagado" && !v.fuelEstadoPago,
        vencido: estado === "pendiente" && dias < 0,
        diasParaVencer: dias,
        flight: v,
    };
}

/** Todas las compras (gastos sueltos y combustible) como ítems de cuentas por pagar. */
export function buildPayableItems(
    allFlights: OperationalFlightDoc[],
    allExpenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig,
    hoy = getTodayIso()
): PayableItem[] {
    const items: PayableItem[] = [];
    allExpenses.forEach((g) => {
        if (!g.fecha) return;
        const it = buildExpensePayable(g, cfg, hoy);
        if (it.amountUsd > 0) items.push(it);
    });
    allFlights.forEach((v) => {
        if (!v.fecha) return;
        const it = buildFuelPayable(v, cfg, hoy);
        if (it.amountUsd > 0.5) items.push(it);
    });
    return items;
}

/**
 * Resumen de cuentas por pagar: todo lo pendiente (ordenado por vencimiento)
 * y lo pagado en el mes elegido.
 */
export function computeAccountsPayable(
    monthKey: string,
    allFlights: OperationalFlightDoc[],
    allExpenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig,
    hoy = getTodayIso()
): AccountsPayableSummary {
    const items = buildPayableItems(allFlights, allExpenses, cfg, hoy);

    const pendientes = items
        .filter((it) => it.estado === "pendiente")
        .sort((a, b) =>
            a.vencimiento === b.vencimiento
                ? a.fecha < b.fecha
                    ? -1
                    : 1
                : a.vencimiento < b.vencimiento
                  ? -1
                  : 1
        );

    const pagadosMes = items
        .filter(
            (it) =>
                it.esCredito &&
                it.estado === "pagado" &&
                getMonthKey(it.fechaPago || "") === monthKey
        )
        .sort((a, b) => ((a.fechaPago || "") < (b.fechaPago || "") ? 1 : -1));

    const totalContadoMesUsd = items
        .filter((it) => !it.esCredito && getMonthKey(it.fecha) === monthKey)
        .reduce((acc, it) => acc + it.amountUsd, 0);

    const vencidos = pendientes.filter((it) => it.vencido);

    return {
        pendientes,
        pagadosMes,
        totalPendienteUsd: pendientes.reduce((acc, it) => acc + it.amountUsd, 0),
        totalVencidoUsd: vencidos.reduce((acc, it) => acc + it.amountUsd, 0),
        cantidadVencidos: vencidos.length,
        totalPagadoMesUsd: pagadosMes.reduce((acc, it) => acc + it.amountUsd, 0),
        totalContadoMesUsd,
    };
}

/**
 * Lo que sigue pendiente de pago de las compras del mes (gastos y combustible
 * con fecha en ese mes). Solo informativo: no cambia el resultado del mes.
 */
export function computeMonthPendingPaymentUsd(
    monthKey: string,
    allFlights: OperationalFlightDoc[],
    allExpenses: OperationalExpenseDoc[],
    cfg: AircraftOperationsConfig,
    hoy = getTodayIso()
): number {
    return buildPayableItems(allFlights, allExpenses, cfg, hoy)
        .filter((it) => it.estado === "pendiente" && getMonthKey(it.fecha) === monthKey)
        .reduce((acc, it) => acc + it.amountUsd, 0);
}

/**
 * Datos demostrativos realistas basados en la operación real de ZP-BOC (Cessna 414)
 * para permitir visualizar cómo funciona el punto de equilibrio, combustible a crédito y fondo de overhaul.
 */
export function getDemoZpBocData(
    ownerId: string,
    aircraftId: string,
    aircraftRegistration = "ZP-BOC",
    aircraftModel = "Cessna 414"
): {
    flights: OperationalFlightDoc[];
    expenses: OperationalExpenseDoc[];
} {
    const flights: OperationalFlightDoc[] = [
        {
            id: "demo-zpboc-f1",
            ownerId,
            aircraftId,
            aircraftRegistration,
            aircraftModel,
            fecha: "2026-10-05",
            cliente: "Agropecuaria Santa Rosa S.A.",
            ruta: "Asunción – Ciudad del Este – Asunción",
            horas: 2.2,
            precio: 1980,
            moneda: "USD",
            cobrado: true,
            pasajeros: 4,
            fuelModo: "litros",
            litros: 350,
            precioLt: 14200,
            precioLtCur: "GS",
            fuelTotal: null,
            fuelCur: "GS",
            pilotoHora: 100,
            pilotoHoraCur: "USD",
            planBase: 180000,
            planPersona: 15000,
            planCur: "GS",
            fuelPago: "credito",
            fuelDias: 30,
            fotoUrl: null,
        },
        {
            id: "demo-zpboc-f2",
            ownerId,
            aircraftId,
            aircraftRegistration,
            aircraftModel,
            fecha: "2026-10-12",
            cliente: "Grupo Inmobiliario del Este",
            ruta: "Asunción – Encarnación – Asunción",
            horas: 2.4,
            precio: 2160,
            moneda: "USD",
            cobrado: true,
            pasajeros: 5,
            fuelModo: "litros",
            litros: 384,
            precioLt: 14200,
            precioLtCur: "GS",
            fuelTotal: null,
            fuelCur: "GS",
            pilotoHora: 100,
            pilotoHoraCur: "USD",
            planBase: 180000,
            planPersona: 15000,
            planCur: "GS",
            fuelPago: "contado",
            fuelDias: 30,
            fotoUrl: null,
        },
        {
            id: "demo-zpboc-f3",
            ownerId,
            aircraftId,
            aircraftRegistration,
            aircraftModel,
            fecha: "2026-10-19",
            cliente: "Estancia Loma Plata",
            ruta: "Asunción – Filadelfia (Chaco) – Asunción",
            horas: 3.1,
            precio: 2790,
            moneda: "USD",
            cobrado: false,
            pasajeros: 3,
            fuelModo: "litros",
            litros: 495,
            precioLt: 14200,
            precioLtCur: "GS",
            fuelTotal: null,
            fuelCur: "GS",
            pilotoHora: 100,
            pilotoHoraCur: "USD",
            planBase: 180000,
            planPersona: 15000,
            planCur: "GS",
            fuelPago: "credito",
            fuelDias: 30,
            fotoUrl: null,
        },
        {
            id: "demo-zpboc-f4",
            ownerId,
            aircraftId,
            aircraftRegistration,
            aircraftModel,
            fecha: "2026-09-14",
            cliente: "Frigorífico Concepción",
            ruta: "Asunción – Concepción – Asunción",
            horas: 2.0,
            precio: 1800,
            moneda: "USD",
            cobrado: true,
            pasajeros: 4,
            fuelModo: "litros",
            litros: 320,
            precioLt: 14200,
            precioLtCur: "GS",
            fuelTotal: null,
            fuelCur: "GS",
            pilotoHora: 100,
            pilotoHoraCur: "USD",
            planBase: 180000,
            planPersona: 15000,
            planCur: "GS",
            fuelPago: "credito",
            fuelDias: 30,
            fotoUrl: null,
        },
        {
            id: "demo-zpboc-f5",
            ownerId,
            aircraftId,
            aircraftRegistration,
            aircraftModel,
            fecha: "2026-09-24",
            cliente: "Inversiones del Sur S.A.",
            ruta: "Asunción – Pedro Juan Caballero – Asunción",
            horas: 2.8,
            precio: 2520,
            moneda: "USD",
            cobrado: true,
            pasajeros: 6,
            fuelModo: "litros",
            litros: 448,
            precioLt: 14200,
            precioLtCur: "GS",
            fuelTotal: null,
            fuelCur: "GS",
            pilotoHora: 100,
            pilotoHoraCur: "USD",
            planBase: 180000,
            planPersona: 15000,
            planCur: "GS",
            fuelPago: "contado",
            fuelDias: 30,
            fotoUrl: null,
        },
    ];

    const expenses: OperationalExpenseDoc[] = [
        {
            id: "demo-zpboc-g1",
            ownerId,
            aircraftId,
            aircraftRegistration,
            fecha: "2026-10-10",
            concepto: "Inspección de 50 horas y cambio de aceite",
            proveedor: "Taller Aeronáutico Astorga",
            monto: 380,
            moneda: "USD",
            tipo: "mantenimiento",
        },
        {
            id: "demo-zpboc-g2",
            ownerId,
            aircraftId,
            aircraftRegistration,
            fecha: "2026-10-18",
            concepto: "Catering ejecutivo y comisaría a bordo",
            proveedor: "Servicios Vip ASU",
            monto: 450000,
            moneda: "GS",
            tipo: "otro",
        },
    ];

    return { flights, expenses };
}

/**
 * Genera y comparte un reporte PDF ejecutivo de la operación y rentabilidad
 */
export async function generateOperationalReportPdf(
    periodLabel: string,
    stats: PeriodOperationalStats,
    fund: OverhaulFundStatus,
    cfg: AircraftOperationsConfig,
    ownerName: string
): Promise<void> {
    const flightRowsHtml = stats.list
        .slice()
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
        .map((v) => {
            const k = calcFlightFinancials(v, cfg);
            return `
            <tr>
                <td>${formatIsoToDmy(v.fecha)}</td>
                <td><strong>${v.cliente || "Sin cliente"}</strong><br/><span style="color:#64748B;font-size:10px;">${v.ruta || "—"}</span></td>
                <td style="text-align:center;">${formatHours(k.horas)}</td>
                <td style="text-align:right;">${formatUsd(k.ingreso)}</td>
                <td style="text-align:right;">${formatUsd(k.directo)}</td>
                <td style="text-align:right;">${formatUsd(k.reserva)}</td>
                <td style="text-align:right;font-weight:700;color:${k.resultado >= 0 ? "#0A7042" : "#BC3324"};">${formatSignedUsd(k.resultado)}</td>
            </tr>`;
        })
        .join("");

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8" />
        <title>Reporte Operativo ${cfg.aircraftRegistration} - ${periodLabel}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #091626; padding: 28px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1540C9; padding-bottom: 16px; margin-bottom: 24px; }
            .badge { font-family: monospace; color: #1540C9; font-weight: 700; font-size: 16px; letter-spacing: 1px; }
            .sub { color: #52647A; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
            .kpi-box { border: 1px solid #E7EDF5; border-radius: 10px; padding: 14px; background: #F4F7FC; }
            .kpi-label { font-size: 11px; text-transform: uppercase; color: #52647A; font-weight: 700; }
            .kpi-val { font-size: 22px; font-weight: 700; margin-top: 6px; }
            .kpi-gs { font-size: 11px; color: #52647A; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th { background: #091626; color: #FFF; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
            td { padding: 8px 10px; border-bottom: 1px solid #E7EDF5; }
            .section-title { font-size: 13px; text-transform: uppercase; color: #52647A; font-weight: 700; margin-top: 24px; margin-bottom: 8px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="badge">${cfg.aircraftRegistration} · ${cfg.aircraftModel}</div>
                <h1 style="margin:6px 0 2px;font-size:22px;">Estado Operativo y Rentabilidad (${periodLabel})</h1>
                <div class="sub">Propietario: ${ownerName} · Tipo de Cambio: ${num(cfg.tc).toLocaleString("es-PY")} Gs/USD</div>
            </div>
            <div style="text-align:right;">
                <div class="sub">ALTAVIA / ALTAGO</div>
                <div style="font-size:12px;color:#52647A;margin-top:4px;">Horas Voladas: <strong>${formatHours(stats.horas)}</strong></div>
                <div style="font-size:12px;color:#52647A;">Punto de Equilibrio: <strong>${stats.necesarias !== null ? formatHours(stats.necesarias) : "—"}</strong></div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-box">
                <div class="kpi-label">Cobramos (Ingresos)</div>
                <div class="kpi-val">${formatUsd(stats.ingreso)}</div>
                <div class="kpi-gs">${formatGsFromUsd(stats.ingreso, cfg)}</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Gastamos (Total Costos)</div>
                <div class="kpi-val">${formatUsd(stats.costoTotal)}</div>
                <div class="kpi-gs">${formatGsFromUsd(stats.costoTotal, cfg)}</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Quedó (Resultado Neto)</div>
                <div class="kpi-val" style="color:${stats.resultado >= 0 ? "#0A7042" : "#BC3324"};">${formatSignedUsd(stats.resultado)}</div>
                <div class="kpi-gs">${formatGsFromUsd(stats.resultado, cfg)}</div>
            </div>
        </div>

        <div class="section-title">Fondo de Reserva para Overhaul (Mantenimiento)</div>
        <div class="kpi-grid">
            <div class="kpi-box">
                <div class="kpi-label">Apartado por horas voladas</div>
                <div class="kpi-val">${formatUsd(fund.ap)}</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Ya gastado en mantenimiento</div>
                <div class="kpi-val">${formatUsd(fund.us)}</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Debería estar guardado</div>
                <div class="kpi-val" style="color:${fund.sa >= 0 ? "#0A7042" : "#BC3324"};">${formatUsd(fund.sa)}</div>
            </div>
        </div>

        <div class="section-title">Detalle de Vuelos del Período (${stats.vuelos})</div>
        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Cliente / Ruta</th>
                    <th style="text-align:center;">Horas</th>
                    <th style="text-align:right;">Cobrado</th>
                    <th style="text-align:right;">Costo Directo</th>
                    <th style="text-align:right;">Reserva</th>
                    <th style="text-align:right;">Deja el Vuelo</th>
                </tr>
            </thead>
            <tbody>
                ${flightRowsHtml || '<tr><td colspan="7" style="text-align:center;padding:18px;color:#64748B;">Sin vuelos registrados en este período</td></tr>'}
            </tbody>
        </table>
    </body>
    </html>
    `;

    if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
        await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: `Reporte Operativo ${cfg.aircraftRegistration} - ${periodLabel}`,
            UTI: "com.adobe.pdf",
        });
    }
}

