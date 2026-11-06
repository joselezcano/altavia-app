/**
 * Facturación del ADMIN: reservas pagadas cruzadas con GIO.
 *
 * Solo datos reales. NO usa mapReservationToAccountingItem (inventa cliente, aeronave por
 * defecto y transactionId); arma los AccountingFlightItem a mano y reutiliza
 * computeMonthlyMetrics para los totales, el IVA, el ticket y la variación mensual.
 */
import { AccountingFlightItem } from "@/types/accounting";
import {
    AdminGioAircraftData,
    BilledFlightRow,
    BillingAircraftInfo,
    BillingDateBasis,
    BillingMonthSummary,
    PaidReservationRecord,
} from "@/types/admin-billing";
import { calcFlightFinancials, num } from "@/utils/aircraft-operations-calc";
import { calculateTaxBreakdown, computeMonthlyMetrics } from "@/utils/accounting-data";

/** ID de la fila de GIO que crea syncReservationToGio (functions/src/gio-sync.ts). */
export function gioFlightIdForReservation(reservationId: string): string {
    return `res_${reservationId}`;
}

function routeLabel(r: PaidReservationRecord): string {
    const parts = [r.originIdent, r.destinationIdent, r.roundtrip ? r.originIdent : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" → ") : "Ruta sin datos";
}

export function buildBilledFlightRows(
    reservations: PaidReservationRecord[],
    aircraftInfo: Record<string, BillingAircraftInfo>,
    gioByAircraft: Record<string, AdminGioAircraftData>,
    basis: BillingDateBasis
): BilledFlightRow[] {
    return reservations
        .map((r): BilledFlightRow | null => {
            const billingDate = basis === "cobro" ? r.paidAt ?? r.flightDate : r.flightDate ?? r.paidAt;
            if (!billingDate) return null;

            const gio = gioByAircraft[r.aircraftId];
            const gioFlight =
                gio?.flights.find(
                    (f) => f.reservationId === r.id || f.id === gioFlightIdForReservation(r.id)
                ) ?? null;
            const fin = gioFlight && gio?.cfg ? calcFlightFinancials(gioFlight, gio.cfg) : null;

            const ivaUsd = r.priceUsd - r.priceUsd / 1.1;
            const netUsd = r.priceUsd / 1.1;

            let horas: number | null = null;
            let horasFuente: BilledFlightRow["horasFuente"] = "sin_dato";
            if (gioFlight && num(gioFlight.horas) > 0) {
                horas = num(gioFlight.horas);
                horasFuente = "gio";
            } else if (r.billableHours) {
                horas = r.billableHours;
                horasFuente = "cotizacion";
            }

            const info = aircraftInfo[r.aircraftId];
            const costoDirectoUsd = fin ? fin.directo : null;
            const margenUsd = costoDirectoUsd !== null ? netUsd - costoDirectoUsd : null;

            return {
                reservationId: r.id,
                aircraftId: r.aircraftId,
                aircraftRegistration: info?.registration || gioFlight?.aircraftRegistration || "Sin matrícula",
                aircraftModel: info?.model || gioFlight?.aircraftModel || "",
                clientName: r.clientName || (gioFlight?.cliente ? gioFlight.cliente : null),
                route: gioFlight?.ruta || routeLabel(r),
                billingDate,
                paidAt: r.paidAt,
                flightDate: r.flightDate,
                priceUsd: r.priceUsd,
                ivaUsd,
                netUsd,
                horas,
                horasFuente,
                horasEstimadas: horasFuente === "gio" ? gioFlight?.horasEstimadas === true : horasFuente === "cotizacion",
                costoDirectoUsd,
                reservaOverhaulUsd: fin ? fin.reserva : null,
                margenUsd,
                margenPct: margenUsd !== null && netUsd > 0 ? margenUsd / netUsd : null,
                gioFlightId: gioFlight?.id ?? null,
                internalStatus: r.internalStatus,
                paymentMethod: r.paymentMethod,
                invoiceNumber: r.invoiceNumber,
            };
        })
        .filter((x): x is BilledFlightRow => x !== null);
}

function toAccountingItem(row: BilledFlightRow, tc: number): AccountingFlightItem {
    const tax = calculateTaxBreakdown(row.priceUsd, tc);
    return {
        id: row.reservationId,
        reservationCode: `RES-${row.reservationId.slice(0, 6).toUpperCase()}`,
        flightDate: row.billingDate,
        route: { originIdent: "", originCity: "", destinationIdent: "", destinationCity: "", roundtrip: false },
        aircraft: { id: row.aircraftId, model: row.aircraftModel, registration: row.aircraftRegistration },
        client: { name: row.clientName || "" },
        flightHours: row.horas ?? 0,
        distanceNm: 0,
        amountUsd: tax.amountUsd,
        amountGs: tax.amountGs,
        iva10Usd: tax.iva10Usd,
        iva10Gs: tax.iva10Gs,
        netAmountUsd: tax.netAmountUsd,
        netAmountGs: tax.netAmountGs,
        paymentStatus: "paid",
        paymentMethod: row.paymentMethod || "",
        paymentDate: row.paidAt ?? undefined,
        invoiceNumber: row.invoiceNumber ?? undefined,
        isMock: false,
    };
}

/** month: 0-11. aircraftId: "all" o el id de una aeronave. */
export function summarizeBillingMonth(
    rows: BilledFlightRow[],
    month: number,
    year: number,
    aircraftId: string,
    tc: number
): { summary: BillingMonthSummary; monthRows: BilledFlightRow[] } {
    const { metrics, filteredFlights } = computeMonthlyMetrics(
        rows.map((r) => toAccountingItem(r, tc)),
        month,
        year,
        aircraftId
    );
    const ids = new Set(filteredFlights.map((f) => f.id));
    const monthRows = rows
        .filter((r) => ids.has(r.reservationId))
        .sort((a, b) => b.billingDate.getTime() - a.billingDate.getTime());

    const conHoras = monthRows.filter((r) => r.horas !== null && r.horas > 0);
    const horas = conHoras.reduce((acc, r) => acc + (r.horas ?? 0), 0);
    const brutoConHoras = conHoras.reduce((acc, r) => acc + r.priceUsd, 0);
    const netoConHoras = conHoras.reduce((acc, r) => acc + r.netUsd, 0);

    const conCostos = monthRows.filter((r) => r.costoDirectoUsd !== null);
    const netoConCostosUsd = conCostos.reduce((acc, r) => acc + r.netUsd, 0);
    const costoDirectoUsd = conCostos.reduce((acc, r) => acc + (r.costoDirectoUsd ?? 0), 0);
    const reservaOverhaulUsd = conCostos.reduce((acc, r) => acc + (r.reservaOverhaulUsd ?? 0), 0);
    const margenUsd = conCostos.length > 0 ? netoConCostosUsd - costoDirectoUsd : null;

    return {
        monthRows,
        summary: {
            vuelos: metrics.statusCounts.paid,
            facturadoUsd: metrics.totalRevenueUsd,
            facturadoGs: metrics.totalRevenueGs,
            netoUsd: metrics.totalNetUsd,
            netoGs: metrics.totalNetGs,
            ivaUsd: metrics.totalIvaUsd,
            ivaGs: metrics.totalIvaGs,
            ticketPromedioUsd: metrics.avgTicketUsd,
            horas,
            vuelosConHoras: conHoras.length,
            horasDeGio: conHoras.filter((r) => r.horasFuente === "gio").reduce((a, r) => a + (r.horas ?? 0), 0),
            horasDeCotizacion: conHoras
                .filter((r) => r.horasFuente === "cotizacion")
                .reduce((a, r) => a + (r.horas ?? 0), 0),
            ingresoPorHoraUsd: horas > 0 ? brutoConHoras / horas : null,
            ingresoNetoPorHoraUsd: horas > 0 ? netoConHoras / horas : null,
            vuelosConCostos: conCostos.length,
            netoConCostosUsd,
            costoDirectoUsd,
            reservaOverhaulUsd,
            margenUsd,
            margenPct: margenUsd !== null && netoConCostosUsd > 0 ? margenUsd / netoConCostosUsd : null,
            margenTrasReservaUsd: margenUsd !== null ? margenUsd - reservaOverhaulUsd : null,
            variacionVsMesAnteriorPct:
                metrics.revenueChangePercentage !== undefined ? metrics.revenueChangePercentage / 100 : null,
        },
    };
}
