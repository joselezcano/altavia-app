import {
    DataRow,
    FIN_COLORS,
    InfoNote,
    KpiGrid,
    KpiTile,
    SectionCard,
} from "@/components/admin-finance/finance-ui";
import { BusinessPlanTabProps } from "@/types/admin-finance-ui";
import { formatHours, formatSignedUsd, formatUsd, num } from "@/utils/aircraft-operations-calc";
import {
    buildPlanCostBase,
    computeScenario,
    computeScenarioTable,
    findScenario,
    formatGs,
    formatMonths,
    formatNumber,
    formatPct,
    getTarifaHoy,
} from "@/utils/business-plan";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

function Stepper({
    label,
    value,
    onChange,
    step,
    suffix,
    quick,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    step: number;
    suffix: string;
    quick?: { label: string; value: number }[];
}) {
    const bump = (delta: number) => {
        const next = Math.max(0, Math.round((num(value) + delta) * 100) / 100);
        onChange(String(next));
    };
    return (
        <View style={styles.control}>
            <Text style={styles.controlLabel}>{label}</Text>
            <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump(-step)}>
                    <Ionicons name="remove" size={18} color={FIN_COLORS.blue} />
                </TouchableOpacity>
                <TextInput
                    value={value}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                    style={styles.stepInput}
                    selectTextOnFocus
                />
                <Text style={styles.suffix}>{suffix}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump(step)}>
                    <Ionicons name="add" size={18} color={FIN_COLORS.blue} />
                </TouchableOpacity>
            </View>
            {quick && quick.length > 0 ? (
                <View style={styles.quickRow}>
                    {quick.map((q) => {
                        const active = Math.abs(num(value) - q.value) < 0.001;
                        return (
                            <TouchableOpacity
                                key={q.label}
                                onPress={() => onChange(String(q.value))}
                                style={[styles.quick, active ? styles.quickActive : null]}
                            >
                                <Text style={[styles.quickText, active ? styles.quickTextActive : null]}>{q.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.controlLabel}>{label}</Text>
                {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
            </View>
            <Switch value={value} onValueChange={onChange} trackColor={{ true: FIN_COLORS.gold, false: "#CBD5E1" }} thumbColor="#FFFFFF" />
        </View>
    );
}

/** Simulador: recalcula en vivo el resultado mensual, el equilibrio y el ROI. */
export function PlanSimulatorTab({ plan, cfg, liveTc }: BusinessPlanTabProps) {
    const initial = useMemo(() => {
        const base = buildPlanCostBase(plan, cfg);
        const table = computeScenarioTable(base, plan, getTarifaHoy(cfg), {
            descontarBancard: plan.descontarBancard,
            descontarIre: plan.descontarIre,
        });
        return (findScenario(table, plan.escenarioReferencia) ?? table[1]).input;
    }, [plan, cfg]);

    const [horas, setHoras] = useState(String(initial.horasMes));
    const [tarifa, setTarifa] = useState(String(initial.tarifaHora));
    const [tc, setTc] = useState(String(Math.round(cfg.tc)));
    const [conCesa, setConCesa] = useState(initial.conCesa);
    const [bancard, setBancard] = useState(plan.descontarBancard);
    const [ire, setIre] = useState(plan.descontarIre);
    // Hoy la tarifa de GIO es con IVA; las de CESA se cargan sin IVA (configurable en el plan).
    // Todas las tarifas son sin IVA (salvo que el plan diga que las de CESA lo incluyen).
    const tarifaConIva = conCesa ? plan.tarifasCesaIncluyenIva === true : false;

    const base = useMemo(() => buildPlanCostBase(plan, cfg, { tc: num(tc) }), [plan, cfg, tc]);
    const result = useMemo(
        () =>
            computeScenario(base, {
                id: "simulador",
                etiqueta: "Simulador",
                horasMes: num(horas),
                tarifaHora: num(tarifa),
                tarifaIncluyeIva: tarifaConIva,
                conCesa,
                descontarBancard: bancard,
                descontarIre: ire,
            }),
        [base, horas, tarifa, tarifaConIva, conCesa, bancard, ire]
    );

    const tarifaHoy = getTarifaHoy(cfg);
    const tarifaQuick = [
        { label: `Hoy ${formatNumber(tarifaHoy)}`, value: tarifaHoy },
        ...plan.tarifasCesa.map((t, i) => ({ label: `CESA ${i + 1}: ${formatNumber(t)}`, value: t })),
    ];
    const horasQuick = [
        { label: `Mín. ${formatNumber(plan.horasHoyMin, 1)}`, value: plan.horasHoyMin },
        { label: `Máx. ${formatNumber(plan.horasHoyMax, 1)}`, value: plan.horasHoyMax },
        { label: `Cons. ${formatNumber(plan.horasCesaConservador, 1)}`, value: plan.horasCesaConservador },
        { label: `Obj. ${formatNumber(plan.horasCesaObjetivo, 1)}`, value: plan.horasCesaObjetivo },
    ];
    const tcQuick = [
        { label: `GIO ${formatNumber(cfg.tc)}`, value: Math.round(cfg.tc) },
        ...(liveTc > 0 ? [{ label: `Del día ${formatNumber(liveTc)}`, value: Math.round(liveTc) }] : []),
    ];

    const eq = result.equilibrioHorasMes;

    return (
        <View>
            <SectionCard title="Supuestos del simulador" subtitle="Los cambios no se guardan: sirven para probar escenarios.">
                <Stepper label="Horas de vuelo por mes" value={horas} onChange={setHoras} step={1} suffix="hs" quick={horasQuick} />
                <Stepper label={tarifaConIva ? "Tarifa por hora (USD, IVA incluido)" : "Tarifa por hora (USD, sin IVA)"} value={tarifa} onChange={setTarifa} step={50} suffix="USD" quick={tarifaQuick} />
                <Stepper label="Tipo de cambio" value={tc} onChange={setTc} step={50} suffix="Gs/USD" quick={tcQuick} />
                <ToggleRow
                    label="Con CESA"
                    sub={`Seguro ${formatUsd(result.seguroMes)}/mes (${conCesa ? "con" : "sin"} CESA)`}
                    value={conCesa}
                    onChange={setConCesa}
                />
                <ToggleRow
                    label={`Descontar comisión Bancard (${formatPct(plan.comisionBancardPct)})`}
                    value={bancard}
                    onChange={setBancard}
                />
                <ToggleRow label={`Descontar IRE (${formatPct(plan.irePct, 0)} de la utilidad)`} value={ire} onChange={setIre} />
            </SectionCard>

            <SectionCard title="Resultado">
                <KpiGrid>
                    <KpiTile
                        label="Resultado mensual"
                        value={formatSignedUsd(result.resultado)}
                        sub={formatGs(result.resultado, base.tc)}
                        tone={result.resultado >= 0 ? "ok" : "bad"}
                    />
                    <KpiTile
                        label="Punto de equilibrio"
                        value={eq !== null ? formatHours(eq) : "—"}
                        sub={
                            eq === null
                                ? "La tarifa no cubre el costo variable"
                                : num(horas) >= eq
                                  ? `Sobran ${formatHours(num(horas) - eq)}`
                                  : `Faltan ${formatHours(eq - num(horas))}`
                        }
                        tone="gold"
                    />
                    <KpiTile
                        label="Recupero solo avión"
                        value={formatMonths(result.recuperoMesesAvion)}
                        sub={`Inversión ${formatUsd(base.inversionAvion)}`}
                    />
                    <KpiTile
                        label="Recupero avión + aviónica"
                        value={formatMonths(result.recuperoMesesAvionAvionica)}
                        sub={`ROI anual ${formatPct(result.roiAnualPct)}`}
                    />
                </KpiGrid>
                <View style={{ height: 8 }} />
                <DataRow label="Ingreso facturado (IVA incl.)" value={formatUsd(result.ingresoBruto)} />
                <DataRow label="IVA" value={`−${formatUsd(result.iva)}`} />
                <DataRow label="Ingreso neto de IVA" value={formatUsd(result.ingresoNeto)} strong />
                <DataRow label="Costo variable" value={formatUsd(result.costoVariableMes)} sub={`${formatUsd(result.costoVariableHora)} por hora`} />
                <DataRow label="Reserva de overhaul" value={formatUsd(result.overhaulMes)} />
                <DataRow label="Fijos (con seguro)" value={formatUsd(result.fijosMes)} />
                <DataRow label="Comisión Bancard" value={formatUsd(result.comisionBancard)} />
                <DataRow label="Costo total" value={formatUsd(result.costoTotal)} strong />
                <DataRow label="IRE estimado" value={formatUsd(result.ire)} />
                <DataRow
                    label="Resultado"
                    value={formatSignedUsd(result.resultado)}
                    strong
                    tone={result.resultado >= 0 ? "ok" : "bad"}
                />
                <DataRow label="Margen de un vuelo típico" value={formatUsd(result.margenVueloTipico)} sub={`${formatNumber(base.duracionVueloTipicoHs, 1)} h de vuelo`} />
                <InfoNote text="El tipo de cambio afecta los costos en guaraníes de GIO: combustible, tasas DINAC y gastos fijos en Gs." />
            </SectionCard>
        </View>
    );
}

const styles = StyleSheet.create({
    control: { marginBottom: 14 },
    controlLabel: {
    fontFamily: "NotoSans_400Regular", fontSize: 13, fontWeight: "700", color: "#334155" },
    stepperRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
    stepBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: FIN_COLORS.light,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        alignItems: "center",
        justifyContent: "center",
    },
    stepInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        paddingHorizontal: 10,
        fontSize: 16,
        fontFamily: "NotoSans_700Bold",
        color: FIN_COLORS.blue,
        textAlign: "center",
    },
    suffix: {
    fontFamily: "NotoSans_400Regular", fontSize: 12, color: FIN_COLORS.muted, minWidth: 34 },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    quick: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        backgroundColor: FIN_COLORS.white,
    },
    quickActive: { backgroundColor: FIN_COLORS.gold, borderColor: FIN_COLORS.gold },
    quickText: {
    fontFamily: "NotoSans_400Regular", fontSize: 11, fontWeight: "600", color: FIN_COLORS.blue },
    quickTextActive: { color: FIN_COLORS.white },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    toggleSub: {
    fontFamily: "NotoSans_400Regular", fontSize: 11, color: FIN_COLORS.muted, marginTop: 2 },
});
