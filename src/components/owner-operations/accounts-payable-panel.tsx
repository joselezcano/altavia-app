import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import {
    AccountsPayablePanelProps,
    PayableItem,
} from "@/types/aircraft-operations";
import {
    formatGsFromUsd,
    formatIsoToDmy,
    formatMonthLabel,
    formatUsd,
    PAYABLE_METHOD_LABELS,
} from "@/utils/aircraft-operations-calc";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const NEG = "#BC3324";
const NEG_BG = "#FCEAE7";
const POS = "#0A7042";
const POS_BG = "#E4F4EC";

function dueLabel(item: PayableItem): string {
    const d = item.diasParaVencer;
    if (d < 0) {
        const n = -d;
        return `Venció hace ${n} ${n === 1 ? "día" : "días"} (${formatIsoToDmy(item.vencimiento)})`;
    }
    if (d === 0) return "Vence hoy";
    if (d === 1) return "Vence mañana";
    return `Vence el ${formatIsoToDmy(item.vencimiento)} · en ${d} días`;
}

function providerLine(item: PayableItem): string {
    return [
        item.proveedor || "Proveedor sin cargar",
        item.proveedorRuc ? `RUC ${item.proveedorRuc}` : null,
        item.facturaNumero ? `Fact. ${item.facturaNumero}` : null,
    ]
        .filter(Boolean)
        .join(" · ");
}

/**
 * Sección "Por pagar" de GIO: compras a crédito pendientes (gastos y combustible)
 * ordenadas por vencimiento y lo pagado en el mes elegido.
 * Es solo seguimiento de caja: el resultado del mes sigue siendo por devengado.
 */
export function AccountsPayablePanel({
    summary,
    config,
    monthKey,
    onShiftMonth,
    busyKey,
    onRegisterPayment,
    onUndoPayment,
    onOpenPhoto,
    onOpenItem,
}: AccountsPayablePanelProps) {
    const hasPending = summary.pendientes.length > 0;

    return (
        <View style={styles.wrap}>
            {/* Total pendiente */}
            <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowDot} />
                <Text style={[styles.eyebrowText, brandFont(700)]}>CUENTAS POR PAGAR</Text>
            </View>

            {hasPending ? (
                <>
                    <View style={styles.totalRow}>
                        <Text style={[styles.totalPrefix, brandFont(700)]}>PENDIENTE:</Text>
                        <Text style={[styles.totalNumber, brandFont(700)]}>
                            {formatUsd(summary.totalPendienteUsd)}
                        </Text>
                    </View>
                    <Text style={[styles.totalGs, brandFont(600)]}>
                        {formatGsFromUsd(summary.totalPendienteUsd, config)}
                    </Text>
                    {summary.cantidadVencidos > 0 ? (
                        <View style={[styles.pill, styles.pillBad]}>
                            <View style={[styles.pillDot, styles.dotBad]} />
                            <Text style={[styles.pillText, styles.negText, brandFont(700)]}>
                                {summary.cantidadVencidos === 1
                                    ? "1 vencida"
                                    : `${summary.cantidadVencidos} vencidas`}
                                : {formatUsd(summary.totalVencidoUsd)} ·{" "}
                                {formatGsFromUsd(summary.totalVencidoUsd, config)}
                            </Text>
                        </View>
                    ) : (
                        <View style={[styles.pill, styles.pillOk]}>
                            <View style={[styles.pillDot, styles.dotOk]} />
                            <Text style={[styles.pillText, styles.posText, brandFont(700)]}>
                                Nada vencido
                            </Text>
                        </View>
                    )}
                </>
            ) : (
                <>
                    <Text style={[styles.noneText, brandFont(600)]}>Todo al día</Text>
                    <Text style={[styles.narrative, brandFont(400)]}>
                        No hay facturas a crédito pendientes. Cuando cargues un gasto o el
                        combustible de un vuelo «a crédito», aparece acá hasta que registres el pago.
                    </Text>
                </>
            )}

            {/* Lista de pendientes */}
            {hasPending && (
                <>
                    <Text style={[styles.sectionHeader, brandFont(700)]}>
                        PENDIENTES ({summary.pendientes.length})
                    </Text>
                    <View style={styles.list}>
                        {summary.pendientes.map((item) => (
                            <View
                                key={item.key}
                                style={[styles.card, item.vencido ? styles.cardOverdue : null]}
                            >
                                <TouchableOpacity
                                    onPress={() => onOpenItem(item)}
                                    activeOpacity={0.7}
                                    style={styles.cardTop}
                                >
                                    <View style={styles.cardMiddle}>
                                        <View style={styles.kindRow}>
                                            <Ionicons
                                                name={item.kind === "combustible" ? "water-outline" : "receipt-outline"}
                                                size={13}
                                                color={BRAND_COLORS.textMuted}
                                            />
                                            <Text style={[styles.kindText, brandFont(700)]}>
                                                {item.kind === "combustible" ? "COMBUSTIBLE" : "GASTO"}
                                            </Text>
                                        </View>
                                        <Text style={[styles.cardTitle, brandFont(600)]} numberOfLines={2}>
                                            {item.concepto}
                                        </Text>
                                        <Text style={[styles.cardSub, brandFont(400)]} numberOfLines={1}>
                                            {providerLine(item)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardDue,
                                                item.vencido ? styles.negText : null,
                                                brandFont(item.vencido ? 700 : 500),
                                            ]}
                                        >
                                            {dueLabel(item)}
                                        </Text>
                                    </View>
                                    <View style={styles.cardRight}>
                                        <Text style={[styles.cardAmount, brandFont(700)]}>
                                            {formatUsd(item.amountUsd)}
                                        </Text>
                                        <Text style={[styles.cardGs, brandFont(500)]}>
                                            {formatGsFromUsd(item.amountUsd, config)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        onPress={() => onRegisterPayment(item)}
                                        style={styles.payBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="checkmark-circle-outline" size={16} color={BRAND_COLORS.white} />
                                        <Text style={[styles.payBtnText, brandFont(700)]}>Registrar pago</Text>
                                    </TouchableOpacity>
                                    {item.facturaFotoUrl ? (
                                        <TouchableOpacity
                                            onPress={() => onOpenPhoto(item.facturaFotoUrl as string)}
                                            style={styles.ghostBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="image-outline" size={15} color={BRAND_COLORS.azur} />
                                            <Text style={[styles.ghostBtnText, brandFont(600)]}>Factura</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                </>
            )}

            {/* Pagado en el mes elegido */}
            <View style={styles.monthNavRow}>
                <TouchableOpacity onPress={() => onShiftMonth(-1)} style={styles.navArrow} activeOpacity={0.7}>
                    <Text style={styles.navArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={[styles.navLabel, brandFont(700)]}>Pagado en {formatMonthLabel(monthKey)}</Text>
                <TouchableOpacity onPress={() => onShiftMonth(1)} style={styles.navArrow} activeOpacity={0.7}>
                    <Text style={styles.navArrowText}>›</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {summary.pagadosMes.length === 0 ? (
                    <Text style={[styles.emptyText, brandFont(400)]}>
                        No se registraron pagos de facturas a crédito en {formatMonthLabel(monthKey)}.
                    </Text>
                ) : (
                    summary.pagadosMes.map((item) => {
                        const isBusy = busyKey === item.key;
                        const medio = item.medioPago ? PAYABLE_METHOD_LABELS[item.medioPago] : null;
                        return (
                            <View key={item.key} style={styles.card}>
                                <TouchableOpacity
                                    onPress={() => onOpenItem(item)}
                                    activeOpacity={0.7}
                                    style={styles.cardTop}
                                >
                                    <View style={styles.cardMiddle}>
                                        <Text style={[styles.cardTitle, brandFont(600)]} numberOfLines={2}>
                                            {item.concepto}
                                        </Text>
                                        <Text style={[styles.cardSub, brandFont(400)]} numberOfLines={1}>
                                            {providerLine(item)}
                                        </Text>
                                        <Text style={[styles.cardDue, styles.posText, brandFont(600)]}>
                                            {item.pagoAsumido
                                                ? `Se asume pagado al vencer (${formatIsoToDmy(item.fechaPago || item.vencimiento)})`
                                                : `Pagado el ${formatIsoToDmy(item.fechaPago || "")}${medio ? ` · ${medio}` : ""}`}
                                        </Text>
                                        {item.notasPago ? (
                                            <Text style={[styles.cardNotes, brandFont(400)]} numberOfLines={2}>
                                                {item.notasPago}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.cardRight}>
                                        <Text style={[styles.cardAmount, brandFont(700)]}>
                                            {formatUsd(item.amountUsd)}
                                        </Text>
                                        <Text style={[styles.cardGs, brandFont(500)]}>
                                            {formatGsFromUsd(item.amountUsd, config)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.actionsRow}>
                                    {item.reciboFotoUrl ? (
                                        <TouchableOpacity
                                            onPress={() => onOpenPhoto(item.reciboFotoUrl as string)}
                                            style={styles.ghostBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="document-attach-outline" size={15} color={BRAND_COLORS.azur} />
                                            <Text style={[styles.ghostBtnText, brandFont(600)]}>Recibo</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {item.facturaFotoUrl ? (
                                        <TouchableOpacity
                                            onPress={() => onOpenPhoto(item.facturaFotoUrl as string)}
                                            style={styles.ghostBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="image-outline" size={15} color={BRAND_COLORS.azur} />
                                            <Text style={[styles.ghostBtnText, brandFont(600)]}>Factura</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {item.pagoAsumido ? (
                                        <TouchableOpacity
                                            onPress={() => onRegisterPayment(item)}
                                            style={styles.ghostBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="create-outline" size={15} color={BRAND_COLORS.azur} />
                                            <Text style={[styles.ghostBtnText, brandFont(600)]}>Registrar pago</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    <TouchableOpacity
                                        onPress={() => onUndoPayment(item)}
                                        disabled={isBusy}
                                        style={styles.undoBtn}
                                        activeOpacity={0.8}
                                    >
                                        {isBusy ? (
                                            <ActivityIndicator size="small" color={NEG} />
                                        ) : (
                                            <Text style={[styles.undoBtnText, brandFont(700)]}>
                                                {item.pagoAsumido ? "No está pagado" : "Deshacer pago"}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            <Text style={[styles.footer, brandFont(400)]}>
                Facturas a crédito pagadas en {formatMonthLabel(monthKey)}:{" "}
                <Text style={[styles.footerBold, brandFont(700)]}>
                    {formatUsd(summary.totalPagadoMesUsd)}
                </Text>{" "}
                ({formatGsFromUsd(summary.totalPagadoMesUsd, config)}). Al contado en el mes:{" "}
                <Text style={[styles.footerBold, brandFont(700)]}>
                    {formatUsd(summary.totalContadoMesUsd)}
                </Text>
                . Esto es solo el seguimiento de los pagos: el resultado del mes no cambia.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingTop: 24,
    },
    eyebrowRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    eyebrowDot: {
        width: 6,
        height: 6,
        borderRadius: 1.5,
        backgroundColor: BRAND_COLORS.azur,
    },
    eyebrowText: {
        fontSize: 12,
        letterSpacing: 1.1,
        color: BRAND_COLORS.textMuted,
    },
    totalRow: {
        flexDirection: "row",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 14,
    },
    totalPrefix: {
        fontSize: 13,
        letterSpacing: 1,
        color: BRAND_COLORS.textMuted,
    },
    totalNumber: {
        fontSize: 40,
        letterSpacing: -1,
        color: BRAND_COLORS.navy,
    },
    totalGs: {
        fontSize: 14.5,
        color: BRAND_COLORS.textMuted,
        marginTop: 6,
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 7,
        marginTop: 14,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 99,
    },
    pillOk: {
        backgroundColor: POS_BG,
    },
    pillBad: {
        backgroundColor: NEG_BG,
    },
    pillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dotOk: {
        backgroundColor: POS,
    },
    dotBad: {
        backgroundColor: NEG,
    },
    pillText: {
        fontSize: 12.5,
    },
    posText: {
        color: POS,
    },
    negText: {
        color: NEG,
    },
    noneText: {
        fontSize: 26,
        color: BRAND_COLORS.textMuted,
        marginTop: 14,
    },
    narrative: {
        marginTop: 12,
        color: BRAND_COLORS.textMuted,
        fontSize: 15,
        lineHeight: 23,
    },
    sectionHeader: {
        fontSize: 12,
        letterSpacing: 1,
        color: BRAND_COLORS.textMuted,
        marginTop: 32,
        marginBottom: 10,
    },
    list: {
        gap: 10,
    },
    card: {
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: 14,
        padding: 14,
        backgroundColor: BRAND_COLORS.white,
    },
    cardOverdue: {
        borderColor: NEG,
        backgroundColor: "#FFF7F5",
    },
    cardTop: {
        flexDirection: "row",
        gap: 12,
    },
    cardMiddle: {
        flex: 1,
    },
    kindRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginBottom: 4,
    },
    kindText: {
        fontSize: 10.5,
        letterSpacing: 0.8,
        color: BRAND_COLORS.textMuted,
    },
    cardTitle: {
        fontSize: 15,
        color: BRAND_COLORS.navy,
    },
    cardSub: {
        fontSize: 12.5,
        color: BRAND_COLORS.textMuted,
        marginTop: 3,
    },
    cardDue: {
        fontSize: 12.5,
        color: BRAND_COLORS.textMuted,
        marginTop: 6,
    },
    cardNotes: {
        fontSize: 12.5,
        color: BRAND_COLORS.textMuted,
        marginTop: 4,
        fontStyle: "italic",
    },
    cardRight: {
        alignItems: "flex-end",
    },
    cardAmount: {
        fontSize: 17,
        color: BRAND_COLORS.navy,
    },
    cardGs: {
        fontSize: 11.5,
        color: BRAND_COLORS.textMuted,
        marginTop: 3,
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 12,
    },
    payBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: BRAND_COLORS.azur,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: BRAND_RADII.pill,
    },
    payBtnText: {
        color: BRAND_COLORS.white,
        fontSize: 13.5,
    },
    ghostBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: BRAND_COLORS.surfaceTint,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: BRAND_RADII.pill,
    },
    ghostBtnText: {
        color: BRAND_COLORS.azur,
        fontSize: 13,
    },
    undoBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: BRAND_RADII.pill,
        minWidth: 60,
        alignItems: "center",
    },
    undoBtnText: {
        color: NEG,
        fontSize: 13,
    },
    monthNavRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 34,
        marginBottom: 14,
    },
    navArrow: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: BRAND_COLORS.backgroundAlt,
        alignItems: "center",
        justifyContent: "center",
    },
    navArrowText: {
        fontSize: 20,
        color: BRAND_COLORS.textMuted,
        lineHeight: 22,
    },
    navLabel: {
        fontSize: 15.5,
        color: BRAND_COLORS.navy,
        minWidth: 180,
        textAlign: "center",
    },
    emptyText: {
        fontSize: 14,
        color: BRAND_COLORS.textMuted,
        lineHeight: 21,
        paddingVertical: 12,
    },
    footer: {
        fontSize: 13.5,
        color: BRAND_COLORS.textMuted,
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: BRAND_COLORS.border,
        lineHeight: 20,
    },
    footerBold: {
        color: BRAND_COLORS.navy,
    },
});
