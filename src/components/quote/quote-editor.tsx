/**
 * Editor de presupuesto (paso 3 de new-booking). Componente controlado: el estado vive en
 * useQuoteDraft (src/hooks/useQuoteDraft.ts), que también explica el mecanismo de recálculo.
 * Todos los montos son USD SIN IVA; el cliente paga + IVA 10 %.
 */
import { AmountInput } from "@/components/quote/amount-input";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { isItemEdited } from "@/hooks/useQuoteDraft";

import { QuoteCostRowProps, QuoteEditorProps, QuoteLineRowProps, QuoteSuggestedHintProps } from "@/types/quote-ui";
import { brandFont } from "@/utils/brand-fonts";
import { formatGs, formatUsd } from "@/utils/quote-format";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

const GREEN = "#15803D";
const RED = "#B91C1C";

const parseNum = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};

function SuggestedHint({ item, onReset }: QuoteSuggestedHintProps) {
    if (!isItemEdited(item)) return null;
    return (
        <View style={styles.suggestedRow}>
            <Text style={[styles.suggestedText, brandFont(400)]}>Sugerido: {formatUsd(item.suggestedUsd ?? 0)}</Text>
            <TouchableOpacity onPress={onReset} hitSlop={8}>
                <Text style={[styles.linkText, brandFont(600)]}>Usar sugerido</Text>
            </TouchableOpacity>
        </View>
    );
}

function LineRow({ line, draft }: QuoteLineRowProps) {
    const isFlight = line.kind === "flight";
    const isManual = line.suggestedUsd === null;
    return (
        <View style={styles.itemRow}>
            <View style={styles.itemTop}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.itemLabel, brandFont(700)]}>{line.label}</Text>
                    {!!line.detail && <Text style={[styles.itemDetail, brandFont(400)]}>{line.detail}</Text>}
                </View>
                <View style={{ width: 140 }}>
                    <AmountInput value={line.amountUsd} onChange={(v) => draft.setLineAmount(line.id, v)} />
                </View>
                {isManual && (
                    <TouchableOpacity onPress={() => draft.removeLine(line.id)} style={styles.trashButton} hitSlop={6}>
                        <Ionicons name="trash-outline" size={18} color={RED} />
                    </TouchableOpacity>
                )}
            </View>
            <SuggestedHint item={line} onReset={() => draft.resetLineToSuggested(line.id)} />
            {isFlight ? (
                <Text style={[styles.visibilityNote, brandFont(400)]}>Siempre visible: incluye los ítems ocultos.</Text>
            ) : (
                <View style={styles.visibilityRow}>
                    <Text style={[styles.visibilityLabel, brandFont(500)]}>Mostrar en el presupuesto</Text>
                    <Switch
                        value={line.visible}
                        onValueChange={(v) => draft.setLineVisible(line.id, v)}
                        trackColor={{ false: "#CBD5E1", true: BRAND_COLORS.azur }}
                        thumbColor="#FFFFFF"
                    />
                </View>
            )}
            {!isFlight && !line.visible && (
                <Text style={[styles.hiddenNote, brandFont(400)]}>Oculto, incluido en el servicio de vuelo.</Text>
            )}
        </View>
    );
}

function CostRow({ cost, draft }: QuoteCostRowProps) {
    const isGateway = cost.kind === "gateway_fee";
    const isManual = cost.suggestedUsd === null;
    return (
        <View style={styles.itemRow}>
            <View style={styles.itemTop}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.itemLabel, brandFont(600)]}>{cost.label}</Text>
                    {!!cost.detail && <Text style={[styles.itemDetail, brandFont(400)]}>{cost.detail}</Text>}
                    {isGateway && <Text style={[styles.itemDetail, brandFont(400)]}>Se calcula sobre el total a pagar.</Text>}
                </View>
                <View style={{ width: 140 }}>
                    <AmountInput
                        value={cost.amountUsd}
                        editable={!isGateway}
                        onChange={(v) => draft.setCostAmount(cost.id, v)}
                    />
                </View>
                {isManual && (
                    <TouchableOpacity onPress={() => draft.removeCost(cost.id)} style={styles.trashButton} hitSlop={6}>
                        <Ionicons name="trash-outline" size={18} color={RED} />
                    </TouchableOpacity>
                )}
            </View>
            {!isGateway && <SuggestedHint item={cost} onReset={() => draft.resetCostToSuggested(cost.id)} />}
        </View>
    );
}

export function QuoteEditor({ draft, flightQuote, exchangeRate, costsFromDefaults }: QuoteEditorProps) {
    const { totals } = draft;
    const [costsOpen, setCostsOpen] = useState(false);

    // Formulario "Agregar ítem"
    const [addingLine, setAddingLine] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newDetail, setNewDetail] = useState("");
    const [newAmount, setNewAmount] = useState("");
    const [newVisible, setNewVisible] = useState(true);

    // Formulario "Agregar costo"
    const [addingCost, setAddingCost] = useState(false);
    const [newCostLabel, setNewCostLabel] = useState("");
    const [newCostAmount, setNewCostAmount] = useState("");

    const isManualTotal = draft.manualSubtotalInput !== null;
    const marginColor = totals.marginUsd >= 0 ? GREEN : RED;
    const marginPctText = totals.marginPct === null ? "—" : `${(totals.marginPct * 100).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %`;

    const submitLine = () => {
        if (!newLabel.trim()) return;
        draft.addLine({ label: newLabel, detail: newDetail, amountUsd: parseNum(newAmount), visible: newVisible });
        setNewLabel("");
        setNewDetail("");
        setNewAmount("");
        setNewVisible(true);
        setAddingLine(false);
    };

    const submitCost = () => {
        if (!newCostLabel.trim()) return;
        draft.addCost({ label: newCostLabel, amountUsd: parseNum(newCostAmount) });
        setNewCostLabel("");
        setNewCostAmount("");
        setAddingCost(false);
    };

    return (
        <View style={{ gap: 14 }}>
            {/* Horas de vuelo y tarifa */}
            <View style={styles.box}>
                {flightQuote.legs.map((leg, idx) => (
                    <View key={`${leg.from}-${leg.to}-${idx}`} style={styles.rowBetween}>
                        <Text style={[styles.muted, brandFont(400)]}>
                            {leg.from} → {leg.to}
                            {leg.kind === "positioning" ? " (posicionamiento)" : leg.kind === "return_empty" ? " (regreso vacío)" : ""}
                        </Text>
                        <Text style={[styles.value, brandFont(600)]}>{leg.hours.toFixed(1)} h</Text>
                    </View>
                ))}
                <View style={styles.rowBetween}>
                    <Text style={[styles.muted, brandFont(400)]}>
                        {flightQuote.billableHours} h (factor {flightQuote.blockFactor}) × tarifa por hora (sin IVA)
                    </Text>
                    <Text style={[styles.value, brandFont(600)]}>
                        {flightQuote.hasPricing ? formatUsd(flightQuote.pricePerHourUsd) : "Sin tarifa"}
                    </Text>
                </View>
                {!flightQuote.hasPricing && (
                    <Text style={[styles.warning, brandFont(500)]}>
                        Esta aeronave no tiene tarifa por hora. Cargala en Contable → Ajustes, o escribí los montos a mano.
                    </Text>
                )}
            </View>

            {/* Copiloto */}
            <View style={styles.box}>
                <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionTitle, brandFont(700)]}>Con copiloto</Text>
                        <Text style={[styles.muted, brandFont(400)]}>Agrega la línea y el costo del copiloto.</Text>
                    </View>
                    <Switch
                        value={draft.withCopilot}
                        onValueChange={draft.setWithCopilot}
                        trackColor={{ false: "#CBD5E1", true: BRAND_COLORS.navy }}
                        thumbColor="#FFFFFF"
                    />
                </View>
                {draft.withCopilot && (
                    <View style={{ flexDirection: "row", marginTop: 10, gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.inputLabel, brandFont(600)]}>Se cobra al cliente (USD/h)</Text>
                            <TextInput
                                value={draft.copilotChargeInput}
                                onChangeText={(v) => draft.setCopilotChargeInput(v.replace(/[^0-9.,]/g, ""))}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor="#94A3B8"
                                style={[styles.textInput, brandFont(600)]}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.inputLabel, brandFont(600)]}>Se le paga (USD/h, costo)</Text>
                            <TextInput
                                value={draft.copilotPayInput}
                                onChangeText={(v) => draft.setCopilotPayInput(v.replace(/[^0-9.,]/g, ""))}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor="#94A3B8"
                                style={[styles.textInput, brandFont(600)]}
                            />
                        </View>
                    </View>
                )}
            </View>

            {/* Lo que se cobra */}
            <View>
                <Text style={[styles.sectionTitle, brandFont(700)]}>Lo que se cobra</Text>
                <Text style={[styles.muted, brandFont(400), { marginBottom: 8 }]}>
                    Montos en USD sin IVA. El cliente paga + IVA 10 %.
                </Text>
                <View style={{ gap: 8 }}>
                    {draft.lines.map((line) => (
                        <LineRow key={line.id} line={line} draft={draft} />
                    ))}
                </View>

                {addingLine ? (
                    <View style={[styles.box, { marginTop: 8, gap: 8 }]}>
                        <Text style={[styles.inputLabel, brandFont(600)]}>Concepto</Text>
                        <TextInput
                            value={newLabel}
                            onChangeText={setNewLabel}
                            placeholder="Ej: Catering"
                            placeholderTextColor="#94A3B8"
                            style={[styles.textInput, brandFont(400)]}
                        />
                        <Text style={[styles.inputLabel, brandFont(600)]}>Detalle (opcional)</Text>
                        <TextInput
                            value={newDetail}
                            onChangeText={setNewDetail}
                            placeholder="Ej: 4 bandejas"
                            placeholderTextColor="#94A3B8"
                            style={[styles.textInput, brandFont(400)]}
                        />
                        <Text style={[styles.inputLabel, brandFont(600)]}>Monto (USD sin IVA)</Text>
                        <TextInput
                            value={newAmount}
                            onChangeText={(v) => setNewAmount(v.replace(/[^0-9.,]/g, ""))}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            style={[styles.textInput, brandFont(600)]}
                        />
                        <View style={styles.rowBetween}>
                            <Text style={[styles.visibilityLabel, brandFont(500)]}>Mostrar en el presupuesto</Text>
                            <Switch
                                value={newVisible}
                                onValueChange={setNewVisible}
                                trackColor={{ false: "#CBD5E1", true: BRAND_COLORS.azur }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                        {!newVisible && (
                            <Text style={[styles.hiddenNote, brandFont(400)]}>Oculto, incluido en el servicio de vuelo.</Text>
                        )}
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity onPress={() => setAddingLine(false)} style={styles.secondaryButton}>
                                <Text style={[styles.secondaryButtonText, brandFont(600)]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={submitLine}
                                style={[styles.primarySmallButton, !newLabel.trim() ? styles.disabled : null]}
                                disabled={!newLabel.trim()}
                            >
                                <Text style={[styles.primarySmallButtonText, brandFont(700)]}>Agregar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity onPress={() => setAddingLine(true)} style={styles.addButton}>
                        <Ionicons name="add-circle-outline" size={18} color={BRAND_COLORS.azur} />
                        <Text style={[styles.addButtonText, brandFont(600)]}>Agregar ítem</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Totales */}
            <View style={styles.totalsBox}>
                <View style={styles.rowBetween}>
                    <Text style={[styles.muted, brandFont(500)]}>Subtotal sugerido (sin IVA)</Text>
                    <Text style={[styles.value, brandFont(700)]}>{formatUsd(totals.subtotalSuggestedUsd)}</Text>
                </View>

                {isManualTotal ? (
                    <View style={{ marginTop: 10, gap: 6 }}>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.inputLabel, brandFont(700)]}>Total escrito a mano (sin IVA)</Text>
                            <TouchableOpacity onPress={() => draft.setManualSubtotalInput(null)} hitSlop={8}>
                                <Text style={[styles.linkText, brandFont(600)]}>Volver al sugerido</Text>
                            </TouchableOpacity>
                        </View>
                        <AmountInput
                            large
                            value={parseNum(draft.manualSubtotalInput ?? "0")}
                            onChange={(v) => draft.setManualSubtotalInput(String(v))}
                        />
                        <Text style={[styles.itemDetail, brandFont(400)]}>
                            La diferencia con el sugerido se suma a “Servicio de vuelo” en la hoja del cliente.
                        </Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => draft.setManualSubtotalInput(String(totals.subtotalSuggestedUsd))}
                        style={{ marginTop: 8 }}
                        hitSlop={8}
                    >
                        <Text style={[styles.linkText, brandFont(600)]}>Escribir total a mano (sin IVA)</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                    <Text style={[styles.value, brandFont(600)]}>Subtotal (sin IVA)</Text>
                    <Text style={[styles.value, brandFont(700)]}>{formatUsd(totals.subtotalUsd)}</Text>
                </View>
                <View style={styles.rowBetween}>
                    <Text style={[styles.muted, brandFont(500)]}>IVA 10 %</Text>
                    <Text style={[styles.value, brandFont(600)]}>{formatUsd(totals.ivaUsd)}</Text>
                </View>
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                    <Text style={[styles.totalLabel, brandFont(800)]}>Total a pagar</Text>
                    <Text style={[styles.totalValue, brandFont(800)]}>{formatUsd(totals.totalUsd)}</Text>
                </View>
                {exchangeRate > 0 && totals.totalUsd > 0 && (
                    <Text style={[styles.gsText, brandFont(600)]}>
                        Equivalente: {formatGs(totals.totalUsd * exchangeRate)} (T.C. {exchangeRate.toLocaleString("es-PY")})
                    </Text>
                )}
            </View>

            {/* Costos estimados (interno) */}
            <View style={styles.box}>
                <TouchableOpacity onPress={() => setCostsOpen((o) => !o)} style={styles.rowBetween} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionTitle, brandFont(700)]}>Costos estimados (interno)</Text>
                        <Text style={[styles.muted, brandFont(400)]}>
                            Costo {formatUsd(totals.estimatedCostUsd)} · Margen{" "}
                            <Text style={[{ color: marginColor }, brandFont(700)]}>
                                {formatUsd(totals.marginUsd)} ({marginPctText})
                            </Text>
                        </Text>
                    </View>
                    <Ionicons name={costsOpen ? "chevron-up" : "chevron-down"} size={20} color={BRAND_COLORS.navy} />
                </TouchableOpacity>

                {costsOpen && (
                    <View style={{ marginTop: 10, gap: 8 }}>
                        <Text style={[styles.itemDetail, brandFont(400)]}>
                            No sale en la hoja del cliente. Sirve para ver el margen y como punto de partida de GIO.
                        </Text>
                        {costsFromDefaults && (
                            <Text style={[styles.warning, brandFont(500)]}>
                                La aeronave no tiene Ajustes de GIO cargados: los costos usan valores por defecto.
                            </Text>
                        )}
                        {totals.costs.map((c) => (
                            <CostRow key={c.kind === "gateway_fee" ? "gateway_fee" : c.id} cost={c} draft={draft} />
                        ))}

                        {addingCost ? (
                            <View style={{ gap: 8 }}>
                                <TextInput
                                    value={newCostLabel}
                                    onChangeText={setNewCostLabel}
                                    placeholder="Concepto (ej. Viáticos)"
                                    placeholderTextColor="#94A3B8"
                                    style={[styles.textInput, brandFont(400)]}
                                />
                                <TextInput
                                    value={newCostAmount}
                                    onChangeText={(v) => setNewCostAmount(v.replace(/[^0-9.,]/g, ""))}
                                    keyboardType="decimal-pad"
                                    placeholder="Monto USD"
                                    placeholderTextColor="#94A3B8"
                                    style={[styles.textInput, brandFont(600)]}
                                />
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity onPress={() => setAddingCost(false)} style={styles.secondaryButton}>
                                        <Text style={[styles.secondaryButtonText, brandFont(600)]}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={submitCost}
                                        style={[styles.primarySmallButton, !newCostLabel.trim() ? styles.disabled : null]}
                                        disabled={!newCostLabel.trim()}
                                    >
                                        <Text style={[styles.primarySmallButtonText, brandFont(700)]}>Agregar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => setAddingCost(true)} style={styles.addButton}>
                                <Ionicons name="add-circle-outline" size={18} color={BRAND_COLORS.azur} />
                                <Text style={[styles.addButtonText, brandFont(600)]}>Agregar costo</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.divider} />
                        <View style={styles.rowBetween}>
                            <Text style={[styles.value, brandFont(600)]}>Costo total estimado</Text>
                            <Text style={[styles.value, brandFont(700)]}>{formatUsd(totals.estimatedCostUsd)}</Text>
                        </View>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.value, brandFont(600)]}>Margen (sobre el subtotal sin IVA)</Text>
                            <Text style={[{ color: marginColor, fontSize: 14 }, brandFont(800)]}>
                                {formatUsd(totals.marginUsd)} · {marginPctText}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Notas y validez */}
            <View style={{ gap: 6 }}>
                <Text style={[styles.inputLabel, brandFont(700)]}>Notas para el cliente (salen en la hoja)</Text>
                <TextInput
                    value={draft.notes}
                    onChangeText={draft.setNotes}
                    placeholder="Ej: Incluye espera en destino de hasta 2 h."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    style={[styles.textInput, styles.multiline, brandFont(400)]}
                />
                <Text style={[styles.inputLabel, brandFont(700), { marginTop: 6 }]}>Notas internas (no salen en la hoja)</Text>
                <TextInput
                    value={draft.internalNotes}
                    onChangeText={draft.setInternalNotes}
                    placeholder="Ej: El cliente pidió catering; confirmar con el piloto."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    style={[styles.textInput, styles.multiline, brandFont(400)]}
                />
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                    <Text style={[styles.inputLabel, brandFont(700)]}>Validez (días desde hoy)</Text>
                    <TextInput
                        value={draft.validityDaysInput}
                        onChangeText={(v) => draft.setValidityDaysInput(v.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        placeholder="7"
                        placeholderTextColor="#94A3B8"
                        style={[styles.textInput, { width: 80, textAlign: "center" }, brandFont(700)]}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    box: {
        backgroundColor: BRAND_COLORS.backgroundAlt,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: 14,
        padding: 12,
    },
    rowBetween: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    muted: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
        flexShrink: 1,
    },
    value: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.navy,
    },
    warning: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: "#B45309",
        marginTop: 6,
    },
    sectionTitle: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 14,
        color: BRAND_COLORS.navy,
    },
    inputLabel: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: BRAND_COLORS.navy,
        marginBottom: 2,
    },
    textInput: {
        fontFamily: "NotoSans_400Regular",
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
        color: BRAND_COLORS.navy,
    },
    multiline: {
        minHeight: 64,
        textAlignVertical: "top",
    },
    itemRow: {
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: 12,
        padding: 10,
    },
    itemTop: {
        flexDirection: "row",
        alignItems: "center",
    },
    itemLabel: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.navy,
    },
    itemDetail: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
        marginTop: 2,
    },
    trashButton: {
        marginLeft: 8,
        padding: 4,
    },
    suggestedRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
    },
    suggestedText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
    },
    linkText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: BRAND_COLORS.azur,
    },
    visibilityRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
    },
    visibilityLabel: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: BRAND_COLORS.navy,
    },
    visibilityNote: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
        marginTop: 6,
    },
    hiddenNote: {
        fontSize: 11,
        color: "#B45309",
        fontStyle: "italic",
        marginTop: 2,
    },
    addButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 8,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: BRAND_COLORS.crystal,
        backgroundColor: BRAND_COLORS.surfaceTint,
    },
    addButtonText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.azur,
    },
    secondaryButton: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        backgroundColor: BRAND_COLORS.white,
    },
    secondaryButtonText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.navy,
    },
    primarySmallButton: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: BRAND_COLORS.azur,
    },
    primarySmallButtonText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 13,
        color: BRAND_COLORS.white,
    },
    disabled: {
        opacity: 0.5,
    },
    totalsBox: {
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderWidth: 1,
        borderColor: BRAND_COLORS.crystal,
        borderRadius: BRAND_RADII.input,
        padding: 14,
    },
    divider: {
        height: 1,
        backgroundColor: BRAND_COLORS.border,
        marginVertical: 10,
    },
    totalLabel: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 15,
        color: BRAND_COLORS.navy,
    },
    totalValue: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 20,
        color: BRAND_COLORS.azur,
    },
    gsText: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: GREEN,
        marginTop: 4,
        textAlign: "right",
    },
});
