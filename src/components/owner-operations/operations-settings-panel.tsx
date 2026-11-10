import {
    AircraftOperationsConfig,
    FixedMonthlyExpense,
} from "@/types/aircraft-operations";
import {
    DEFAULT_BLOCK_FACTOR,
    DEFAULT_FIXED_EXPENSES,
    formatUsd,
    getHourlyFuelCostUsd,
    getMonthlyFixedCostsUsd,
    num,
} from "@/utils/aircraft-operations-calc";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface OperationsSettingsPanelProps {
    config: AircraftOperationsConfig;
    isSaving: boolean;
    onSaveConfig: (updatedConfig: AircraftOperationsConfig) => Promise<void>;
}

export function OperationsSettingsPanel({
    config,
    isSaving,
    onSaveConfig,
}: OperationsSettingsPanelProps) {
    const [openHowItWorks, setOpenHowItWorks] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const [savedJustNow, setSavedJustNow] = useState(false);

    // Estado local editable para Ajustes
    const [tc, setTc] = useState(String(config.tc));
    const [consumoLt, setConsumoLt] = useState(String(config.consumoLt));
    const [precioLtGs, setPrecioLtGs] = useState(String(config.precioLtGs));
    const [pilotajeHora, setPilotajeHora] = useState(String(config.pilotajeHora));
    const [planBaseGs, setPlanBaseGs] = useState(String(config.planBaseGs));
    const [planPersonaGs, setPlanPersonaGs] = useState(String(config.planPersonaGs));
    const [reservaHora, setReservaHora] = useState(String(config.reservaHora));
    const [tarifaHora, setTarifaHora] = useState(String(config.tarifaHora));
    const [pernocteUsd, setPernocteUsd] = useState(String(config.pernocteUsd ?? 100));
    const [hangarNocheUsd, setHangarNocheUsd] = useState(String(config.hangarNocheUsd ?? 0));
    const [pilotoPernocteUsd, setPilotoPernocteUsd] = useState(String(config.pilotoPernocteUsd ?? 100));
    const [factorBloque, setFactorBloque] = useState(String(config.factorBloque ?? DEFAULT_BLOCK_FACTOR));
    const [fijos, setFijos] = useState<FixedMonthlyExpense[]>(
        config.fijos?.length ? config.fijos : DEFAULT_FIXED_EXPENSES
    );

    useEffect(() => {
        setTc(String(config.tc));
        setConsumoLt(String(config.consumoLt));
        setPrecioLtGs(String(config.precioLtGs));
        setPilotajeHora(String(config.pilotajeHora));
        setPlanBaseGs(String(config.planBaseGs));
        setPlanPersonaGs(String(config.planPersonaGs));
        setReservaHora(String(config.reservaHora));
        setTarifaHora(String(config.tarifaHora));
        setPernocteUsd(String(config.pernocteUsd ?? 100));
        setHangarNocheUsd(String(config.hangarNocheUsd ?? 0));
        setPilotoPernocteUsd(String(config.pilotoPernocteUsd ?? 100));
        setFactorBloque(String(config.factorBloque ?? DEFAULT_BLOCK_FACTOR));
        setFijos(
            Array.isArray(config.fijos) && config.fijos.length > 0
                ? config.fijos.map((f) => ({ ...f }))
                : DEFAULT_FIXED_EXPENSES.map((f) => ({ ...f }))
        );
    }, [config]);

    const draftConfig: AircraftOperationsConfig = useMemo(
        () => ({
            ...config,
            tc: num(tc),
            consumoLt: num(consumoLt),
            precioLtGs: num(precioLtGs),
            pilotajeHora: num(pilotajeHora),
            planBaseGs: num(planBaseGs),
            planPersonaGs: num(planPersonaGs),
            reservaHora: num(reservaHora),
            tarifaHora: num(tarifaHora),
            pernocteUsd: num(pernocteUsd),
            hangarNocheUsd: num(hangarNocheUsd),
            pilotoPernocteUsd: num(pilotoPernocteUsd),
            factorBloque: num(factorBloque) > 0 ? num(factorBloque) : DEFAULT_BLOCK_FACTOR,
            fijos,
        }),
        [
            config,
            tc,
            consumoLt,
            precioLtGs,
            pilotajeHora,
            planBaseGs,
            planPersonaGs,
            reservaHora,
            tarifaHora,
            pernocteUsd,
            hangarNocheUsd,
            pilotoPernocteUsd,
            factorBloque,
            fijos,
        ]
    );

    const liveFixedMonthlyUsd = useMemo(
        () => getMonthlyFixedCostsUsd(draftConfig),
        [draftConfig]
    );

    const liveHourlyVariableUsd = useMemo(
        () =>
            getHourlyFuelCostUsd(draftConfig) +
            num(draftConfig.pilotajeHora) +
            num(draftConfig.reservaHora),
        [draftConfig]
    );

    const handleFixedNameChange = (idx: number, val: string) => {
        setFijos((prev) =>
            prev.map((item, i) => (i === idx ? { ...item, n: val } : item))
        );
    };

    const handleFixedAmountChange = (idx: number, val: string) => {
        setFijos((prev) =>
            prev.map((item, i) => (i === idx ? { ...item, m: num(val) } : item))
        );
    };

    const handleFixedCurrencyToggle = (idx: number) => {
        setFijos((prev) =>
            prev.map((item, i) =>
                i === idx
                    ? { ...item, c: item.c === "USD" ? "GS" : "USD" }
                    : item
            )
        );
    };

    const handleAddFixedRow = () => {
        setFijos((prev) => [
            ...prev,
            {
                id: `fix-${Date.now().toString(36)}`,
                n: "Nuevo gasto fijo",
                m: 0,
                c: "USD",
            },
        ]);
    };

    const handleRemoveFixedRow = (idx: number) => {
        setFijos((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSavePress = async () => {
        await onSaveConfig(draftConfig);
        setSavedJustNow(true);
        setTimeout(() => setSavedJustNow(false), 1800);
    };

    return (
        <View style={styles.container}>
            {/* 1. Desplegable: Cómo se calcula cada número */}
            <View style={styles.accordionBlock}>
                <TouchableOpacity
                    onPress={() => setOpenHowItWorks((v) => !v)}
                    style={styles.accordionHeader}
                    activeOpacity={0.7}
                >
                    <Text style={styles.accordionTitle}>
                        Cómo se calcula cada número
                    </Text>
                    <Ionicons
                        name={openHowItWorks ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#93A3B6"
                    />
                </TouchableOpacity>

                {openHowItWorks && (
                    <View style={styles.accordionBody}>
                        <Text style={styles.paragraph}>
                            Cada vuelo deja plata, pero el avión también cuesta aunque esté
                            quieto en el hangar. El cálculo separa las dos cosas.
                        </Text>

                        <View style={styles.formulaBox}>
                            <Text style={styles.formulaText}>
                                Lo que deja un vuelo = cobrado − combustible − piloto − tasas −
                                reserva
                            </Text>
                        </View>

                        <Text style={styles.paragraph}>
                            La <Text style={styles.boldText}>reserva</Text> es lo más fácil de
                            olvidar: cada hora de vuelo desgasta los motores y las hélices, y
                            ese overhaul se paga de golpe dentro de varios años. Si no se
                            aparta esa plata por hora, el avión parece rentable hasta que
                            llega la factura.
                        </Text>

                        <Text style={styles.paragraph}>
                            Por eso la reserva va a un{" "}
                            <Text style={styles.boldText}>fondo de mantenimiento</Text>, y
                            cuando llega la factura del mecánico sale de ahí en vez de volver
                            a restar del mes. Si el fondo queda en rojo, el mantenimiento real
                            cuesta más de lo que se está apartando por hora.
                        </Text>

                        <View style={styles.formulaBox}>
                            <Text style={styles.formulaText}>
                                Resultado del mes = lo que dejaron los vuelos − gastos fijos
                            </Text>
                        </View>

                        <Text style={[styles.paragraph, { marginBottom: 0 }]}>
                            Los <Text style={styles.boldText}>gastos fijos</Text> (hangaraje,
                            administración, limpieza, seguro) se pagan se vuele o no. Por eso
                            hay un mínimo de horas por mes para emparejar: es lo que mide la
                            barra.
                        </Text>
                    </View>
                )}
            </View>

            {/* 2. Desplegable: Ajustes de costos y tarifas */}
            <View style={styles.accordionBlock}>
                <TouchableOpacity
                    onPress={() => setOpenSettings((v) => !v)}
                    style={styles.accordionHeader}
                    activeOpacity={0.7}
                >
                    <Text style={styles.accordionTitle}>
                        Ajustes de costos y tarifas
                    </Text>
                    <Ionicons
                        name={openSettings ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#93A3B6"
                    />
                </TouchableOpacity>

                {openSettings && (
                    <View style={styles.accordionBody}>
                        <Text style={styles.sectionHeader}>CAMBIO Y COMBUSTIBLE</Text>

                        <SettingRow
                            label="Tipo de cambio"
                            sub="Guaraníes por dólar"
                            value={tc}
                            onChangeText={setTc}
                        />
                        <SettingRow
                            label="Consumo"
                            sub="Litros por hora de vuelo"
                            value={consumoLt}
                            onChangeText={setConsumoLt}
                        />
                        <SettingRow
                            label="Precio del AVGAS"
                            sub="Guaraníes por litro"
                            value={precioLtGs}
                            onChangeText={setPrecioLtGs}
                        />

                        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>
                            COSTOS POR VUELO
                        </Text>

                        <SettingRow
                            label="Piloto"
                            sub="Dólares por hora"
                            value={pilotajeHora}
                            onChangeText={setPilotajeHora}
                        />
                        <SettingRow
                            label="Plan de vuelo: base"
                            sub="Guaraníes por vuelo, ya cubre piloto y copiloto"
                            value={planBaseGs}
                            onChangeText={setPlanBaseGs}
                        />
                        <SettingRow
                            label="Plan de vuelo: por pasajero"
                            sub="Guaraníes por cada pasajero, sin contar tripulación"
                            value={planPersonaGs}
                            onChangeText={setPlanPersonaGs}
                        />
                        <SettingRow
                            label="Reserva de mantenimiento"
                            sub="Dólares por hora para el overhaul"
                            value={reservaHora}
                            onChangeText={setReservaHora}
                        />
                        <SettingRow
                            label="Piloto: pernocte"
                            sub="Dólares por noche que se le paga al piloto fuera de base"
                            value={pilotoPernocteUsd}
                            onChangeText={setPilotoPernocteUsd}
                        />

                        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>
                            TARIFA AL CLIENTE (SIN IVA)
                        </Text>

                        <SettingRow
                            label="Tarifa por hora"
                            sub="Dólares por hora volada, sin IVA, incluye el regreso vacío. Se usa para cotizar"
                            value={tarifaHora}
                            onChangeText={setTarifaHora}
                        />
                        <SettingRow
                            label="Pernocte"
                            sub="Dólares por noche que el avión queda fuera de base"
                            value={pernocteUsd}
                            onChangeText={setPernocteUsd}
                        />
                        <SettingRow
                            label="Hangaraje por noche"
                            sub="Dólares por noche fuera de base (se puede ajustar en cada reserva)"
                            value={hangarNocheUsd}
                            onChangeText={setHangarNocheUsd}
                        />
                        <SettingRow
                            label="Factor de bloque"
                            sub="Horas Hobbs ÷ horas en línea recta (rodaje, ascenso). Ej: 1.12 = +12%"
                            value={factorBloque}
                            onChangeText={setFactorBloque}
                        />

                        <View style={styles.fixedHeaderRow}>
                            <Text style={[styles.sectionHeader, { marginTop: 0 }]}>
                                GASTOS FIJOS DEL MES
                            </Text>
                            <TouchableOpacity
                                onPress={handleAddFixedRow}
                                style={styles.addFixedBtn}
                            >
                                <Ionicons name="add-circle-outline" size={16} color="#1540C9" />
                                <Text style={styles.addFixedBtnText}>Agregar rubro</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginTop: 10 }}>
                            {fijos.map((f, idx) => (
                                <View key={f.id || idx} style={styles.fixedRow}>
                                    <TextInput
                                        value={f.n}
                                        onChangeText={(v) => handleFixedNameChange(idx, v)}
                                        placeholder="Concepto fijo"
                                        placeholderTextColor="#93A3B6"
                                        style={[styles.fixedInput, { flex: 1 }]}
                                    />
                                    <TextInput
                                        value={String(f.m)}
                                        onChangeText={(v) => handleFixedAmountChange(idx, v)}
                                        placeholder="0"
                                        placeholderTextColor="#93A3B6"
                                        keyboardType="decimal-pad"
                                        style={[styles.fixedInput, styles.fixedAmountInput]}
                                    />
                                    <TouchableOpacity
                                        onPress={() => handleFixedCurrencyToggle(idx)}
                                        style={styles.fixedCurrencyBtn}
                                    >
                                        <Text style={styles.fixedCurrencyBtnText}>
                                            {f.c === "USD" ? "USD" : "Gs"}
                                        </Text>
                                    </TouchableOpacity>
                                    {fijos.length > 1 && (
                                        <TouchableOpacity
                                            onPress={() => handleRemoveFixedRow(idx)}
                                            style={styles.removeFixedBtn}
                                        >
                                            <Ionicons
                                                name="close-circle-outline"
                                                size={18}
                                                color="#93A3B6"
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </View>

                        <Text style={styles.liveSummaryMsg}>
                            Total fijo del mes: {formatUsd(liveFixedMonthlyUsd)}. Una hora de
                            vuelo cuesta {formatUsd(liveHourlyVariableUsd)} antes de los
                            fijos.
                        </Text>

                        <TouchableOpacity
                            onPress={handleSavePress}
                            disabled={isSaving}
                            style={[
                                styles.saveBtn,
                                savedJustNow ? styles.saveBtnSuccess : null,
                                isSaving ? { opacity: 0.7 } : null,
                            ]}
                            activeOpacity={0.85}
                        >
                            {isSaving ? (
                                <View style={styles.savingRow}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.saveBtnText}>Guardando…</Text>
                                </View>
                            ) : (
                                <Text style={styles.saveBtnText}>
                                    {savedJustNow ? "✓ Ajustes guardados" : "Guardar ajustes"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Pie de página informativo (idéntico al artefacto) */}
            <Text style={styles.footerNote}>
                Todo en dólares, al cambio de{" "}
                {num(config.tc).toLocaleString("es-PY")} Gs. Una hora de vuelo cuesta{" "}
                {formatUsd(
                    getHourlyFuelCostUsd(config) +
                        num(config.pilotajeHora) +
                        num(config.reservaHora)
                )}{" "}
                antes de los gastos fijos.
            </Text>
        </View>
    );
}

function SettingRow({
    label,
    sub,
    value,
    onChangeText,
}: {
    label: string;
    sub: string;
    value: string;
    onChangeText: (v: string) => void;
}) {
    return (
        <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingSub}>{sub}</Text>
            </View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType="decimal-pad"
                style={styles.settingInput}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 38,
    },
    accordionBlock: {
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
    },
    accordionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
    },
    accordionTitle: {
        fontSize: 14.5,
        fontWeight: "600",
        color: "#091626",
    },
    accordionBody: {
        paddingBottom: 24,
    },
    paragraph: {
        fontSize: 14.5,
        color: "#52647A",
        lineHeight: 23,
        marginBottom: 14,
    },
    boldText: {
        color: "#091626",
        fontWeight: "600",
    },
    formulaBox: {
        backgroundColor: "#F4F7FC",
        borderRadius: 9,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 14,
        borderLeftWidth: 2.5,
        borderLeftColor: "#7BA4FF",
    },
    formulaText: {
        fontFamily: "monospace",
        fontSize: 12.5,
        color: "#091626",
    },
    sectionHeader: {
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "#52647A",
        fontWeight: "700",
        marginTop: 8,
        marginBottom: 6,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F5FA",
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: "500",
        color: "#091626",
    },
    settingSub: {
        fontSize: 12.5,
        color: "#52647A",
        marginTop: 2,
        lineHeight: 17,
    },
    settingInput: {
        width: 108,
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        fontWeight: "600",
        color: "#091626",
        textAlign: "right",
    },
    fixedHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 28,
    },
    addFixedBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#EEF3FE",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 99,
    },
    addFixedBtnText: {
        fontSize: 12.5,
        fontWeight: "600",
        color: "#1540C9",
    },
    fixedRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    fixedInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13.5,
        fontWeight: "500",
        color: "#091626",
    },
    fixedAmountInput: {
        width: 92,
        textAlign: "right",
    },
    fixedCurrencyBtn: {
        width: 62,
        backgroundColor: "#F4F7FC",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    fixedCurrencyBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1540C9",
    },
    removeFixedBtn: {
        padding: 4,
    },
    liveSummaryMsg: {
        fontSize: 14,
        color: "#52647A",
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: "#F2F5FA",
        lineHeight: 21,
    },
    saveBtn: {
        backgroundColor: "#1540C9",
        paddingVertical: 14,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 18,
    },
    saveBtnSuccess: {
        backgroundColor: "#0A7042",
    },
    savingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    saveBtnText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
    },
    footerNote: {
        fontSize: 13,
        color: "#52647A",
        marginTop: 28,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
        lineHeight: 20,
    },
});

