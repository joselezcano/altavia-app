export type OperationalCurrency = "USD" | "GS";

export type FuelCalculationMode = "litros" | "total";

export type FuelPaymentMethod = "contado" | "credito";

export type OperationalExpenseType = "mantenimiento" | "otro";

export type OperationalPeriodView = "M" | "Y";

/** Secciones de GIO: Mes, Año o Cuentas por pagar ("P"). */
export type GioSectionView = OperationalPeriodView | "P";

/** Condición de pago de un gasto suelto. Sin el campo (documentos viejos) = "contado". */
export type PaymentCondition = "contado" | "credito";

/** Estado de pago de una compra a crédito. Sin el campo (documentos viejos) = "pagado". */
export type PayableStatus = "pendiente" | "pagado";

export type PayableMethod = "transferencia" | "efectivo" | "cheque" | "tarjeta" | "otro";

/** Origen de una cuenta por pagar: gasto suelto o combustible de un vuelo. */
export type PayableKind = "gasto" | "combustible";

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
    tarifaHora: number; // USD por hora de venta al cliente, SIN IVA (ej. 900). Base de la cotización; el cliente paga + IVA.
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
    // Cuentas por pagar del combustible a crédito (opcionales; el vencimiento sale de fuelDias).
    fuelProveedor?: string | null;
    fuelFacturaNumero?: string | null;
    fuelFacturaFotoUrl?: string | null;
    fuelEstadoPago?: PayableStatus | null;
    fuelFechaPago?: string | null; // YYYY-MM-DD
    fuelMedioPago?: PayableMethod | null;
    fuelReciboFotoUrl?: string | null;
    fuelNotasPago?: string | null;
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
    // Cuentas por pagar (opcionales). Sin condicionPago el gasto es "contado, pagado" en su fecha.
    condicionPago?: PaymentCondition | null;
    proveedorRuc?: string | null;
    facturaNumero?: string | null;
    facturaFecha?: string | null; // YYYY-MM-DD
    vencimiento?: string | null; // YYYY-MM-DD (por defecto, factura + 30 días)
    facturaFotoUrl?: string | null;
    estadoPago?: PayableStatus | null;
    fechaPago?: string | null; // YYYY-MM-DD
    medioPago?: PayableMethod | null;
    reciboFotoUrl?: string | null;
    notasPago?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

/** Ítem unificado de "Cuentas por pagar" (gasto a crédito o combustible a crédito). */
export interface PayableItem {
    key: string; // "gasto-<id>" | "combustible-<id>"
    kind: PayableKind;
    sourceId: string; // id del gasto o del vuelo
    ownerId: string;
    concepto: string;
    proveedor: string;
    proveedorRuc: string | null;
    facturaNumero: string | null;
    facturaFotoUrl: string | null;
    fecha: string; // fecha del gasto o del vuelo (YYYY-MM-DD)
    vencimiento: string; // YYYY-MM-DD
    amountUsd: number;
    esCredito: boolean;
    estado: PayableStatus;
    fechaPago: string | null;
    medioPago: PayableMethod | null;
    reciboFotoUrl: string | null;
    notasPago: string | null;
    pagoAsumido: boolean; // combustible a crédito viejo, ya vencido y sin pago registrado: se asume pagado
    vencido: boolean; // pendiente con vencimiento anterior a hoy
    diasParaVencer: number; // negativo si ya venció
    expense?: OperationalExpenseDoc;
    flight?: OperationalFlightDoc;
}

/** Datos del formulario "Registrar pago". */
export interface PayablePaymentInput {
    fechaPago: string;
    medioPago: PayableMethod;
    reciboUri: string | null; // URL ya subida o URI local a subir
    notasPago: string;
}

export interface AccountsPayableSummary {
    pendientes: PayableItem[]; // ordenados por vencimiento
    pagadosMes: PayableItem[]; // compras a crédito pagadas en el mes elegido
    totalPendienteUsd: number;
    totalVencidoUsd: number;
    cantidadVencidos: number;
    totalPagadoMesUsd: number;
    totalContadoMesUsd: number; // gastos y combustible al contado del mes elegido
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


/** Props de PayablePaymentModal (registrar el pago de una compra a crédito). */
export interface PayablePaymentModalProps {
    visible: boolean;
    item: PayableItem | null;
    config: AircraftOperationsConfig;
    isSaving: boolean;
    onClose: () => void;
    onConfirm: (input: PayablePaymentInput) => Promise<void>;
}

/** Props de AccountsPayablePanel (sección "Por pagar" de GIO). */
export interface AccountsPayablePanelProps {
    summary: AccountsPayableSummary;
    config: AircraftOperationsConfig;
    monthKey: string;
    onShiftMonth: (delta: number) => void;
    busyKey: string | null; // ítem con una operación en curso (deshacer)
    onRegisterPayment: (item: PayableItem) => void;
    onUndoPayment: (item: PayableItem) => void;
    onOpenPhoto: (uri: string) => void;
    onOpenItem: (item: PayableItem) => void;
}
