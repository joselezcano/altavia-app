import { AircraftOperationsConfig, OperationalExpenseDoc, OperationalFlightDoc } from "@/types/aircraft-operations";

/** Mes al que se imputa una reserva pagada: por la fecha de cobro o por la fecha del vuelo. */
export type BillingDateBasis = "cobro" | "vuelo";

/** Reserva pagada (aircraft-reservation con client_status 'confirmed'), solo con datos reales. */
export interface PaidReservationRecord {
    id: string;
    aircraftId: string;
    clientId: string | null;
    clientName: string | null; // null si el cliente no tiene nombre cargado
    priceUsd: number; // IVA incluido
    billableHours: number | null;
    paidAt: Date | null;
    flightDate: Date | null;
    originIdent: string | null;
    destinationIdent: string | null;
    roundtrip: boolean;
    internalStatus: string | null;
    paymentMethod: string | null;
    paymentTransactionId: string | null;
    invoiceNumber: string | null;
}

export type BilledHoursSource = "gio" | "cotizacion" | "sin_dato";

export interface BilledFlightRow {
    reservationId: string;
    aircraftId: string;
    aircraftRegistration: string;
    aircraftModel: string;
    clientName: string | null;
    route: string;
    billingDate: Date;
    paidAt: Date | null;
    flightDate: Date | null;
    priceUsd: number;
    ivaUsd: number;
    netUsd: number;
    horas: number | null;
    horasFuente: BilledHoursSource;
    horasEstimadas: boolean; // la fila de GIO todavía tiene las horas estimadas (falta el Hobbs real)
    costoDirectoUsd: number | null; // combustible + piloto + tasas de GIO
    reservaOverhaulUsd: number | null;
    margenUsd: number | null; // neto − costo directo
    margenPct: number | null;
    gioFlightId: string | null;
    internalStatus: string | null;
    paymentMethod: string | null;
    invoiceNumber: string | null;
}

export interface BillingMonthSummary {
    vuelos: number;
    facturadoUsd: number;
    facturadoGs: number;
    netoUsd: number;
    netoGs: number;
    ivaUsd: number;
    ivaGs: number;
    ticketPromedioUsd: number;
    horas: number;
    vuelosConHoras: number;
    horasDeGio: number;
    horasDeCotizacion: number;
    ingresoPorHoraUsd: number | null; // facturado (IVA incluido) ÷ horas, solo vuelos con horas
    ingresoNetoPorHoraUsd: number | null;
    vuelosConCostos: number;
    netoConCostosUsd: number;
    costoDirectoUsd: number;
    reservaOverhaulUsd: number;
    margenUsd: number | null;
    margenPct: number | null;
    margenTrasReservaUsd: number | null;
    variacionVsMesAnteriorPct: number | null;
}

export interface BillingAircraftInfo {
    registration: string;
    model: string;
}

/** Aeronave con su dueño real (las reglas de GIO piden filtrar por ownerId y aircraftId). */
export interface AdminBillingAircraftRef {
    aircraftId: string;
    ownerId: string;
    registration: string;
    model: string;
}

export interface AdminGioAircraftData {
    aircraftId: string;
    ownerId: string;
    cfg: AircraftOperationsConfig | null;
    flights: OperationalFlightDoc[];
    expenses: OperationalExpenseDoc[];
}

export interface AdminGioDataset {
    byAircraft: Record<string, AdminGioAircraftData>;
    isLoading: boolean;
    hasError: boolean;
}
