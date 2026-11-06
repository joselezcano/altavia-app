import { AccountingFlightItem, AircraftRevenueShare, MonthlyAccountingMetrics } from "@/types/accounting";
import { ClientReservationItem } from "@/types/all-roles";
import { DEFAULT_USD_TO_PYG_RATE } from "@/types/exchange-rate";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export const USD_TO_PYG_RATE = DEFAULT_USD_TO_PYG_RATE;

export const MONTH_NAMES_ES = [
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
    "Diciembre"
];

// Helper to calculate IVA 10% and Net according to Paraguayan tax rules (SIFEN / DNIT)
export function calculateTaxBreakdown(amountUsd: number, rate = USD_TO_PYG_RATE) {
    const amountGs = Math.round(amountUsd * rate);
    const iva10Usd = Number((amountUsd / 11).toFixed(2));
    const iva10Gs = Math.round(amountGs / 11);
    const netAmountUsd = Number((amountUsd - iva10Usd).toFixed(2));
    const netAmountGs = amountGs - iva10Gs;

    return {
        amountUsd,
        amountGs,
        iva10Usd,
        iva10Gs,
        netAmountUsd,
        netAmountGs,
    };
}

// Convert Firestore reservation doc to AccountingFlightItem
export function mapReservationToAccountingItem(res: ClientReservationItem, exchangeRate = USD_TO_PYG_RATE): AccountingFlightItem {
    const flightDate = res.schedule?.outbound_flight_departure_time
        ? new Date(res.schedule.outbound_flight_departure_time)
        : res.created_at
            ? new Date(res.created_at)
            : new Date();

    const tax = calculateTaxBreakdown(res.price || 0, exchangeRate);

    const speed = res.cruise_speed_knots || 380;
    const distance = res.distance_nm || 220;
    const flightHours = Number((distance / speed).toFixed(1)) || 1.0;

    const isPaid = res.internal_status === "confirmed" || res.client_status === "confirmed" || !!res.paid_at;

    return {
        id: res.id,
        reservationCode: `RES-${res.id.slice(0, 6).toUpperCase()}`,
        flightDate,
        route: {
            originIdent: res.originAirport?.ident || res.trip?.origin_airport_ident || "ASU",
            originCity: res.originAirport?.municipality || "Asunción",
            destinationIdent: res.destinationAirport?.ident || res.trip?.destination_airport_ident || "AGT",
            destinationCity: res.destinationAirport?.municipality || "Ciudad del Este",
            roundtrip: !!res.schedule?.roundtrip,
        },
        aircraft: {
            id: res.aircraftId,
            model: res.aircraftSpecs?.basic_specs.model || "Cessna Citation CJ3",
            registration: res.aircraftSpecs?.basic_specs.registration || "ZP-BKL",
            photoUrl: res.aircraftSpecs?.profile_photo,
        },
        client: {
            id: res.clientId,
            name: "Cliente Altavia",
            company: "Corporativo Privado",
            email: "cliente@altavia.com",
            ruc: "80098765-4",
        },
        flightHours,
        distanceNm: distance,
        amountUsd: tax.amountUsd,
        amountGs: tax.amountGs,
        iva10Usd: tax.iva10Usd,
        iva10Gs: tax.iva10Gs,
        netAmountUsd: tax.netAmountUsd,
        netAmountGs: tax.netAmountGs,
        paymentStatus: isPaid ? "paid" : "pending",
        paymentMethod: res.payment_method || (isPaid ? "bancard_vpos" : "pending"),
        paymentDate: res.paid_at ? new Date(res.paid_at) : (isPaid ? flightDate : undefined),
        transactionId: res.payment_transaction_id || (isPaid ? `TX-${Math.floor(100000 + Math.random() * 900000)}` : undefined),
        invoiceNumber: res.invoice_number,
        invoiceTimbrado: res.invoice_timbrado,
        invoiceCdc: res.invoice_cdc,
        isMock: false,
    };
}

// Generate realistic mock flight records for demonstration across the months of current & past year
export function getDemoFlightHistory(ownerAircraftList: Array<{ id: string; model: string; registration: string }> = []): AccountingFlightItem[] {
    const primaryAircraft = ownerAircraftList[0] || {
        id: "ac-demo-1",
        model: "Cessna Citation CJ3+",
        registration: "ZP-BKL",
    };

    const secondaryAircraft = ownerAircraftList[1] || {
        id: "ac-demo-2",
        model: "Beechcraft King Air 350i",
        registration: "ZP-TMR",
    };

    const routes = [
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SGCO", destCity: "Ciudad del Este (AGT)", dist: 168, speed: 410, price: 3400, round: false },
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SGEN", destCity: "Encarnación (ENO)", dist: 155, speed: 380, price: 2900, round: true },
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SULS", destCity: "Punta del Este (PDP)", dist: 620, speed: 420, price: 8200, round: true },
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SABE", destCity: "Buenos Aires (AEP)", dist: 560, speed: 430, price: 7600, round: true },
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SGFI", destCity: "Filadelfia, Chaco (FLM)", dist: 240, speed: 310, price: 3800, round: false },
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SBGR", destCity: "San Pablo (GRU)", dist: 710, speed: 440, price: 9500, round: true },
        { origIdent: "SGAS", origCity: "Asunción (ASU)", destIdent: "SGAS", destCity: "Vuelo Panorámico Asunción", dist: 80, speed: 280, price: 1800, round: false },
        { origIdent: "SGCO", destIdent: "SGAS", origCity: "Ciudad del Este (AGT)", destCity: "Asunción (ASU)", dist: 168, speed: 410, price: 3400, round: false },
    ];

    const clients = [
        { name: "Ing. Rodrigo Caballero", company: "Agropecuaria Santa Rosa S.A.", ruc: "80012948-3", email: "rcaballero@santarosa.com.py" },
        { name: "Lic. Andrea Benítez", company: "Grupo Inmobiliario Zuccolillo", ruc: "80023847-1", email: "andrea.b@inmoz.com.py" },
        { name: "Dr. Carlos Montanaro", company: "Inversiones del Este S.A.", ruc: "80034729-5", email: "cmontanaro@investeste.com" },
        { name: "Valeria Duarte", company: "Banco Continental S.A.E.C.A.", ruc: "80045612-8", email: "vduarte@bancontinental.com.py" },
        { name: "Gustavo Riquelme", company: "Frigorífico Concepción", ruc: "80056903-4", email: "griquelme@concepcion.com.py" },
        { name: "Martín Pecci", company: "Logística y Puertos del Sur", ruc: "80067821-9", email: "mpecci@puertossur.com.py" },
        { name: "Patricia Vera", company: "Pharma Paraguay S.A.", ruc: "80078914-6", email: "pvera@pharmapy.com" },
    ];

    const currentYear = 2026;
    const demoItems: AccountingFlightItem[] = [];

    // Seed realistic flights for 6 months: Mayo, Junio, Julio, Agosto, Septiembre, Octubre 2026
    const monthsToSeed = [4, 5, 6, 7, 8, 9]; // May to Oct (10 is Oct in 0-indexed)

    let flightIndex = 100;
    for (const m of monthsToSeed) {
        // Between 4 and 8 flights per month
        const flightsInMonth = m === 9 ? 6 : (4 + (m % 3) * 2);

        for (let i = 0; i < flightsInMonth; i++) {
            flightIndex++;
            const day = Math.min(28, 2 + i * 4);
            const flightDate = new Date(currentYear, m, day, 9 + (i % 6), 30);
            const route = routes[(flightIndex + i) % routes.length];
            const client = clients[(flightIndex + i) % clients.length];
            const usePrimary = (i % 3) !== 0;
            const ac = usePrimary ? primaryAircraft : secondaryAircraft;

            const hours = Number(((route.dist / route.speed) * (route.round ? 2 : 1)).toFixed(1));
            const tax = calculateTaxBreakdown(route.price);
            const isBancard = i % 2 === 0;

            const serial = 4000 + flightIndex;
            const invoiceNumber = `001-001-000${serial}`;
            const timbrado = "17492831";
            const cdc = `01800987654001001000${serial}1${currentYear}${String(m + 1).padStart(2, "0")}${String(day).padStart(2, "0")}${Math.floor(1000000000 + Math.random() * 9000000000)}`;

            demoItems.push({
                id: `mock-res-${flightIndex}`,
                reservationCode: `ALT-${flightIndex}`,
                flightDate,
                route: {
                    originIdent: route.origIdent,
                    originCity: route.origCity,
                    destinationIdent: route.destIdent,
                    destinationCity: route.destCity,
                    roundtrip: route.round,
                },
                aircraft: {
                    id: ac.id,
                    model: ac.model,
                    registration: ac.registration,
                },
                client,
                flightHours: hours,
                distanceNm: route.dist * (route.round ? 2 : 1),
                amountUsd: tax.amountUsd,
                amountGs: tax.amountGs,
                iva10Usd: tax.iva10Usd,
                iva10Gs: tax.iva10Gs,
                netAmountUsd: tax.netAmountUsd,
                netAmountGs: tax.netAmountGs,
                paymentStatus: "paid",
                paymentMethod: isBancard ? "bancard_vpos" : "sipap_transfer",
                paymentDate: flightDate,
                transactionId: isBancard ? `BC-${Math.floor(1000000 + Math.random() * 9000000)}` : `SIPAP-${Math.floor(100000 + Math.random() * 900000)}`,
                invoiceNumber,
                invoiceTimbrado: timbrado,
                invoiceCdc: cdc,
                isMock: true,
            });
        }
    }

    return demoItems;
}

// Compute comprehensive accounting metrics for a given month and year
export function computeMonthlyMetrics(
    allFlights: AccountingFlightItem[],
    selectedMonth: number, // 0-11
    selectedYear: number,
    selectedAircraftId: string = "all"
): {
    metrics: MonthlyAccountingMetrics;
    filteredFlights: AccountingFlightItem[];
} {
    // Current month flights
    const currentMonthFlights = allFlights.filter((item) => {
        const d = item.flightDate;
        const matchesDate = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        const matchesAircraft = selectedAircraftId === "all" || item.aircraft.id === selectedAircraftId;
        return matchesDate && matchesAircraft;
    });

    // Previous month for comparison
    const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const prevMonthFlights = allFlights.filter((item) => {
        const d = item.flightDate;
        const matchesDate = d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        const matchesAircraft = selectedAircraftId === "all" || item.aircraft.id === selectedAircraftId;
        return matchesDate && matchesAircraft;
    });

    // Sort descending by flight date
    const sortedFlights = [...currentMonthFlights].sort((a, b) => b.flightDate.getTime() - a.flightDate.getTime());

    let totalRevenueUsd = 0;
    let totalRevenueGs = 0;
    let totalNetUsd = 0;
    let totalNetGs = 0;
    let totalIvaUsd = 0;
    let totalIvaGs = 0;
    let totalFlightHours = 0;
    let bancardUsd = 0;
    let transferUsd = 0;
    let otherUsd = 0;
    let paidCount = 0;
    let pendingCount = 0;

    const aircraftMap = new Map<string, {
        aircraftId: string;
        model: string;
        registration: string;
        revenueUsd: number;
        revenueGs: number;
        flightCount: number;
        flightHours: number;
    }>();

    for (const flight of currentMonthFlights) {
        if (flight.paymentStatus === "paid") {
            totalRevenueUsd += flight.amountUsd;
            totalRevenueGs += flight.amountGs;
            totalNetUsd += flight.netAmountUsd;
            totalNetGs += flight.netAmountGs;
            totalIvaUsd += flight.iva10Usd;
            totalIvaGs += flight.iva10Gs;
            paidCount++;

            if (flight.paymentMethod === "bancard_vpos") {
                bancardUsd += flight.amountUsd;
            } else if (flight.paymentMethod === "sipap_transfer") {
                transferUsd += flight.amountUsd;
            } else {
                otherUsd += flight.amountUsd;
            }
        } else {
            pendingCount++;
        }

        totalFlightHours += flight.flightHours;

        // Group by aircraft
        const acId = flight.aircraft.id || flight.aircraft.registration;
        const existing = aircraftMap.get(acId) || {
            aircraftId: acId,
            model: flight.aircraft.model,
            registration: flight.aircraft.registration,
            revenueUsd: 0,
            revenueGs: 0,
            flightCount: 0,
            flightHours: 0,
        };

        if (flight.paymentStatus === "paid") {
            existing.revenueUsd += flight.amountUsd;
            existing.revenueGs += flight.amountGs;
        }
        existing.flightCount += 1;
        existing.flightHours = Number((existing.flightHours + flight.flightHours).toFixed(1));
        aircraftMap.set(acId, existing);
    }

    const completedFlightsCount = currentMonthFlights.length;
    const avgTicketUsd = paidCount > 0 ? Math.round(totalRevenueUsd / paidCount) : 0;
    const avgPerHourUsd = totalFlightHours > 0 ? Math.round(totalRevenueUsd / totalFlightHours) : 0;

    // Previous month total revenue for comparison
    const prevRevenueUsd = prevMonthFlights
        .filter((f) => f.paymentStatus === "paid")
        .reduce((sum, f) => sum + f.amountUsd, 0);

    let revenueChangePercentage: number | undefined = undefined;
    if (prevRevenueUsd > 0) {
        revenueChangePercentage = Number((((totalRevenueUsd - prevRevenueUsd) / prevRevenueUsd) * 100).toFixed(1));
    }

    // Aircraft breakdown array with percentages
    const aircraftBreakdown: AircraftRevenueShare[] = Array.from(aircraftMap.values()).map((ac) => ({
        ...ac,
        percentage: totalRevenueUsd > 0 ? Number(((ac.revenueUsd / totalRevenueUsd) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.revenueUsd - a.revenueUsd);

    const metrics: MonthlyAccountingMetrics = {
        month: selectedMonth,
        year: selectedYear,
        monthName: MONTH_NAMES_ES[selectedMonth],
        totalRevenueUsd,
        totalRevenueGs,
        totalNetUsd,
        totalNetGs,
        totalIvaUsd,
        totalIvaGs,
        completedFlightsCount,
        totalFlightHours: Number(totalFlightHours.toFixed(1)),
        avgTicketUsd,
        avgPerHourUsd,
        revenueChangePercentage,
        aircraftBreakdown,
        paymentMethodsBreakdown: {
            bancardUsd,
            transferUsd,
            otherUsd,
        },
        statusCounts: {
            paid: paidCount,
            pending: pendingCount,
        },
    };

    return {
        metrics,
        filteredFlights: sortedFlights,
    };
}

// Generate & share a professional PDF report for the month
export async function generateAndShareMonthlyReportPdf(
    metrics: MonthlyAccountingMetrics,
    flights: AccountingFlightItem[],
    ownerName: string = "Propietario Altavia"
) {
    const formattedDate = new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    const flightRowsHtml = flights.map((f, index) => `
        <tr style="background-color: ${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
            <td style="padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #E2E8F0;">
                <strong>${f.flightDate.toLocaleDateString("es-PY", { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong><br/>
                <span style="color: #64748B; font-size: 10px;">${f.flightDate.toLocaleTimeString("es-PY", { hour: '2-digit', minute: '2-digit' })}</span>
            </td>
            <td style="padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #E2E8F0;">
                <strong>${f.route.originIdent} ➔ ${f.route.destinationIdent}</strong><br/>
                <span style="color: #64748B; font-size: 10px;">${f.route.originCity} - ${f.route.destinationCity}</span>
            </td>
            <td style="padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #E2E8F0;">
                <span style="background: #EEF2F6; color: #030436; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${f.aircraft.registration}</span><br/>
                <span style="color: #64748B; font-size: 10px;">${f.aircraft.model}</span>
            </td>
            <td style="padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #E2E8F0;">
                <strong>${f.client.company || f.client.name}</strong><br/>
                <span style="color: #64748B; font-size: 10px;">${f.invoiceNumber ? `Fact. Nº ${f.invoiceNumber}` : 'Sin Factura'}</span>
            </td>
            <td style="padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #E2E8F0; text-align: center;">
                <span style="background: ${f.paymentStatus === 'paid' ? '#DCFCE7' : '#FEF3C7'}; color: ${f.paymentStatus === 'paid' ? '#166534' : '#92400E'}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
                    ${f.paymentStatus === 'paid' ? 'COBRADO' : 'PENDIENTE'}
                </span>
            </td>
            <td style="padding: 10px 12px; font-size: 12px; font-weight: bold; border-bottom: 1px solid #E2E8F0; text-align: right; color: #030436;">
                USD $${f.amountUsd.toLocaleString("en-US")}<br/>
                <span style="color: #64748B; font-size: 10px; font-weight: normal;">Gs. ${f.amountGs.toLocaleString("es-PY")}</span>
            </td>
        </tr>
    `).join("");

    const aircraftRowsHtml = metrics.aircraftBreakdown.map((ac) => `
        <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 12px; font-size: 11px;">
                <strong>${ac.registration}</strong> (${ac.model})
            </td>
            <td style="padding: 8px 12px; font-size: 11px; text-align: center;">${ac.flightCount}</td>
            <td style="padding: 8px 12px; font-size: 11px; text-align: center;">${ac.flightHours} hrs</td>
            <td style="padding: 8px 12px; font-size: 11px; text-align: right; font-weight: bold; color: #030436;">
                USD $${ac.revenueUsd.toLocaleString("en-US")} (${ac.percentage}%)
            </td>
        </tr>
    `).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Reporte Financiero Mensual - ALTAVIA</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 30px;
                color: #030436;
                background-color: #FFFFFF;
                font-size: 12px;
            }
            .header-table { width: 100%; border-bottom: 2px solid #0165FF; padding-bottom: 16px; margin-bottom: 24px; }
            .kpi-container { display: flex; gap: 14px; margin-bottom: 24px; }
            .kpi-box {
                flex: 1;
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 8px;
                padding: 14px;
                text-align: center;
            }
            .kpi-title { font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
            .kpi-value { font-size: 18px; font-weight: bold; color: #030436; margin-top: 4px; }
            .kpi-sub { font-size: 10px; color: #0165FF; font-weight: 600; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #030436; color: #FFFFFF; padding: 10px 12px; font-size: 11px; text-align: left; }
            .section-title { font-size: 14px; font-weight: bold; color: #030436; margin-top: 20px; border-left: 4px solid #0165FF; padding-left: 8px; }
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="vertical-align: top;">
                    <div style="font-size: 24px; font-weight: 800; color: #030436; letter-spacing: 1px;">ALTAVIA</div>
                    <div style="font-size: 11px; color: #0165FF; font-weight: bold; margin-top: 2px;">REPORTE MENSUAL DE INGRESOS Y FACTURACIÓN</div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Titular: <strong>${ownerName}</strong></div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                    <div style="background: #030436; color: #FFFFFF; display: inline-block; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 13px;">
                        ${metrics.monthName.toUpperCase()} ${metrics.year}
                    </div>
                    <div style="font-size: 10px; color: #64748B; margin-top: 8px;">Emitido el: ${formattedDate}</div>
                </td>
            </tr>
        </table>

        <!-- KPI SUMMARY -->
        <div style="display: table; width: 100%; margin-bottom: 20px;">
            <div style="display: table-row;">
                <div style="display: table-cell; width: 25%; padding-right: 8px;">
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 3px solid #0165FF; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 9px; color: #64748B; font-weight: bold;">TOTAL INGRESOS BRUTOS</div>
                        <div style="font-size: 16px; font-weight: bold; color: #030436; margin: 4px 0;">USD $${metrics.totalRevenueUsd.toLocaleString("en-US")}</div>
                        <div style="font-size: 10px; color: #0165FF; font-weight: bold;">Gs. ${metrics.totalRevenueGs.toLocaleString("es-PY")}</div>
                    </div>
                </div>
                <div style="display: table-cell; width: 25%; padding-right: 8px;">
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 3px solid #059669; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 9px; color: #64748B; font-weight: bold;">BASE IMPONIBLE (NETO)</div>
                        <div style="font-size: 16px; font-weight: bold; color: #059669; margin: 4px 0;">USD $${metrics.totalNetUsd.toLocaleString("en-US")}</div>
                        <div style="font-size: 10px; color: #64748B;">Gs. ${metrics.totalNetGs.toLocaleString("es-PY")}</div>
                    </div>
                </div>
                <div style="display: table-cell; width: 25%; padding-right: 8px;">
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 3px solid #2563EB; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 9px; color: #64748B; font-weight: bold;">IVA 10% (SIFEN DNIT)</div>
                        <div style="font-size: 16px; font-weight: bold; color: #2563EB; margin: 4px 0;">USD $${metrics.totalIvaUsd.toLocaleString("en-US")}</div>
                        <div style="font-size: 10px; color: #64748B;">Gs. ${metrics.totalIvaGs.toLocaleString("es-PY")}</div>
                    </div>
                </div>
                <div style="display: table-cell; width: 25%;">
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 3px solid #030436; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 9px; color: #64748B; font-weight: bold;">VUELOS / HORAS</div>
                        <div style="font-size: 16px; font-weight: bold; color: #030436; margin: 4px 0;">${metrics.completedFlightsCount} vuelos</div>
                        <div style="font-size: 10px; color: #64748B;">${metrics.totalFlightHours} hrs voladas</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- AIRCRAFT BREAKDOWN -->
        <div class="section-title">DESGLOSE DE INGRESOS POR AERONAVE</div>
        <table>
            <thead>
                <tr>
                    <th>Aeronave</th>
                    <th style="text-align: center;">Vuelos</th>
                    <th style="text-align: center;">Horas</th>
                    <th style="text-align: right;">Total Facturado (USD)</th>
                </tr>
            </thead>
            <tbody>
                ${aircraftRowsHtml}
            </tbody>
        </table>

        <!-- FLIGHT DETAIL LEDGER -->
        <div class="section-title" style="margin-top: 24px;">DETALLE DE VUELOS Y TRANSACCIONES REGISTRADAS</div>
        <table>
            <thead>
                <tr>
                    <th>Fecha & Hora</th>
                    <th>Ruta</th>
                    <th>Aeronave</th>
                    <th>Cliente / Factura</th>
                    <th style="text-align: center;">Estado</th>
                    <th style="text-align: right;">Monto Total</th>
                </tr>
            </thead>
            <tbody>
                ${flightRowsHtml}
            </tbody>
        </table>

        <!-- FOOTER -->
        <div style="margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 12px; text-align: center; color: #94A3B8; font-size: 9px;">
            Documento emitido por el Sistema de Gestión Aeronáutica ALTAVIA • RUC 80098765-4 • Asunción, Paraguay
        </div>
    </body>
    </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: `Reporte Contable Altavia - ${metrics.monthName} ${metrics.year}`,
            UTI: "com.adobe.pdf",
        });
    }
}
