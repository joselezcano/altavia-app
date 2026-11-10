import {
    ChipRow,
    FIN_COLORS,
    InfoNote,
    KpiGrid,
    KpiTile,
    MonthSelector,
    SectionCard,
} from "@/components/admin-finance/finance-ui";
import { BusinessPlanTabProps, ChipOption } from "@/types/admin-finance-ui";
import { BUSINESS_PLAN_SCENARIO_IDS, BusinessPlanScenarioId, PlanDeviationRow } from "@/types/business-plan";
import {
    computeMonthStats,
    formatHours,
    formatSignedUsd,
    formatUsd,
    getMonthKey,
    getTodayIso,
} from "@/utils/aircraft-operations-calc";
import {
    buildDeviationRows,
    buildPlanCostBase,
    computeRealMonth,
    computeScenarioTable,
    findScenario,
    formatGs,
    formatPct,
    getTarifaHoy,
    SCENARIO_LABELS,
} from "@/utils/business-plan";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const SCENARIO_OPTIONS: ChipOption<BusinessPlanScenarioId>[] = BUSINESS_PLAN_SCENARIO_IDS.map((id) => ({
    value: id,
    label: SCENARIO_LABELS[id],
}));

/** Situación actual: el mes elegido, real (GIO) contra el escenario del plan. */
export function PlanCurrentTab({ plan, cfg, flights, expenses }: BusinessPlanTabProps) {
    const [monthKey, setMonthKey] = useState(getMonthKey(getTodayIso()));
    const [scenarioId, setScenarioId] = useState<BusinessPlanScenarioId>(plan.escenarioReferencia);

    const base = useMemo(() => buildPlanCostBase(plan, cfg), [plan, cfg]);

    const real = useMemo(() => {
        const stats = computeMonthStats(monthKey, flights, expenses, cfg);
        return computeRealMonth(monthKey, stats, base, {
            descontarBancard: plan.descontarBancard,
            descontarIre: plan.descontarIre,
            conCesa: plan.cesaVigente,
            cobrarFijosSinActividad: true,
        });
    }, [monthKey, flights, expenses, cfg, base, plan]);

    const planned = useMemo(() => {
        const table = computeScenarioTable(base, plan, getTarifaHoy(cfg), {
            descontarBancard: plan.descontarBancard,
            descontarIre: plan.descontarIre,
        });
        return findScenario(table, scenarioId) ?? table[1];
    }, [base, plan, cfg, scenarioId]);

    const deviations = useMemo(() => buildDeviationRows(real, planned), [real, planned]);

    const eqReal = real.equilibrioHorasMes;
    const eqPlan = planned.equilibrioHorasMes;

    return (
        <View>
            <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
            <Text style={styles.label}>Comparar contra el escenario</Text>
            <ChipRow options={SCENARIO_OPTIONS} value={scenarioId} onChange={setScenarioId} />

            <View style={{ height: 12 }} />
            {!real.conDatos ? (
                <InfoNote
                    tone="warn"
                    text="Este mes no tiene vuelos ni gastos cargados en GIO. Lo real muestra solo los gastos fijos del mes."
                />
            ) : null}

            <SectionCard
                title="Real contra plan"
                subtitle={`Real: GIO del mes · Plan: ${planned.input.etiqueta} (${formatHours(planned.input.horasMes)}, USD ${planned.input.tarifaHora.toLocaleString("es-PY")}/h sin IVA)`}
            >
                <KpiGrid>
                    <KpiTile
                        label="Resultado real"
                        value={formatSignedUsd(real.resultado)}
                        sub={formatGs(real.resultado, base.tc)}
                        tone={real.resultado >= 0 ? "ok" : "bad"}
                    />
                    <KpiTile
                        label="Resultado plan"
                        value={formatSignedUsd(planned.resultado)}
                        sub={`Desvío ${formatSignedUsd(real.resultado - planned.resultado)}`}
                        tone={planned.resultado >= 0 ? "ok" : "bad"}
                    />
                    <KpiTile
                        label="Horas real / plan"
                        value={`${formatHours(real.horas)}`}
                        sub={`Plan ${formatHours(planned.input.horasMes)} · ${real.vuelos} vuelos`}
                    />
                    <KpiTile
                        label="Punto de equilibrio"
                        value={eqReal !== null ? formatHours(eqReal) : "—"}
                        sub={`Real del mes · plan ${eqPlan !== null ? formatHours(eqPlan) : "—"}`}
                        tone="gold"
                    />
                </KpiGrid>
                <EquilibriumBar horas={real.horas} equilibrio={eqReal ?? eqPlan} />
            </SectionCard>

            <SectionCard title="Desvíos" subtitle="Real − plan. Verde: a favor; rojo: en contra.">
                <View style={styles.headRow}>
                    <Text style={[styles.headCell, { flex: 1.6, textAlign: "left" }]}>Concepto</Text>
                    <Text style={styles.headCell}>Real</Text>
                    <Text style={styles.headCell}>Plan</Text>
                    <Text style={styles.headCell}>Desvío</Text>
                </View>
                {deviations.map((d) => (
                    <DeviationLine key={d.id} row={d} />
                ))}
            </SectionCard>

            <InfoNote
                text={`Ingreso real = precio cargado en GIO (sin IVA). Costos reales: combustible, piloto, tasas y hangaraje de cada vuelo en GIO, reserva de overhaul por hora y gastos sueltos que no son mantenimiento. Fijos: los de GIO sin seguro ni habilitaciones, más el seguro ${plan.cesaVigente ? "con" : "sin"} CESA y las inspecciones del plan.${plan.descontarBancard ? " Se descuenta la comisión de Bancard." : ""}${plan.descontarIre ? " Se descuenta el IRE estimado sobre la utilidad." : ""}`}
            />
        </View>
    );
}

function DeviationLine({ row }: { row: PlanDeviationRow }) {
    const fmt = (v: number) => (row.unidad === "horas" ? formatHours(v) : formatUsd(v));
    const favorable = row.mejorSiMayor ? row.desvio >= 0 : row.desvio <= 0;
    const neutral = Math.abs(row.desvio) < 0.5;
    const isResult = row.id === "resultado";
    return (
        <View style={[styles.line, isResult ? styles.lineStrong : null]}>
            <Text style={[styles.cellLabel, isResult ? styles.strong : null]}>{row.concepto}</Text>
            <Text style={[styles.cell, isResult ? styles.strong : null]}>{fmt(row.real)}</Text>
            <Text style={styles.cell}>{fmt(row.plan)}</Text>
            <Text style={[styles.cell, neutral ? null : favorable ? styles.ok : styles.bad]}>
                {row.unidad === "horas"
                    ? (row.desvio >= 0 ? "+" : "−") + formatHours(Math.abs(row.desvio))
                    : formatSignedUsd(row.desvio)}
                {row.desvioPct !== null && !neutral ? `\n${formatPct(row.desvioPct, 0)}` : ""}
            </Text>
        </View>
    );
}

function EquilibriumBar({ horas, equilibrio }: { horas: number; equilibrio: number | null }) {
    if (equilibrio === null || equilibrio <= 0) {
        return <InfoNote text="Sin punto de equilibrio: la contribución por hora no cubre los costos variables." />;
    }
    const max = Math.max(equilibrio * 2, horas, 1);
    const fill = Math.min(100, (horas / max) * 100);
    const mark = Math.min(100, (equilibrio / max) * 100);
    const ok = horas >= equilibrio;
    return (
        <View style={{ marginTop: 12 }}>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${fill}%` }, ok ? styles.fillOk : styles.fillBad]} />
                <View style={[styles.mark, { left: `${mark}%` }]} />
            </View>
            <Text style={styles.barNote}>
                {ok
                    ? "Superó el equilibrio: cada hora de más deja ganancia."
                    : `Faltan ${formatHours(equilibrio - horas)} para el equilibrio (marca dorada).`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    label: {
    fontFamily: "NotoSans_400Regular", fontSize: 12, fontWeight: "700", color: FIN_COLORS.muted, marginBottom: 6 },
    headRow: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: FIN_COLORS.border },
    headCell: {
    fontFamily: "NotoSans_400Regular", flex: 1, fontSize: 10, fontWeight: "700", color: FIN_COLORS.muted, textAlign: "right", textTransform: "uppercase" },
    line: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    lineStrong: { backgroundColor: FIN_COLORS.light },
    cellLabel: {
    fontFamily: "NotoSans_400Regular", flex: 1.6, fontSize: 12, color: "#334155", paddingRight: 4 },
    cell: {
    fontFamily: "NotoSans_400Regular", flex: 1, fontSize: 12, color: FIN_COLORS.text, textAlign: "right", fontWeight: "600" },
    strong: {
    fontFamily: "NotoSans_400Regular", fontWeight: "800", color: FIN_COLORS.blue },
    ok: { color: FIN_COLORS.ok },
    bad: { color: FIN_COLORS.bad },
    track: { height: 14, borderRadius: 7, backgroundColor: "#EEF2F6", overflow: "visible", position: "relative" },
    fill: { height: 14, borderRadius: 7 },
    fillOk: { backgroundColor: FIN_COLORS.ok },
    fillBad: { backgroundColor: FIN_COLORS.bad },
    mark: { position: "absolute", top: -4, width: 3, height: 22, marginLeft: -1, backgroundColor: FIN_COLORS.gold, borderRadius: 2 },
    barNote: {
    fontFamily: "NotoSans_400Regular", fontSize: 11, color: FIN_COLORS.muted, marginTop: 8 },
});
