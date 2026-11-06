import {
    AircraftOperationsConfig,
    OperationalCurrency,
    OperationalExpenseDoc,
    OperationalExpenseType,
} from "@/types/aircraft-operations";
import {
    formatIsoToDmy,
    getTodayIso,
    num,
} from "@/utils/aircraft-operations-calc";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface OperationalExpenseModalProps {
    visible: boolean;
    expense: OperationalExpenseDoc | null;
    config: AircraftOperationsConfig;
    isSaving: boolean;
    onClose: () => void;
    onSave: (expenseDoc: OperationalExpenseDoc) => Promise<void>;
    onDelete?: (expenseId: string) => Promise<void>;
}

export function OperationalExpenseModal({
    visible,
    expense,
    config,
    isSaving,
    onClose,
    onSave,
    onDelete,
}: OperationalExpenseModalProps) {
    const isNew = !expense;

    const [fecha, setFecha] = useState(getTodayIso());
    const [concepto, setConcepto] = useState("");
    const [proveedor, setProveedor] = useState("");
    const [monto, setMonto] = useState("");
    const [moneda, setMoneda] = useState<OperationalCurrency>("GS");
    const [tipo, setTipo] = useState<OperationalExpenseType>("otro");
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setConfirmDeleteStep(false);

        if (expense) {
            setFecha(expense.fecha || getTodayIso());
            setConcepto(expense.concepto || "");
            setProveedor(expense.proveedor || "");
            setMonto(expense.monto != null ? String(expense.monto) : "");
            setMoneda(expense.moneda || "GS");
            setTipo(expense.tipo === "mantenimiento" ? "mantenimiento" : "otro");
        } else {
            setFecha(getTodayIso());
            setConcepto("");
            setProveedor("");
            setMonto("");
            setMoneda("GS");
            setTipo("otro");
        }
    }, [visible, expense]);

    const handleSubmit = async () => {
        if (!fecha.trim()) {
            Alert.alert("Fecha requerida", "Ingresá la fecha del gasto (AAAA-MM-DD).");
            return;
        }
        if (!monto.trim() || num(monto) <= 0) {
            Alert.alert("Monto requerido", "Ingresá el monto pagado.");
            return;
        }

        const expenseId =
            expense?.id ||
            `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

        const docToSave: OperationalExpenseDoc = {
            id: expenseId,
            ownerId: config.ownerId,
            aircraftId: config.aircraftId,
            aircraftRegistration: config.aircraftRegistration,
            fecha: fecha.trim(),
            concepto: concepto.trim() || "Gasto",
            proveedor: proveedor.trim(),
            monto: num(monto),
            moneda,
            tipo,
            createdAt: expense?.createdAt,
        };

        await onSave(docToSave);
    };

    const handleDeletePress = async () => {
        if (!expense || !onDelete) return;
        if (!confirmDeleteStep) {
            setConfirmDeleteStep(true);
            return;
        }
        await onDelete(expense.id);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.scrim}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.sheet}>
                    {/* Cabecera */}
                    <View style={styles.headerRow}>
                        <Text style={styles.headerTitle}>
                            {isNew
                                ? "Nuevo gasto"
                                : `Gasto del ${formatIsoToDmy(expense.fecha)}`}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollBody}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Fecha */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
                            <View style={styles.dateRow}>
                                <TextInput
                                    value={fecha}
                                    onChangeText={setFecha}
                                    placeholder="2026-10-31"
                                    placeholderTextColor="#93A3B6"
                                    style={[styles.input, { flex: 1 }]}
                                />
                                <TouchableOpacity
                                    onPress={() => setFecha(getTodayIso())}
                                    style={styles.todayChip}
                                >
                                    <Text style={styles.todayChipText}>Hoy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Qué se pagó */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Qué se pagó</Text>
                            <TextInput
                                value={concepto}
                                onChangeText={setConcepto}
                                placeholder="Ej: inspección de 100 horas"
                                placeholderTextColor="#93A3B6"
                                style={styles.input}
                            />
                        </View>

                        {/* A quién */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>A quién</Text>
                            <TextInput
                                value={proveedor}
                                onChangeText={setProveedor}
                                placeholder="Ej: Astorga"
                                placeholderTextColor="#93A3B6"
                                style={styles.input}
                            />
                        </View>

                        {/* Monto */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Monto</Text>
                            <View style={styles.amountCurrencyRow}>
                                <TextInput
                                    value={monto}
                                    onChangeText={setMonto}
                                    placeholder="350000"
                                    placeholderTextColor="#93A3B6"
                                    keyboardType="decimal-pad"
                                    style={[styles.input, { flex: 1 }]}
                                />
                                <TouchableOpacity
                                    onPress={() =>
                                        setMoneda((prev) => (prev === "GS" ? "USD" : "GS"))
                                    }
                                    style={styles.currencyToggleBtn}
                                >
                                    <Text style={styles.currencyToggleText}>
                                        {moneda === "GS" ? "Gs" : "USD"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.hint}>
                                Solo gastos que no son de un vuelo. Los fijos ya están en
                                Ajustes.
                            </Text>
                        </View>

                        {/* ¿Es mantenimiento del avión? */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>¿Es mantenimiento del avión?</Text>
                            <View style={styles.segmentedRow}>
                                <TouchableOpacity
                                    onPress={() => setTipo("mantenimiento")}
                                    style={[
                                        styles.segButton,
                                        tipo === "mantenimiento" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            tipo === "mantenimiento"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        Sí
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setTipo("otro")}
                                    style={[
                                        styles.segButton,
                                        tipo === "otro" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            tipo === "otro" ? styles.segButtonTextActive : null,
                                        ]}
                                    >
                                        No, otro gasto
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.hint}>
                                {tipo === "mantenimiento"
                                    ? "Sale del fondo de mantenimiento que se llena con cada hora volada. No vuelve a restar del mes."
                                    : "Resta del resultado del mes, como un gasto más."}
                            </Text>
                        </View>

                        {/* Botones de Acción */}
                        <View style={styles.actionsRow}>
                            {!isNew && onDelete && (
                                <TouchableOpacity
                                    onPress={handleDeletePress}
                                    disabled={isSaving}
                                    style={[
                                        styles.deleteBtn,
                                        confirmDeleteStep ? styles.deleteBtnConfirm : null,
                                    ]}
                                >
                                    <Text style={styles.deleteBtnText}>
                                        {confirmDeleteStep ? "¿Seguro?" : "Borrar"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={isSaving}
                                style={[
                                    styles.saveBtn,
                                    isSaving ? { opacity: 0.7 } : null,
                                ]}
                            >
                                {isSaving ? (
                                    <View style={styles.savingRow}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.saveBtnText}>Guardando…</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.saveBtnText}>Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: "rgba(9, 22, 38, 0.45)",
        justifyContent: "flex-end",
        alignItems: "center",
    },
    sheet: {
        backgroundColor: "#FFFFFF",
        width: "100%",
        maxWidth: 480,
        maxHeight: "90%",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: "#E7EDF5",
        paddingHorizontal: 22,
        paddingTop: 20,
        paddingBottom: 28,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: "700",
        color: "#091626",
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#F4F7FC",
        alignItems: "center",
        justifyContent: "center",
    },
    closeBtnText: {
        fontSize: 22,
        color: "#52647A",
        lineHeight: 24,
    },
    scrollBody: {
        paddingBottom: 16,
    },
    fieldGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14.5,
        fontWeight: "600",
        color: "#091626",
        marginBottom: 8,
    },
    hint: {
        fontSize: 13.5,
        color: "#52647A",
        marginTop: 7,
        lineHeight: 19,
    },
    input: {
        backgroundColor: "#FFFFFF",
        color: "#091626",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 11,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: "500",
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    todayChip: {
        backgroundColor: "#EEF3FE",
        borderWidth: 1,
        borderColor: "#7BA4FF",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 11,
    },
    todayChipText: {
        color: "#1540C9",
        fontWeight: "700",
        fontSize: 14,
    },
    amountCurrencyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    currencyToggleBtn: {
        backgroundColor: "#F4F7FC",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 11,
        paddingHorizontal: 14,
        paddingVertical: 12,
        minWidth: 72,
        alignItems: "center",
        justifyContent: "center",
    },
    currencyToggleText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1540C9",
    },
    segmentedRow: {
        flexDirection: "row",
        gap: 8,
    },
    segButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    segButtonActive: {
        backgroundColor: "#EEF3FE",
        borderColor: "#1540C9",
    },
    segButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#091626",
    },
    segButtonTextActive: {
        color: "#1540C9",
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 18,
    },
    deleteBtn: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 999,
    },
    deleteBtnConfirm: {
        backgroundColor: "#FCEAE7",
    },
    deleteBtnText: {
        color: "#BC3324",
        fontWeight: "700",
        fontSize: 15,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: "#1540C9",
        paddingVertical: 15,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    savingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    saveBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 15.5,
    },
});

