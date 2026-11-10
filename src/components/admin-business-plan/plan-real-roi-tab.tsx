import { DataRow, FIN_COLORS, InfoNote, KpiGrid, KpiTile, SectionCard } from "@/components/admin-finance/finance-ui";
import { BusinessPlanTabProps } from "@/types/admin-finance-ui";
import { formatMonthLabel, formatSignedUsd, formatUsd } from "@/utils/aircraft-operations-calc";
import { buildPlanCostBase, computeCumulativeRealRoi, formatMonths, formatPct } from "@/utils/business-plan";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

function remainingText(meses: number | null): string {
    return meses === null ? "al ritmo actual no se recupera" : `faltan ${formatMonths(meses)} al ritmo actual`;
}

function ProgressBar({ pct }: { pct: number | null }) {
    const w = Math.max(0, Math.min(100, (pct ?? 0) * 100));
    return (
        <View style={styles.track}>
            <View style={[styles.fill, { width: `${w}%` }]} />
        </View>
    );
}

/** ROI acumulado real: suma del resultado real de los meses con datos de GIO contra la inversión. */
export function PlanRealRoiTab({ plan, cfg, flights, expenses }: BusinessPlanTabProps) {
    const roi = useMemo(() => {
        const base = buildPlanCostBase(plan, cfg);
        return computeCumulativeRealRoi(flights, expenses, cfg, base, {
            descontarBancard: plan.descontarBancard,
            descontarIre: plan.descontarIre,
            conCesa: plan.cesaVigente,
        });
    }, [plan, cfg, flights, expenses]);

    if (roi.meses.length === 0) {
        return <InfoNote text="Todavía no hay meses con vuelos o gastos cargados en GIO para esta aeronave." />;
    }

    return (
        <View>
            <SectionCard
                title="Recuperación real de la inversión"
                subtitle={`${roi.meses.length} ${roi.meses.length === 1 ? "mes" : "meses"} con datos en GIO`}
            >
                <KpiGrid>
                    <KpiTile
                        label="Resultado acumulado"
                        value={formatSignedUsd(roi.totalResultado)}
                        tone={roi.totalResultado >= 0 ? "ok" : "bad"}
                        sub={roi.promedioMensual !== null ? `Promedio ${formatSignedUsd(roi.promedioMensual)}/mes` : undefined}
                    />
                    <KpiTile
                        label="Recuperado (avión)"
                        value={formatPct(roi.pctRecuperadoAvion)}
                        sub={`de ${formatUsd(roi.inversionAvion)}`}
                        tone="gold"
                    />
                </KpiGrid>

                <Text style={styles.barLabel}>Solo avión · {remainingText(roi.mesesRestantesAvion)}</Text>
                <ProgressBar pct={roi.pctRecuperadoAvion} />
                <Text style={styles.barLabel}>
                    Avión + aviónica ({formatUsd(roi.inversionTotal)}) · {formatPct(roi.pctRecuperadoTotal)} ·{" "}
                    {remainingText(roi.mesesRestantesTotal)}
                </Text>
                <ProgressBar pct={roi.pctRecuperadoTotal} />
            </SectionCard>

            <SectionCard title="Mes a mes">
                {roi.meses.map((m) => (
                    <DataRow
                        key={m.monthKey}
                        label={formatMonthLabel(m.monthKey)}
                        sub={`Acumulado ${formatSignedUsd(m.acumulado)}`}
                        value={formatSignedUsd(m.resultado)}
                        tone={m.resultado >= 0 ? "ok" : "bad"}
                    />
                ))}
            </SectionCard>

            <InfoNote text="Se cuentan solo los meses con movimientos en GIO (los fijos de un mes sin vuelos ni gastos no entran). Mismo criterio que la Situación actual: ingreso neto de IVA, costos reales de GIO y fijos del plan." />
        </View>
    );
}

const styles = StyleSheet.create({
    barLabel: {
    fontFamily: "NotoSans_400Regular", fontSize: 12, color: FIN_COLORS.muted, marginTop: 12, marginBottom: 6 },
    track: { height: 12, borderRadius: 6, backgroundColor: "#EEF2F6", overflow: "hidden" },
    fill: { height: 12, borderRadius: 6, backgroundColor: FIN_COLORS.gold },
});
