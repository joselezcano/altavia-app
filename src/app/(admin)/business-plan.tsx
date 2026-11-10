import { BusinessPlanParamsModal } from "@/components/admin-business-plan/business-plan-params-modal";
import { PlanCurrentTab } from "@/components/admin-business-plan/plan-current-tab";
import { PlanRealRoiTab } from "@/components/admin-business-plan/plan-real-roi-tab";
import { PlanScenariosTab } from "@/components/admin-business-plan/plan-scenarios-tab";
import { PlanSimulatorTab } from "@/components/admin-business-plan/plan-simulator-tab";
import { PlanThirdPartyTab } from "@/components/admin-business-plan/plan-third-party-tab";
import { ChipRow, FIN_COLORS, InfoNote } from "@/components/admin-finance/finance-ui";
import {
    useAircraftOperationsConfig,
    useOperationalExpenses,
    useOperationalFlights,
} from "@/hooks/useAircraftOperations";
import { useAllAircrafts } from "@/hooks/useAllAircrafts";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessPlan, useSaveBusinessPlan } from "@/hooks/useBusinessPlan";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { AdminBillingAircraftRef } from "@/types/admin-billing";
import { BusinessPlanTabProps, ChipOption } from "@/types/admin-finance-ui";
import { BusinessPlan, BusinessPlanTab } from "@/types/business-plan";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const TAB_OPTIONS: ChipOption<BusinessPlanTab>[] = [
    { value: "actual", label: "Situación actual" },
    { value: "escenarios", label: "Escenarios" },
    { value: "simulador", label: "Simulador" },
    { value: "terceros", label: "Terceros (CESA)" },
    { value: "roi", label: "ROI real" },
];

/**
 * Plan de negocio y simulador (ADMIN). Integra la planilla de rentabilidad: los supuestos
 * propios se guardan en business-plans/{aircraftId} y los costos operativos se leen de GIO.
 */
export default function AdminBusinessPlanScreen() {
    const { user } = useAuth();
    const { data: aircrafts = [], isLoading: loadingAircraft } = useAllAircrafts();

    const eligible = useMemo<AdminBillingAircraftRef[]>(
        () =>
            aircrafts
                .filter((a) => !!a.ownerId)
                .map((a) => ({
                    aircraftId: a.id,
                    ownerId: a.ownerId as string,
                    registration: a.basic_specs?.registration || a.id,
                    model: a.basic_specs?.model || "",
                })),
        [aircrafts]
    );

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tab, setTab] = useState<BusinessPlanTab>("actual");
    const [editing, setEditing] = useState(false);

    // Por defecto el ZP-BOC (única aeronave operando hoy), si no la primera con dueño.
    const selected =
        eligible.find((a) => a.aircraftId === selectedId) ??
        eligible.find((a) => a.registration.toUpperCase() === "ZP-BOC") ??
        eligible[0] ??
        null;

    const cfgQ = useAircraftOperationsConfig(
        selected?.ownerId,
        selected?.aircraftId || "",
        selected?.registration,
        selected?.model
    );
    const flightsQ = useOperationalFlights(selected?.ownerId, selected?.aircraftId);
    const expensesQ = useOperationalExpenses(selected?.ownerId, selected?.aircraftId);
    const planQ = useBusinessPlan(selected);
    const exchangeQ = useExchangeRate();
    const savePlan = useSaveBusinessPlan();

    const handleSave = async (plan: BusinessPlan) => {
        try {
            await savePlan.mutateAsync({ plan, uid: user?.uid });
            setEditing(false);
            Alert.alert("Plan guardado", "Los parámetros del plan se actualizaron.");
        } catch (error) {
            console.error("Error al guardar el plan:", error);
            Alert.alert("Error", "No se pudo guardar el plan de negocio.");
        }
    };

    if (loadingAircraft) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={FIN_COLORS.blue} />
            </View>
        );
    }

    if (!selected) {
        return (
            <View style={styles.center}>
                <Text style={styles.muted}>No hay aeronaves con propietario asignado.</Text>
            </View>
        );
    }

    const loading = cfgQ.isLoading || flightsQ.isLoading || expensesQ.isLoading || planQ.isLoading;
    const loadError = cfgQ.isError || flightsQ.isError || expensesQ.isError || planQ.isError;
    const plan = planQ.data?.plan;
    const cfg = cfgQ.data;

    const tabProps: BusinessPlanTabProps | null =
        plan && cfg
            ? {
                  plan,
                  cfg,
                  flights: flightsQ.data ?? [],
                  expenses: expensesQ.data ?? [],
                  liveTc: exchangeQ.data?.dolar ?? 0,
              }
            : null;

    const aircraftOptions: ChipOption<string>[] = eligible.map((a) => ({ value: a.aircraftId, label: a.registration }));
    const tabKey = `${selected.aircraftId}-${plan?.updatedAt ?? "default"}`;

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {eligible.length > 1 ? (
                <View style={{ marginBottom: 10 }}>
                    <ChipRow options={aircraftOptions} value={selected.aircraftId} onChange={setSelectedId} />
                </View>
            ) : null}

            <View style={styles.banner}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.bannerKicker}>PLAN DE NEGOCIO</Text>
                    <Text style={styles.bannerTitle}>
                        {selected.registration} · {selected.model}
                    </Text>
                    <Text style={styles.bannerSub}>
                        CESA {plan?.cesaVigente ? "vigente" : "no vigente"} ·{" "}
                        {planQ.data?.exists && !planQ.data.invalidStored
                            ? "parámetros guardados"
                            : "valores por defecto de la planilla"}
                    </Text>
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setEditing(true)}
                    disabled={!plan || !cfg}
                    activeOpacity={0.8}
                >
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.editText}>Editar parámetros</Text>
                </TouchableOpacity>
                {/* La IA se implementa en otra fase: el botón queda deshabilitado. */}
                <TouchableOpacity style={styles.aiBtn} disabled activeOpacity={1}>
                    <Ionicons name="sparkles-outline" size={16} color={FIN_COLORS.muted} />
                    <Text style={styles.aiText}>Preguntale a la IA (próximamente)</Text>
                </TouchableOpacity>
            </View>

            {planQ.data?.invalidStored ? (
                <InfoNote tone="warn" text="El plan guardado tiene valores inválidos: se muestran los de la planilla hasta que lo guardes de nuevo." />
            ) : null}
            {loadError ? (
                <InfoNote tone="warn" text="No se pudieron leer todos los datos (GIO o plan). Revisá la conexión y volvé a abrir la pantalla." />
            ) : null}

            <View style={{ marginVertical: 12 }}>
                <ChipRow options={TAB_OPTIONS} value={tab} onChange={setTab} />
            </View>

            {loading || !tabProps ? (
                <ActivityIndicator style={{ marginTop: 24 }} color={FIN_COLORS.blue} />
            ) : (
                <View key={tabKey}>
                    {tab === "actual" ? <PlanCurrentTab {...tabProps} /> : null}
                    {tab === "escenarios" ? <PlanScenariosTab {...tabProps} /> : null}
                    {tab === "simulador" ? <PlanSimulatorTab {...tabProps} /> : null}
                    {tab === "terceros" ? <PlanThirdPartyTab {...tabProps} /> : null}
                    {tab === "roi" ? <PlanRealRoiTab {...tabProps} /> : null}
                </View>
            )}

            {editing && plan && cfg ? (
                <BusinessPlanParamsModal
                    visible={editing}
                    plan={plan}
                    cfg={cfg}
                    saving={savePlan.isPending}
                    onClose={() => setEditing(false)}
                    onSave={handleSave}
                />
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: FIN_COLORS.light },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: FIN_COLORS.light },
    muted: {
    fontFamily: "NotoSans_400Regular", color: FIN_COLORS.muted, fontSize: 13 },
    banner: { backgroundColor: FIN_COLORS.blue, borderRadius: 20, padding: 16, flexDirection: "row" },
    bannerKicker: {
    fontFamily: "NotoSans_400Regular", color: FIN_COLORS.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    bannerTitle: {
    fontFamily: "NotoSans_400Regular", color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 4 },
    bannerSub: {
    fontFamily: "NotoSans_400Regular", color: "#CBD5E1", fontSize: 12, marginTop: 4 },
    actions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
    editBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: FIN_COLORS.blue,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    editText: {
    fontFamily: "NotoSans_400Regular", color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    aiBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#EEF2F6",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        opacity: 0.7,
    },
    aiText: {
    fontFamily: "NotoSans_400Regular", color: FIN_COLORS.muted, fontWeight: "600", fontSize: 13 },
});
