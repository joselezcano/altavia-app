/**
 * Edición de los parámetros del plan de negocio (solo ADMIN).
 * Dentro del <Modal> solo se usan View/Text nativos con StyleSheet (regla 5 de NativeWind).
 */
import { FIN_COLORS } from "@/components/admin-finance/finance-ui";
import { AircraftOperationsConfig } from "@/types/aircraft-operations";
import {
    BUSINESS_PLAN_SCENARIO_IDS,
    BusinessPlan,
    BusinessPlanNumericKey,
    BusinessPlanSchema,
    BusinessPlanScenarioId,
} from "@/types/business-plan";
import { formatUsd } from "@/utils/aircraft-operations-calc";
import { createDefaultBusinessPlan, resolveExcludedFixedIds, SCENARIO_LABELS } from "@/utils/business-plan";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type NumericKey = BusinessPlanNumericKey;

const PCT_KEYS: NumericKey[] = ["feePasarelaPct", "ivaPct", "comisionBancardPct", "irePct"];

const SECTIONS: { title: string; fields: { key: NumericKey; label: string }[] }[] = [
    {
        title: "Horas de vuelo por mes",
        fields: [
            { key: "horasHoyMin", label: "Hoy · mínimo" },
            { key: "horasHoyMax", label: "Hoy · máximo" },
            { key: "horasCesaConservador", label: "Con CESA · conservador" },
            { key: "horasCesaObjetivo", label: "Con CESA · objetivo" },
        ],
    },
    {
        title: "Gastos fijos del plan (USD por año)",
        fields: [
            { key: "seguroAnualSinCesa", label: "Seguro sin CESA" },
            { key: "seguroAnualConCesa", label: "Seguro con CESA" },
            { key: "inspeccionesAnuales", label: "Inspecciones / habilitaciones" },
        ],
    },
    {
        title: "Costos que GIO no registra",
        fields: [
            { key: "aceiteHoraUsd", label: "Aceite (USD/hora)" },
            { key: "imprevistosHoraUsd", label: "Mantenimiento imprevisto (USD/hora)" },
            { key: "otrasTasasVueloUsd", label: "Otras tasas por vuelo (USD)" },
            { key: "pasajerosPromedio", label: "Pasajeros promedio por vuelo" },
            { key: "duracionVueloTipicoHs", label: "Duración del vuelo típico (horas)" },
        ],
    },
    {
        title: "Inversión (USD)",
        fields: [
            { key: "precioCompraUsd", label: "Precio de compra del avión" },
            { key: "avionicaUsd", label: "Inversión en aviónica" },
        ],
    },
    {
        title: "Plataforma AltaGo y terceros (CESA)",
        fields: [
            { key: "plataformaCostoUsd", label: "Costo de la plataforma (USD)" },
            { key: "plataformaRecuperoMeses", label: "Plazo de recupero (meses)" },
            { key: "tercerosAeronaves", label: "Aeronaves de terceros" },
            { key: "tercerosHorasMes", label: "Horas por mes de cada tercero" },
            { key: "feeCesaMonomotor", label: "Fee CESA monomotor (USD/hora)" },
            { key: "feeCesaBimotor", label: "Fee CESA bimotor (USD/hora)" },
            { key: "feeCesaTurbohelice", label: "Fee CESA turbohélice (USD/hora)" },
            { key: "feePasarelaPct", label: "Fee de pasarela (%)" },
        ],
    },
    {
        title: "Impuestos y comisiones (%)",
        fields: [
            { key: "ivaPct", label: "IVA" },
            { key: "comisionBancardPct", label: "Comisión Bancard" },
            { key: "irePct", label: "IRE sobre la utilidad" },
        ],
    },
];

function toInput(plan: BusinessPlan, key: NumericKey): string {
    const v = plan[key];
    return PCT_KEYS.includes(key) ? String(Math.round(v * 100000) / 1000) : String(v);
}

function parseNum(v: string): number {
    const n = parseFloat((v || "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
}

export function BusinessPlanParamsModal({
    visible,
    plan,
    cfg,
    saving,
    onClose,
    onSave,
}: {
    visible: boolean;
    plan: BusinessPlan;
    cfg: AircraftOperationsConfig;
    saving: boolean;
    onClose: () => void;
    onSave: (plan: BusinessPlan) => void;
}) {
    const initValues = (p: BusinessPlan) => {
        const out: Record<string, string> = {};
        SECTIONS.forEach((s) => s.fields.forEach((f) => (out[f.key] = toInput(p, f.key))));
        p.tarifasCesa.forEach((t, i) => (out[`tarifa${i}`] = String(t)));
        return out;
    };

    const [values, setValues] = useState<Record<string, string>>(() => initValues(plan));
    const [descontarBancard, setDescontarBancard] = useState(plan.descontarBancard);
    const [descontarIre, setDescontarIre] = useState(plan.descontarIre);
    const [cesaVigente, setCesaVigente] = useState(plan.cesaVigente);
    const [cesaConIva, setCesaConIva] = useState(plan.tarifasCesaIncluyenIva === true);
    const [escenario, setEscenario] = useState<BusinessPlanScenarioId>(plan.escenarioReferencia);
    const [excluidos, setExcluidos] = useState<string[]>(() => resolveExcludedFixedIds(plan, cfg));
    const [error, setError] = useState<string | null>(null);

    const resetTo = (p: BusinessPlan) => {
        setValues(initValues(p));
        setDescontarBancard(p.descontarBancard);
        setDescontarIre(p.descontarIre);
        setCesaVigente(p.cesaVigente);
        setCesaConIva(p.tarifasCesaIncluyenIva === true);
        setEscenario(p.escenarioReferencia);
        setExcluidos(resolveExcludedFixedIds(p, cfg));
        setError(null);
    };

    const handleSave = () => {
        const next: BusinessPlan = {
            ...plan,
            descontarBancard,
            descontarIre,
            cesaVigente,
            tarifasCesaIncluyenIva: cesaConIva,
            escenarioReferencia: escenario,
            fijosGioExcluidos: excluidos,
            tarifasCesa: [0, 1, 2].map((i) => parseNum(values[`tarifa${i}`])),
        };
        for (const s of SECTIONS) {
            for (const f of s.fields) {
                const n = parseNum(values[f.key]);
                if (!Number.isFinite(n)) {
                    setError(`Revisá el campo "${f.label}".`);
                    return;
                }
                next[f.key] = PCT_KEYS.includes(f.key) ? n / 100 : n;
            }
        }
        const parsed = BusinessPlanSchema.safeParse(next);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            setError(`Valor inválido en "${String(issue?.path?.[0] ?? "")}": ${issue?.message ?? ""}`);
            return;
        }
        setError(null);
        onSave(parsed.data);
    };

    const setValue = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.scrim}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Parámetros del plan</Text>
                        <Text style={styles.subtitle}>
                            {plan.aircraftRegistration} · Los costos operativos (combustible, piloto, tasas, overhaul por hora,
                            fijos y tipo de cambio) se editan en los Ajustes de GIO.
                        </Text>
                    </View>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                        <Text style={styles.section}>Estado</Text>
                        <View style={styles.toggleRow}>
                            <Text style={styles.label}>CESA vigente</Text>
                            <Switch value={cesaVigente} onValueChange={setCesaVigente} trackColor={{ true: FIN_COLORS.gold, false: "#CBD5E1" }} thumbColor="#FFFFFF" />
                        </View>
                        <View style={styles.toggleRow}>
                            <Text style={styles.label}>Tarifas con CESA incluyen IVA</Text>
                            <Switch value={cesaConIva} onValueChange={setCesaConIva} trackColor={{ true: FIN_COLORS.gold, false: "#CBD5E1" }} thumbColor="#FFFFFF" />
                        </View>
                        <View style={styles.toggleRow}>
                            <Text style={styles.label}>Descontar comisión Bancard</Text>
                            <Switch value={descontarBancard} onValueChange={setDescontarBancard} trackColor={{ true: FIN_COLORS.gold, false: "#CBD5E1" }} thumbColor="#FFFFFF" />
                        </View>
                        <View style={styles.toggleRow}>
                            <Text style={styles.label}>Descontar IRE sobre la utilidad</Text>
                            <Switch value={descontarIre} onValueChange={setDescontarIre} trackColor={{ true: FIN_COLORS.gold, false: "#CBD5E1" }} thumbColor="#FFFFFF" />
                        </View>
                        <Text style={styles.label}>Escenario de referencia</Text>
                        <View style={styles.chips}>
                            {BUSINESS_PLAN_SCENARIO_IDS.map((id) => {
                                const active = id === escenario;
                                return (
                                    <TouchableOpacity key={id} onPress={() => setEscenario(id)} style={[styles.chip, active ? styles.chipActive : null]}>
                                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{SCENARIO_LABELS[id]}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.section}>Tarifas a evaluar con CESA (USD/hora)</Text>
                        {[0, 1, 2].map((i) => (
                            <View key={i} style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Tarifa {i + 1}</Text>
                                <TextInput
                                    value={values[`tarifa${i}`]}
                                    onChangeText={(v) => setValue(`tarifa${i}`, v)}
                                    keyboardType="decimal-pad"
                                    style={styles.input}
                                />
                            </View>
                        ))}
                        <Text style={styles.hint}>La tarifa de hoy es la de GIO (Control de Flota): USD {cfg.tarifaHora}/hora.</Text>

                        {SECTIONS.map((s) => (
                            <View key={s.title}>
                                <Text style={styles.section}>{s.title}</Text>
                                {s.fields.map((f) => (
                                    <View key={f.key} style={styles.fieldRow}>
                                        <Text style={styles.fieldLabel}>{f.label}</Text>
                                        <TextInput
                                            value={values[f.key]}
                                            onChangeText={(v) => setValue(f.key, v)}
                                            keyboardType="decimal-pad"
                                            style={styles.input}
                                        />
                                    </View>
                                ))}
                            </View>
                        ))}

                        <Text style={styles.section}>Gastos fijos de GIO que reemplaza el plan</Text>
                        <Text style={styles.hint}>
                            Marcá las líneas que el plan ya cuenta (seguro, inspecciones) para no sumarlas dos veces.
                        </Text>
                        {(cfg.fijos || []).map((f) => {
                            const on = excluidos.includes(f.id);
                            return (
                                <View key={f.id} style={styles.toggleRow}>
                                    <Text style={styles.label}>
                                        {f.n} ({f.c === "GS" ? `Gs ${f.m.toLocaleString("es-PY")}` : formatUsd(f.m)})
                                    </Text>
                                    <Switch
                                        value={on}
                                        onValueChange={(v) =>
                                            setExcluidos((prev) => (v ? [...prev, f.id] : prev.filter((x) => x !== f.id)))
                                        }
                                        trackColor={{ true: FIN_COLORS.gold, false: "#CBD5E1" }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>
                            );
                        })}

                        <TouchableOpacity
                            onPress={() => resetTo(createDefaultBusinessPlan(plan.aircraftId, plan.ownerId, plan.aircraftRegistration, plan.aircraftModel))}
                            style={styles.resetBtn}
                        >
                            <Text style={styles.resetText}>Volver a los valores de la planilla</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                            <Text style={styles.btnGhostText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={styles.btn} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
        height: "90%",
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 28,
    },
    header: { marginBottom: 8 },
    title: {
    fontFamily: "NotoSans_400Regular", fontSize: 17, fontWeight: "700", color: FIN_COLORS.blue },
    subtitle: {
    fontFamily: "NotoSans_400Regular", fontSize: 12, color: FIN_COLORS.muted, marginTop: 4, lineHeight: 16 },
    section: {
    fontFamily: "NotoSans_400Regular", fontSize: 13, fontWeight: "800", color: FIN_COLORS.blue, marginTop: 18, marginBottom: 6 },
    label: {
    fontFamily: "NotoSans_400Regular", flex: 1, fontSize: 13, color: "#334155", fontWeight: "600", paddingRight: 8 },
    hint: {
    fontFamily: "NotoSans_400Regular", fontSize: 11, color: FIN_COLORS.muted, marginTop: 4, lineHeight: 15 },
    toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    fieldRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
    fieldLabel: {
    fontFamily: "NotoSans_400Regular", flex: 1, fontSize: 13, color: "#334155", paddingRight: 8 },
    input: {
        fontFamily: "NotoSans_400Regular",
        width: 120,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 15,
        color: "#0F172A",
        textAlign: "right",
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: FIN_COLORS.border },
    chipActive: { backgroundColor: FIN_COLORS.blue, borderColor: FIN_COLORS.blue },
    chipText: {
    fontFamily: "NotoSans_400Regular", fontSize: 11, fontWeight: "600", color: FIN_COLORS.blue },
    chipTextActive: { color: "#FFFFFF" },
    resetBtn: { marginTop: 18, paddingVertical: 10, alignItems: "center" },
    resetText: {
    fontFamily: "NotoSans_400Regular", color: FIN_COLORS.gold, fontWeight: "700", fontSize: 13 },
    error: {
    fontFamily: "NotoSans_400Regular", color: FIN_COLORS.bad, fontSize: 12, marginTop: 8 },
    actions: { flexDirection: "row", marginTop: 12, gap: 12 },
    btn: { flex: 1, backgroundColor: FIN_COLORS.blue, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    btnText: {
    fontFamily: "NotoSans_400Regular", color: "#FFFFFF", fontWeight: "700" },
    btnGhost: { backgroundColor: "#F1F5F9" },
    btnGhostText: {
    fontFamily: "NotoSans_400Regular", color: "#334155", fontWeight: "700" },
});
