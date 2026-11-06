export type OperationalCurrency = "USD" | "GS";

export type FuelCalculationMode = "litros" | "total";

export type FuelPaymentMethod = "contado" | "credito";

export type OperationalExpenseType = "mantenimiento" | "otro";

export type OperationalPeriodView = "M" | "Y";

export type FinanceModuleTab = "operations" | "sifen";

export interface FixedMonthlyExpense {
    id: string;
    n: string; // Nombre del gasto fijo (ej. "Hangaraje", "Administración")
    m: number; // Monto
    c: OperationalCurrency; // Moneda ("USD" | "GS")
}

export interface AircraftOperationsConfig {
    id?: string;
    ownerId: string;
    aircraftId: string;
    aircraftRegistration: string;
    aircraftModel: string;
    tc: number; // Tipo de cambio (Gs por USD, ej. 5970)
    consumoLt: number; // Litros por hora de vuelo (ej. 160)
    precioLtGs: number; // Guaraníes por litro de AVGAS (ej. 14200)
    pilotajeHora: number; // USD por hora de piloto (ej. 100)
    planBaseGs: number; // Gs base por plan de vuelo DINAC (ej. 180000)
    planPersonaGs: number; // Gs adicional por pasajero DINAC (ej. 15000)
    reservaHora: number; // USD por hora para fondo de overhaul (ej. 119)
    tarifaHora: number; // USD por hora de venta al cliente, IVA incluido (ej. 1000). Base de la cotización.
    pernocteUsd?: number; // USD por noche que se cobra al cliente si el avión pernocta fuera (ej. 100)
    hangarNocheUsd?: number; // USD de hangaraje por noche fuera de base (variable; editable por vuelo)
    pilotoPernocteUsd?: number; // USD por noche que se le paga al piloto (costo, ej. 100)
    factorBloque?: number; // horas Hobbs / horas en línea recta (ej. 1.12): ajusta la estimación de horas
    fijos: FixedMonthlyExpense[];
    updatedAt?: string;
}

export interface OperationalFlightDoc {
    id: string;
    ownerId: string;
    aircraftId: string;
    aircraftRegistration: string;
    aircraftModel: string;
    fecha: string; // Formato ISO YYYY-MM-DD
    cliente: string;
    ruta: string;
    horas: number;
    precio: number;
    moneda: OperationalCurrency;
    cobrado: boolean;
    pasajeros: number; // 0 a 7 (sin contar tripulación)
    fuelModo: FuelCalculationMode;
    litros: number | null;
    precioLt: number | null;
    precioLtCur: OperationalCurrency;
    fuelTotal: number | null;
    fuelCur: OperationalCurrency;
    pilotoHora: number | null;
    pilotoHoraCur: OperationalCurrency;
    planBase: number | null;
    planPersona: number | null;
    planCur: OperationalCurrency;
    fuelPago: FuelPaymentMethod;
    fuelDias: number; // Días de plazo si es a crédito (por defecto 30)
    fotoUrl: string | null; // URL o base64 del comprobante de plan de vuelo
    reservationId?: string | null; // Vínculo con la reserva de AltaGo (fila creada por syncReservationToGio)
    horasEstimadas?: boolean; // true mientras las horas sean la estimación por distancia (falta el Hobbs real)
    noches?: number; // noches fuera de base (de la reserva): costo de pernocte del piloto
    hangarUsd?: number | null; // hangaraje total pagado por el vuelo (USD)
    createdAt?: string;
    updatedAt?: string;
}

export interface OperationalFlightDraft {
    fecha: string;
    cliente: string;
    ruta: string;
    horas: string;
    precio: string;
    moneda: OperationalCurrency;
    cobrado: boolean;
    pasajeros: number;
    fuelModo: FuelCalculationMode;
    litros: string;
    precioLt: string;
    precioLtCur: OperationalCurrency;
    fuelTotal: string;
    fuelCur: OperationalCurrency;
    pilotoHora: string;
    pilotoHoraCur: OperationalCurrency;
    planBase: string;
    planPersona: string;
    planCur: OperationalCurrency;
    fuelPago: FuelPaymentMethod;
    fuelDias: string;
    fotoUrl: string | null;
}

export interface OperationalExpenseDoc {
    id: string;
    ownerId: string;
    aircraftId: string;
    aircraftRegistration: string;
    fecha: string; // Formato ISO YYYY-MM-DD
    concepto: string;
    proveedor: string;
    monto: number;
    moneda: OperationalCurrency;
    tipo: OperationalExpenseType; // "mantenimiento" (sale del fondo overhaul) | "otro" (resta del mes)
    createdAt?: string;
    updatedAt?: string;
}

export interface OperationalExpenseDraft {
    fecha: string;
    concepto: string;
    proveedor: string;
    monto: string;
    moneda: OperationalCurrency;
    tipo: OperationalExpenseType;
}

export interface FlightFinancialCalc {
    horas: number;
    ingreso: number; // En USD
    fuel: number; // En USD
    piloto: number; // En USD
    tasas: number; // En USD
    directo: number; // fuel + piloto + tasas (En USD)
    reserva: number; // horas * reservaHora (En USD)
    margen: number; // ingreso - directo (En USD)
    resultado: number; // ingreso - directo - reserva (En USD)
}

export interface PeriodOperationalStats {
    vuelos: number;
    horas: number;
    ingreso: number;
    fuel: number;
    piloto: number;
    tasas: number;
    directo: number;
    reserva: number;
    margen: number;
    otros: number;
    mant: number;
    fijos: number;
    costoTotal: number;
    resultado: number;
    contrib: number; // Margen de contribución por hora (USD)
    necesarias: number | null; // Horas necesarias para el punto de equilibrio
    activo: boolean;
    mesesActivos: number;
    list: OperationalFlightDoc[];
    glist: OperationalExpenseDoc[];
}

export interface OverhaulFundStatus {
    ap: number; // Apartado acumulado por las horas voladas (USD)
    us: number; // Ya gastado en mantenimiento (USD)
    sa: number; // Saldo que debería estar guardado (ap - us) (USD)
}

export interface FuelPaymentScheduleItem {
    flight: OperationalFlightDoc;
    dueDate: string; // YYYY-MM-DD
    amountUsd: number;
    isCredit: boolean;
    creditDays: number;
}

export interface MonthSummaryRow {
    monthKey: string; // YYYY-MM
    monthIndex: number; // 0-11
    monthName: string;
    stats: PeriodOperationalStats;
}

