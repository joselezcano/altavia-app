import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { pickFlightPlanImage } from "@/hooks/useAircraftOperations";
import {
    PayableMethod,
    PayablePaymentModalProps,
} from "@/types/aircraft-operations";
import {
    formatGsFromUsd,
    formatIsoToDmy,
    formatUsd,
    getTodayIso,
    isValidIsoDate,
    PAYABLE_METHOD_LABELS,
    PAYABLE_METHODS,
} from "@/utils/aircraft-operations-calc";
import { brandFont } from "@/utils/brand-fonts";
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

/**
 * "Registrar pago" de una compra a crédito (gasto suelto o combustible):
 * fecha, medio, foto del recibo de cancelación y notas.
 * Dentro del <Modal> solo Text/View nativos con StyleSheet (regla 5 de NativeWind).
 */
export function PayablePaymentModal({
    visible,
    item,
    config,
    isSaving,
    onClose,
    onConfirm,
}: PayablePaymentModalProps) {
    const [fechaPago, setFechaPago] = useState(getTodayIso());
    const [medioPago, setMedioPago] = useState<PayableMethod>("transferencia");
    const [reciboUri, setReciboUri] = useState<string | null>(null);
    const [notas, setNotas] = useState("");
    const [isPicking, setIsPicking] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setFechaPago(getTodayIso());
        setMedioPago("transferencia");
        setReciboUri(null);
        setNotas("");
    }, [visible, item]);

    if (!item) return null;

    const handlePick = async (source: "library" | "camera") => {
        try {
            setIsPicking(true);
            const uri = await pickFlightPlanImage(source, { fileUriOnly: true });
            if (uri) setReciboUri(uri);
        } catch (err: any) {
            Alert.alert("Recibo", err?.message || "No se pudo seleccionar la imagen.");
        } finally {
            setIsPicking(false);
        }
    };

    const handleConfirm = async () => {
        const fecha = fechaPago.trim();
        if (!isValidIsoDate(fecha)) {
            Alert.alert("Fecha inválida", "Ingresá la fecha del pago (AAAA-MM-DD).");
            return;
        }
        await onConfirm({
            fechaPago: fecha,
            medioPago,
            reciboUri,
            notasPago: notas,
        });
    };

    const proveedorLine = [
        item.proveedor || "Proveedor sin cargar",
        item.facturaNumero ? `Fact. ${item.facturaNumero}` : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.scrim}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.sheet}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.headerTitle, brandFont(700)]}>Registrar pago</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollBody}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Resumen de la deuda */}
                        <View style={styles.summaryBox}>
                            <Text style={[styles.summaryConcept, brandFont(600)]} numberOfLines={2}>
                                {item.concepto}
                            </Text>
                            <Text style={[styles.summarySub, brandFont(400)]} numberOfLines={1}>
                                {proveedorLine}
                            </Text>
                            <View style={styles.summaryAmountRow}>
                                <Text style={[styles.summaryAmount, brandFont(700)]}>
                                    {formatUsd(item.amountUsd)}
                                </Text>
                                <Text style={[styles.summaryGs, brandFont(500)]}>
                                    {formatGsFromUsd(item.amountUsd, config)}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.summaryDue,
                                    item.vencido ? styles.overdueText : null,
                                    brandFont(600),
                                ]}
                            >
                                {item.vencido ? "Venció el " : "Vence el "}
                                {formatIsoToDmy(item.vencimiento)}
                            </Text>
                        </View>

                        {/* Fecha del pago */}
                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, brandFont(600)]}>Fecha del pago (AAAA-MM-DD)</Text>
                            <View style={styles.inlineRow}>
                                <TextInput
                                    value={fechaPago}
                                    onChangeText={setFechaPago}
                                    placeholder="2026-11-09"
                                    placeholderTextColor={BRAND_COLORS.textMuted}
                                    style={[styles.input, styles.flex1, brandFont(500)]}
                                />
                                <TouchableOpacity onPress={() => setFechaPago(getTodayIso())} style={styles.chip}>
                                    <Text style={[styles.chipText, brandFont(700)]}>Hoy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Medio de pago */}
                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, brandFont(600)]}>Medio de pago</Text>
                            <View style={styles.methodsWrap}>
                                {PAYABLE_METHODS.map((m) => {
                                    const active = m === medioPago;
                                    return (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => setMedioPago(m)}
                                            style={[styles.methodChip, active ? styles.methodChipActive : null]}
                                            activeOpacity={0.8}
                                        >
                                            <Text
                                                style={[
                                                    styles.methodChipText,
                                                    active ? styles.methodChipTextActive : null,
                                                    brandFont(600),
                                                ]}
                                            >
                                                {PAYABLE_METHOD_LABELS[m]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Foto del recibo de cancelación */}
                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, brandFont(600)]}>Foto del recibo de cancelación</Text>
                            <View style={styles.inlineRow}>
                                <TouchableOpacity
                                    onPress={() => handlePick("library")}
                                    disabled={isPicking}
                                    style={styles.photoBtn}
                                >
                                    <Ionicons name="image-outline" size={18} color={BRAND_COLORS.azur} />
                                    <Text style={[styles.photoBtnText, brandFont(600)]}>
                                        {isPicking ? "Cargando…" : "Galería"}
                                    </Text>
                                </TouchableOpacity>
                                {Platform.OS !== "web" && (
                                    <TouchableOpacity
                                        onPress={() => handlePick("camera")}
                                        disabled={isPicking}
                                        style={styles.photoBtn}
                                    >
                                        <Ionicons name="camera-outline" size={18} color={BRAND_COLORS.azur} />
                                        <Text style={[styles.photoBtnText, brandFont(600)]}>Cámara</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {reciboUri ? (
                                <View style={styles.thumbWrap}>
                                    <Image source={{ uri: reciboUri }} style={styles.thumb} resizeMode="cover" />
                                    <TouchableOpacity onPress={() => setReciboUri(null)}>
                                        <Text style={[styles.linkText, brandFont(600)]}>Quitar la foto</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={[styles.hint, brandFont(400)]}>
                                    Opcional. Sirve de respaldo de que la factura quedó cancelada.
                                </Text>
                            )}
                        </View>

                        {/* Notas */}
                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, brandFont(600)]}>Notas</Text>
                            <TextInput
                                value={notas}
                                onChangeText={setNotas}
                                placeholder="Ej: transferencia desde Itaú, nº de operación"
                                placeholderTextColor={BRAND_COLORS.textMuted}
                                multiline
                                style={[styles.input, styles.notesInput, brandFont(400)]}
                            />
                        </View>

                        <View style={styles.actionsRow}>
                            <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.cancelBtn}>
                                <Text style={[styles.cancelBtnText, brandFont(700)]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={isSaving}
                                style={[styles.saveBtn, isSaving ? styles.saveBtnBusy : null]}
                            >
                                {isSaving ? (
                                    <View style={styles.inlineRow}>
                                        <ActivityIndicator size="small" color={BRAND_COLORS.white} />
                                        <Text style={[styles.saveBtnText, brandFont(700)]}>Guardando…</Text>
                                    </View>
                                ) : (
                                    <Text style={[styles.saveBtnText, brandFont(700)]}>Marcar como pagado</Text>
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
        backgroundColor: "rgba(3, 4, 54, 0.45)",
        justifyContent: "flex-end",
        alignItems: "center",
    },
    sheet: {
        backgroundColor: BRAND_COLORS.white,
        width: "100%",
        maxWidth: 480,
        maxHeight: "90%",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        paddingHorizontal: 22,
        paddingTop: 20,
        paddingBottom: 28,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    headerTitle: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 19,
        color: BRAND_COLORS.navy,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: BRAND_COLORS.backgroundAlt,
        alignItems: "center",
        justifyContent: "center",
    },
    closeBtnText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 22,
        color: BRAND_COLORS.textMuted,
        lineHeight: 24,
    },
    scrollBody: {
        paddingBottom: 16,
    },
    summaryBox: {
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: 14,
        padding: 14,
        marginBottom: 18,
    },
    summaryConcept: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 15,
        color: BRAND_COLORS.navy,
    },
    summarySub: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.textMuted,
        marginTop: 3,
    },
    summaryAmountRow: {
        flexDirection: "row",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
    },
    summaryAmount: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 24,
        color: BRAND_COLORS.navy,
    },
    summaryGs: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.textMuted,
    },
    summaryDue: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.textMuted,
        marginTop: 6,
    },
    overdueText: {
        color: "#BC3324",
    },
    fieldGroup: {
        marginBottom: 16,
    },
    label: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 14.5,
        color: BRAND_COLORS.navy,
        marginBottom: 8,
    },
    hint: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.textMuted,
        marginTop: 7,
        lineHeight: 19,
    },
    input: {
        fontFamily: "NotoSans_400Regular",
        backgroundColor: BRAND_COLORS.white,
        color: BRAND_COLORS.navy,
        borderWidth: 1.5,
        borderColor: BRAND_COLORS.border,
        borderRadius: BRAND_RADII.input,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    notesInput: {
        minHeight: 70,
        textAlignVertical: "top",
    },
    flex1: {
        flex: 1,
    },
    inlineRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    chip: {
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderWidth: 1,
        borderColor: BRAND_COLORS.crystal,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: BRAND_RADII.input,
    },
    chipText: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.azur,
        fontSize: 14,
    },
    methodsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    methodChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: BRAND_RADII.pill,
        borderWidth: 1.5,
        borderColor: BRAND_COLORS.border,
        backgroundColor: BRAND_COLORS.white,
    },
    methodChipActive: {
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderColor: BRAND_COLORS.azur,
    },
    methodChipText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 14,
        color: BRAND_COLORS.navy,
    },
    methodChipTextActive: {
        color: BRAND_COLORS.azur,
    },
    photoBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderRadius: BRAND_RADII.input,
        borderWidth: 1.5,
        borderColor: BRAND_COLORS.border,
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    photoBtnText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 14,
        color: BRAND_COLORS.azur,
    },
    thumbWrap: {
        marginTop: 12,
        gap: 8,
    },
    thumb: {
        width: "100%",
        height: 160,
        borderRadius: 12,
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    linkText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13.5,
        color: "#BC3324",
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 10,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: BRAND_RADII.pill,
    },
    cancelBtnText: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.textMuted,
        fontSize: 15,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: BRAND_COLORS.azur,
        paddingVertical: 15,
        borderRadius: BRAND_RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    saveBtnBusy: {
        opacity: 0.7,
    },
    saveBtnText: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.white,
        fontSize: 15.5,
    },
});
