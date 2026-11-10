import { pickFlightPlanImage } from "@/hooks/useAircraftOperations";
import {
    AircraftOperationsConfig,
    OperationalCurrency,
    OperationalExpenseDoc,
    OperationalExpenseType,
    PaymentCondition,
} from "@/types/aircraft-operations";
import {
    addDaysToIso,
    DEFAULT_PAYABLE_DAYS,
    formatIsoToDmy,
    getExpenseDueDate,
    getExpensePaymentStatus,
    getTodayIso,
    isValidIsoDate,
    num,
    PAYABLE_METHOD_LABELS,
} from "@/utils/aircraft-operations-calc";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
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
    /** Abre la foto de la factura en grande (PhotoLightboxModal). */
    onOpenLightbox?: (imageUri: string) => void;
}

export function OperationalExpenseModal({
    visible,
    expense,
    config,
    isSaving,
    onClose,
    onSave,
    onDelete,
    onOpenLightbox,
}: OperationalExpenseModalProps) {
    const isNew = !expense;

    const [fecha, setFecha] = useState(getTodayIso());
    const [concepto, setConcepto] = useState("");
    const [proveedor, setProveedor] = useState("");
    const [monto, setMonto] = useState("");
    const [moneda, setMoneda] = useState<OperationalCurrency>("GS");
    const [tipo, setTipo] = useState<OperationalExpenseType>("otro");
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

    // Cuentas por pagar: condición de pago y datos de la factura del proveedor
    const [condicionPago, setCondicionPago] = useState<PaymentCondition>("contado");
    const [proveedorRuc, setProveedorRuc] = useState("");
    const [facturaNumero, setFacturaNumero] = useState("");
    const [facturaFecha, setFacturaFecha] = useState("");
    const [vencimiento, setVencimiento] = useState("");
    const [vencimientoTouched, setVencimientoTouched] = useState(false);
    const [facturaFotoUrl, setFacturaFotoUrl] = useState<string | null>(null);
    const [showFactura, setShowFactura] = useState(false);
    const [isPickingImage, setIsPickingImage] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setConfirmDeleteStep(false);

        const isCredit = expense?.condicionPago === "credito";
        setCondicionPago(isCredit ? "credito" : "contado");
        setProveedorRuc(expense?.proveedorRuc || "");
        setFacturaNumero(expense?.facturaNumero || "");
        setFacturaFecha(expense?.facturaFecha || "");
        setVencimiento(isCredit && expense ? getExpenseDueDate(expense) : "");
        setVencimientoTouched(isCredit && !!expense?.vencimiento);
        setFacturaFotoUrl(expense?.facturaFotoUrl || null);
        setShowFactura(
            isCredit ||
                !!expense?.proveedorRuc ||
                !!expense?.facturaNumero ||
                !!expense?.facturaFotoUrl
        );

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
        const isCredit = condicionPago === "credito";
        const facturaFechaClean = facturaFecha.trim();
        if (facturaFechaClean && !isValidIsoDate(facturaFechaClean)) {
            Alert.alert("Fecha de factura", "Revisá la fecha de la factura (AAAA-MM-DD).");
            return;
        }
        const vencimientoClean = isCredit ? vencimiento.trim() || defaultDueDate : "";
        if (isCredit && !isValidIsoDate(vencimientoClean)) {
            Alert.alert("Vencimiento", "Revisá la fecha de vencimiento (AAAA-MM-DD).");
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
            // Cuentas por pagar. Al contado queda pagado en la fecha del gasto.
            condicionPago,
            proveedorRuc: proveedorRuc.trim() || null,
            facturaNumero: facturaNumero.trim() || null,
            facturaFecha: facturaFechaClean || null,
            vencimiento: isCredit ? vencimientoClean : null,
            facturaFotoUrl: facturaFotoUrl || null,
            ...(isCredit
                ? wasPaidCredit
                    ? {
                          estadoPago: "pagado" as const,
                          fechaPago: expense?.fechaPago ?? null,
                          medioPago: expense?.medioPago ?? null,
                          reciboFotoUrl: expense?.reciboFotoUrl ?? null,
                          notasPago: expense?.notasPago ?? null,
                      }
                    : {
                          estadoPago: "pendiente" as const,
                          fechaPago: null,
                          medioPago: null,
                          reciboFotoUrl: null,
                          notasPago: null,
                      }
                : {
                      estadoPago: "pagado" as const,
                      fechaPago: fecha.trim(),
                  }),
            createdAt: expense?.createdAt,
        };

        await onSave(docToSave);
    };

    // Vencimiento por defecto: fecha de la factura (o del gasto) + 30 días.
    const dueBase = isValidIsoDate(facturaFecha.trim())
        ? facturaFecha.trim()
        : isValidIsoDate(fecha.trim())
          ? fecha.trim()
          : getTodayIso();
    const defaultDueDate = addDaysToIso(dueBase, DEFAULT_PAYABLE_DAYS);

    const wasPaidCredit =
        !!expense &&
        expense.condicionPago === "credito" &&
        getExpensePaymentStatus(expense) === "pagado";

    const handleCondicionChange = (next: PaymentCondition) => {
        setCondicionPago(next);
        if (next === "credito") {
            setShowFactura(true);
            if (!vencimientoTouched) setVencimiento(defaultDueDate);
        }
    };

    const handleFacturaFechaChange = (val: string) => {
        setFacturaFecha(val);
        if (!vencimientoTouched && isValidIsoDate(val.trim())) {
            setVencimiento(addDaysToIso(val.trim(), DEFAULT_PAYABLE_DAYS));
        }
    };

    const handlePickFactura = async (source: "library" | "camera") => {
        try {
            setIsPickingImage(true);
            const uri = await pickFlightPlanImage(source, { fileUriOnly: true });
            if (uri) setFacturaFotoUrl(uri);
        } catch (err: any) {
            Alert.alert("Factura", err?.message || "No se pudo seleccionar la imagen.");
        } finally {
            setIsPickingImage(false);
        }
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

                        {/* ¿Cómo se paga? (cuentas por pagar) */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>¿Cómo se paga?</Text>
                            <View style={styles.segmentedRow}>
                                <TouchableOpacity
                                    onPress={() => handleCondicionChange("contado")}
                                    style={[
                                        styles.segButton,
                                        condicionPago === "contado" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            condicionPago === "contado"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        Contado
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleCondicionChange("credito")}
                                    style={[
                                        styles.segButton,
                                        condicionPago === "credito" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            condicionPago === "credito"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        A crédito
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.hint}>
                                {condicionPago === "credito"
                                    ? "Queda en «Por pagar» hasta que registres el pago. El resultado del mes lo cuenta igual en la fecha del gasto."
                                    : "Queda pagado en la fecha del gasto."}
                            </Text>

                            {condicionPago === "credito" && !!expense && (
                                <View style={styles.statusBox}>
                                    <Text style={styles.statusBoxText}>
                                        {wasPaidCredit
                                            ? `Pagado el ${formatIsoToDmy(expense.fechaPago || "")}${expense.medioPago ? ` · ${PAYABLE_METHOD_LABELS[expense.medioPago]}` : ""}.`
                                            : expense.condicionPago === "credito"
                                              ? "Pendiente de pago. Registrá el pago desde la pestaña «Por pagar»."
                                              : "Al guardar queda pendiente de pago."}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Factura del proveedor */}
                        {!showFactura ? (
                            <TouchableOpacity
                                onPress={() => setShowFactura(true)}
                                style={styles.addFacturaLink}
                            >
                                <Text style={styles.linkButtonText}>
                                    + Agregar datos de la factura
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.facturaBox}>
                                <Text style={styles.sectionHeader}>FACTURA DEL PROVEEDOR</Text>

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>RUC del proveedor</Text>
                                    <TextInput
                                        value={proveedorRuc}
                                        onChangeText={setProveedorRuc}
                                        placeholder="Ej: 80012345-6"
                                        placeholderTextColor="#93A3B6"
                                        style={styles.input}
                                    />
                                </View>

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Nº de factura</Text>
                                    <TextInput
                                        value={facturaNumero}
                                        onChangeText={setFacturaNumero}
                                        placeholder="001-001-0001234"
                                        placeholderTextColor="#93A3B6"
                                        style={styles.input}
                                    />
                                </View>

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Fecha de la factura (AAAA-MM-DD)</Text>
                                    <TextInput
                                        value={facturaFecha}
                                        onChangeText={handleFacturaFechaChange}
                                        placeholder={fecha || "2026-10-31"}
                                        placeholderTextColor="#93A3B6"
                                        style={styles.input}
                                    />
                                </View>

                                {condicionPago === "credito" && (
                                    <View style={styles.fieldGroup}>
                                        <Text style={styles.label}>Vence (AAAA-MM-DD)</Text>
                                        <TextInput
                                            value={vencimiento}
                                            onChangeText={(v) => {
                                                setVencimiento(v);
                                                setVencimientoTouched(true);
                                            }}
                                            placeholder={defaultDueDate}
                                            placeholderTextColor="#93A3B6"
                                            style={styles.input}
                                        />
                                        <Text style={styles.hint}>
                                            Por defecto, la factura + {DEFAULT_PAYABLE_DAYS} días (
                                            {formatIsoToDmy(defaultDueDate)}).
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Foto de la factura</Text>
                                    <View style={styles.dateRow}>
                                        <TouchableOpacity
                                            onPress={() => handlePickFactura("library")}
                                            disabled={isPickingImage}
                                            style={styles.photoPickerBtn}
                                        >
                                            <Ionicons name="image-outline" size={18} color="#1540C9" />
                                            <Text style={styles.photoPickerBtnText}>
                                                {isPickingImage ? "Cargando…" : "Galería"}
                                            </Text>
                                        </TouchableOpacity>
                                        {Platform.OS !== "web" && (
                                            <TouchableOpacity
                                                onPress={() => handlePickFactura("camera")}
                                                disabled={isPickingImage}
                                                style={styles.photoPickerBtn}
                                            >
                                                <Ionicons name="camera-outline" size={18} color="#1540C9" />
                                                <Text style={styles.photoPickerBtnText}>Cámara</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {facturaFotoUrl ? (
                                        <View style={styles.photoWrap}>
                                            <TouchableOpacity
                                                onPress={() => onOpenLightbox?.(facturaFotoUrl)}
                                                activeOpacity={0.85}
                                                disabled={!onOpenLightbox}
                                            >
                                                <Image
                                                    source={{ uri: facturaFotoUrl }}
                                                    style={styles.photoThumb}
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setFacturaFotoUrl(null)}>
                                                <Text style={styles.removePhotoText}>Quitar la foto</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <Text style={styles.hint}>Opcional.</Text>
                                    )}
                                </View>
                            </View>
                        )}

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
        fontFamily: "NotoSans_700Bold",
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
        fontFamily: "NotoSans_400Regular",
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
        fontFamily: "NotoSans_600SemiBold",
        color: "#091626",
        marginBottom: 8,
    },
    hint: {
        fontFamily: "NotoSans_400Regular",
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
        fontFamily: "NotoSans_500Medium",
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
        fontFamily: "NotoSans_700Bold",
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
        fontFamily: "NotoSans_700Bold",
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
        fontFamily: "NotoSans_600SemiBold",
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
    statusBox: {
        marginTop: 10,
        backgroundColor: "#F4F7FC",
        borderRadius: 11,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    statusBoxText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13.5,
        color: "#091626",
        lineHeight: 19,
    },
    addFacturaLink: {
        paddingVertical: 6,
        marginBottom: 10,
    },
    linkButtonText: {
        color: "#1540C9",
        fontFamily: "NotoSans_700Bold",
        fontSize: 14,
    },
    facturaBox: {
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
        paddingTop: 14,
    },
    sectionHeader: {
        fontSize: 12,
        letterSpacing: 1,
        color: "#52647A",
        fontFamily: "NotoSans_700Bold",
        marginBottom: 12,
    },
    photoPickerBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        backgroundColor: "#F4F7FC",
    },
    photoPickerBtnText: {
        color: "#1540C9",
        fontFamily: "NotoSans_600SemiBold",
        fontSize: 14,
    },
    photoWrap: {
        marginTop: 12,
        gap: 8,
    },
    photoThumb: {
        width: "100%",
        height: 160,
        borderRadius: 12,
        backgroundColor: "#F4F7FC",
    },
    removePhotoText: {
        color: "#BC3324",
        fontFamily: "NotoSans_600SemiBold",
        fontSize: 13.5,
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
        fontFamily: "NotoSans_700Bold",
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
        fontFamily: "NotoSans_700Bold",
        fontSize: 15.5,
    },
});

