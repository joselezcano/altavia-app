import {
    Badge,
    ChipRow,
    DataRow,
    FIN_COLORS,
    InfoNote,
    KpiGrid,
    KpiTile,
    MonthSelector,
    SectionCard,
} from "@/components/admin-finance/finance-ui";
import { useAdminGioDataset, useAdminPaidReservations } from "@/hooks/useAdminBilling";
import { useAllAircrafts } from "@/hooks/useAllAircrafts";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { AdminBillingAircraftRef, BilledFlightRow, BillingDateBasis } from "@/types/admin-billing";
import { ChipOption } from "@/types/admin-finance-ui";
import { buildBilledFlightRows, summarizeBillingMonth } from "@/utils/admin-billing";
import {
    formatHours,
    formatIsoToDmy,
    formatUsd,
    getMonthKey,
    getTodayIso,
} from "@/utils/aircraft-operations-calc";
import { formatGs, formatPct } from "@/utils/business-plan";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

function toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BASIS_OPTIONS: ChipOption<BillingDateBasis>[] = [
    { value: "cobro", label: "Por fecha de cobro" },
    { value: "vuelo", label: "Por fecha de vuelo" },
];

/**
 * Facturación (ADMIN): tablero mensual de las reservas pagadas, con el margen contra los
 * costos directos reales de GIO. Solo datos reales.
 */
export default function AdminBillingScreen() {
    const [monthKey, setMonthKey] = useState(getMonthKey(getTodayIso()));
    const [aircraftFilter, setAircraftFilter] = useState<string>("all");
    const [basis, setBasis] = useState<BillingDateBasis>("cobro");

    const { data: aircrafts = [], isLoading: loadingAircraft } = useAllAircrafts();
    const reservationsQ = useAdminPaidReservations();
    const exchangeQ = useExchangeRate();
    const tc = exchangeQ.data?.dolar ?? 0;

    const gioRefs = useMemo<AdminBillingAircraftRef[]>(
        () =>
            aircrafts
                .filter((a) => !!a.ownerId && (aircraftFilter === "all" || a.id === aircraftFilter))
                .map((a) => ({
                    aircraftId: a.id,
                    ownerId: a.ownerId as string,
                    registration: a.basic_specs?.registration || "",
                    model: a.basic_specs?.model || "",
                })),
        [aircrafts, aircraftFilter]
    );
    const gio = useAdminGioDataset(gioRefs);

    const aircraftInfo = useMemo(() => {
        const map: Record<string, { registration: string; model: string }> = {};
        aircrafts.forEach((a) => {
            map[a.id] = { registration: a.basic_specs?.registration || "", model: a.basic_specs?.model || "" };
        });
        return map;
    }, [aircrafts]);

    const rows = useMemo(
        () => buildBilledFlightRows(reservationsQ.data ?? [], aircraftInfo, gio.byAircraft, basis),
        [reservationsQ.data, aircraftInfo, gio.byAircraft, basis]
    );

    const [year, month] = monthKey.split("-").map(Number);
    const { summary, monthRows } = useMemo(
        () => summarizeBillingMonth(rows, month - 1, year, aircraftFilter, tc),
        [rows, month, year, aircraftFilter, tc]
    );

    const aircraftOptions: ChipOption<string>[] = [
        { value: "all", label: "Todas" },
        ...aircrafts.map((a) => ({ value: a.id, label: a.basic_specs?.registration || a.id })),
    ];

    const isLoading = loadingAircraft || reservationsQ.isLoading || exchangeQ.isLoading;

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={FIN_COLORS.blue} />
                <Text style={styles.muted}>Cargando facturación…</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={reservationsQ.isRefetching} onRefresh={() => reservationsQ.refetch()} />
            }
        >
            <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
            <View style={{ gap: 8, marginBottom: 12 }}>
                <ChipRow options={aircraftOptions} value={aircraftFilter} onChange={setAircraftFilter} />
                <ChipRow options={BASIS_OPTIONS} value={basis} onChange={setBasis} />
            </View>

            {reservationsQ.isError ? (
                <InfoNote tone="warn" text="No se pudieron leer las reservas pagadas. Deslizá hacia abajo para reintentar." />
            ) : null}
            {gio.hasError ? (
                <InfoNote tone="warn" text="No se pudieron leer los datos de GIO de alguna aeronave: el margen puede estar incompleto." />
            ) : null}

            <SectionCard
                title="Resumen del mes"
                subtitle={`Reservas pagadas · tipo de cambio del día ${tc.toLocaleString("es-PY")} Gs/USD`}
            >
                <KpiGrid>
                    <KpiTile
                        label="Vuelos facturados"
                        value={String(summary.vuelos)}
                        sub={
                            summary.variacionVsMesAnteriorPct !== null
                                ? `${summary.variacionVsMesAnteriorPct >= 0 ? "+" : ""}${formatPct(summary.variacionVsMesAnteriorPct)} de facturación vs. mes anterior`
                                : "Sin comparación con el mes anterior"
                        }
                    />
                    <KpiTile
                        label="Facturado (IVA incl.)"
                        value={formatUsd(summary.facturadoUsd)}
                        sub={formatGs(summary.facturadoUsd, tc)}
                        tone="gold"
                    />
                    <KpiTile
                        label="Neto de IVA"
                        value={formatUsd(summary.netoUsd)}
                        sub={`${formatGs(summary.netoUsd, tc)} · IVA ${formatUsd(summary.ivaUsd)}`}
                    />
                    <KpiTile
                        label="Ticket promedio"
                        value={formatUsd(summary.ticketPromedioUsd)}
                        sub={summary.vuelos > 0 ? formatGs(summary.ticketPromedioUsd, tc) : "—"}
                    />
                    <KpiTile
                        label="Horas voladas"
                        value={summary.vuelosConHoras > 0 ? formatHours(summary.horas) : "—"}
                        sub={`GIO ${formatHours(summary.horasDeGio)} · cotización ${formatHours(summary.horasDeCotizacion)}`}
                    />
                    <KpiTile
                        label="Ingreso por hora"
                        value={summary.ingresoNetoPorHoraUsd !== null ? formatUsd(summary.ingresoNetoPorHoraUsd) : "—"}
                        sub={
                            summary.ingresoPorHoraUsd !== null
                                ? `Neto de IVA · ${formatUsd(summary.ingresoPorHoraUsd)} con IVA`
                                : "Sin horas cargadas"
                        }
                    />
                </KpiGrid>
            </SectionCard>

            <SectionCard
                title="Rendimiento"
                subtitle="Margen = ingreso neto de IVA − costos directos de GIO (combustible, piloto, tasas y hangaraje)."
            >
                {summary.vuelosConCostos === 0 ? (
                    <InfoNote text="Ningún vuelo del mes tiene fila en GIO todavía: no hay costos reales para calcular el margen." />
                ) : (
                    <>
                        <DataRow label="Ingreso neto (vuelos con GIO)" value={formatUsd(summary.netoConCostosUsd)} />
                        <DataRow label="Costos directos de GIO" value={formatUsd(summary.costoDirectoUsd)} />
                        <DataRow
                            label="Margen"
                            value={`${formatUsd(summary.margenUsd ?? 0)} · ${formatPct(summary.margenPct)}`}
                            sub={formatGs(summary.margenUsd ?? 0, tc)}
                            strong
                            tone={(summary.margenUsd ?? 0) >= 0 ? "ok" : "bad"}
                        />
                        <DataRow
                            label="Margen después de la reserva de overhaul"
                            value={formatUsd(summary.margenTrasReservaUsd ?? 0)}
                            sub={`Reserva ${formatUsd(summary.reservaOverhaulUsd)} (horas × reserva por hora de GIO)`}
                            tone={(summary.margenTrasReservaUsd ?? 0) >= 0 ? "ok" : "bad"}
                        />
                        {summary.vuelosConCostos < summary.vuelos ? (
                            <InfoNote
                                tone="warn"
                                text={`El margen considera ${summary.vuelosConCostos} de ${summary.vuelos} vuelos: el resto todavía no tiene fila en GIO.`}
                            />
                        ) : null}
                    </>
                )}
            </SectionCard>

            <SectionCard title={`Vuelos del mes (${monthRows.length})`}>
                {monthRows.length === 0 ? (
                    <Text style={styles.muted}>No hay reservas pagadas en este mes.</Text>
                ) : (
                    monthRows.map((r) => <BilledFlightCard key={r.reservationId} row={r} tc={tc} />)
                )}
            </SectionCard>
        </ScrollView>
    );
}

function BilledFlightCard({ row, tc }: { row: BilledFlightRow; tc: number }) {
    const hoursBadge =
        row.horasFuente === "gio"
            ? row.horasEstimadas
                ? { text: "GIO · estimadas", tone: "warn" as const }
                : { text: "GIO · Hobbs", tone: "ok" as const }
            : row.horasFuente === "cotizacion"
              ? { text: "Cotización", tone: "warn" as const }
              : { text: "Sin horas", tone: "bad" as const };

    return (
        <View style={styles.flight}>
            <View style={styles.flightTop}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.flightTitle} numberOfLines={1}>
                        {row.aircraftRegistration} · {row.route}
                    </Text>
                    <Text style={styles.flightSub} numberOfLines={1}>
                        {row.clientName || "Cliente sin nombre cargado"}
                    </Text>
                    <Text style={styles.flightSub}>
                        Cobro {row.paidAt ? formatIsoToDmy(toIso(row.paidAt)) : "—"} · Vuelo{" "}
                        {row.flightDate ? formatIsoToDmy(toIso(row.flightDate)) : "—"}
                        {row.invoiceNumber ? ` · Fact. ${row.invoiceNumber}` : ""}
                    </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.flightAmount}>{formatUsd(row.priceUsd)}</Text>
                    <Text style={styles.flightSub}>{formatGs(row.priceUsd, tc)}</Text>
                    <Text style={styles.flightSub}>Neto {formatUsd(row.netUsd)}</Text>
                </View>
            </View>
            <View style={styles.flightBottom}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.flightMeta}>{row.horas !== null ? formatHours(row.horas) : "—"}</Text>
                    <Badge text={hoursBadge.text} tone={hoursBadge.tone} />
                </View>
                {row.margenUsd !== null ? (
                    <Text style={[styles.flightMeta, row.margenUsd >= 0 ? styles.ok : styles.bad]}>
                        Margen {formatUsd(row.margenUsd)} · {formatPct(row.margenPct)}
                    </Text>
                ) : (
                    <Text style={styles.flightMetaMuted}>Sin costos en GIO</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: FIN_COLORS.light },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: FIN_COLORS.light },
    muted: {
    fontFamily: "NotoSans_400Regular", color: FIN_COLORS.muted, fontSize: 13, marginTop: 8 },
    flight: { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingVertical: 10 },
    flightTop: { flexDirection: "row", alignItems: "flex-start" },
    flightTitle: {
    fontFamily: "NotoSans_400Regular", fontSize: 14, fontWeight: "700", color: FIN_COLORS.blue },
    flightSub: {
    fontFamily: "NotoSans_400Regular", fontSize: 11, color: FIN_COLORS.muted, marginTop: 2 },
    flightAmount: {
    fontFamily: "NotoSans_400Regular", fontSize: 15, fontWeight: "800", color: FIN_COLORS.blue },
    flightBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    flightMeta: {
    fontFamily: "NotoSans_400Regular", fontSize: 12, fontWeight: "700", color: FIN_COLORS.text },
    flightMetaMuted: {
    fontFamily: "NotoSans_400Regular", fontSize: 12, color: FIN_COLORS.muted },
    ok: { color: FIN_COLORS.ok },
    bad: { color: FIN_COLORS.bad },
});
