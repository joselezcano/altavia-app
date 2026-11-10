/**
 * Detalle del presupuesto (admin, owner y encargada).
 *  - Vista previa "como lo ve el cliente" (buildClientView) y, aparte, costos y margen (interno).
 *  - Acciones: enviar por WhatsApp (createQuoteLink), compartir PDF, editar, marcar aceptado /
 *    rechazado, eliminar y, si está aceptado, crear la reserva (useConvertQuote).
 * Rutas: (admin)/quote-details, (owner)/flights/quote-details y (pilot)/flights/quote-details.
 */
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";
import { BRAND_COLORS, BRAND_LOGO_ASPECT, BRAND_LOGOS, BRAND_RADII } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { useConvertQuote } from "@/hooks/useConvertQuote";
import { ReservationConflictError } from "@/hooks/usePhoneReservation";
import { createQuoteLink, useDeleteQuote, useQuote, useSetQuoteStatus } from "@/hooks/useQuotes";
import { QuoteStatus } from "@/types/quote";
import { QuoteDetailsActionProps } from "@/types/quote-ui";
import { brandFont } from "@/utils/brand-fonts";
import { confirmAction, showNotice } from "@/utils/dialogs";
import { buildClientView } from "@/utils/quote-builder";
import {
    buildQuoteWhatsAppMessage,
    formatQuoteDate,
    formatUsd,
    phoneForWhatsApp,
    quoteAirportLabel,
    quoteDisplayStatus,
    quoteShortNumber,
    toDateSafe,
    whatsappUrl,
} from "@/utils/quote-format";
import { shareQuotePdf } from "@/utils/quote-pdf";
import { roleFlightRoute, toHref } from "@/utils/role-routes";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const GREEN = "#15803D";
const RED = "#B91C1C";
const WHATSAPP = "#25D366";

function ActionButton({ label, icon, onPress, variant = "secondary", disabled, loading }: QuoteDetailsActionProps) {
    const palette = {
        primary: { bg: BRAND_COLORS.azur, fg: "#FFFFFF", border: BRAND_COLORS.azur },
        success: { bg: "#059669", fg: "#FFFFFF", border: "#059669" },
        whatsapp: { bg: WHATSAPP, fg: "#FFFFFF", border: WHATSAPP },
        secondary: { bg: BRAND_COLORS.white, fg: BRAND_COLORS.navy, border: BRAND_COLORS.border },
        danger: { bg: BRAND_COLORS.white, fg: RED, border: "#FECACA" },
    }[variant];
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={[
                styles.action,
                { backgroundColor: palette.bg, borderColor: palette.border },
                disabled ? styles.actionDisabled : null,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={palette.fg} size="small" />
            ) : (
                <>
                    <Ionicons name={icon as any} size={18} color={palette.fg} />
                    <Text style={[styles.actionText, { color: palette.fg }, brandFont(700)]}>{label}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

export default function QuoteDetailsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { role } = useAuth();
    const { quoteId } = useLocalSearchParams<{ quoteId: string }>();
    const id = quoteId ? String(quoteId) : undefined;
    const { data: quote, isLoading, error, refetch } = useQuote(id);
    const setStatus = useSetQuoteStatus();
    const deleteQuote = useDeleteQuote();
    const convert = useConvertQuote();
    const [busy, setBusy] = useState<string | null>(null);

    const goToList = () => {
        const route = roleFlightRoute(role, "quotes");
        if (role !== "ADMIN" && router.canGoBack()) router.back();
        else if (route) router.replace(toHref(route));
    };

    if (isLoading) {
        return (
            <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
                <ActivityIndicator color={BRAND_COLORS.navy} />
            </View>
        );
    }
    if (error || !quote) {
        return (
            <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
                <Ionicons name="alert-circle-outline" size={32} color="#B45309" />
                <Text style={[styles.centerText, brandFont(600)]}>
                    {error ? "No se pudo cargar el presupuesto." : "El presupuesto no existe o fue eliminado."}
                </Text>
                <ActionButton label="Volver a presupuestos" icon="arrow-back" onPress={goToList} />
            </View>
        );
    }

    const status = quoteDisplayStatus(quote);
    const view = buildClientView(quote.lines || [], quote);
    const hiddenLines = (quote.lines || []).filter((l) => !l.visible && l.kind !== "flight" && Number(l.amountUsd) !== 0);
    const adjustment = Math.round((quote.subtotalUsd - quote.subtotalSuggestedUsd) * 100) / 100;
    const marginColor = quote.marginUsd >= 0 ? GREEN : RED;
    const marginPct = quote.marginPct === null || quote.marginPct === undefined ? "—" : `${(quote.marginPct * 100).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %`;
    const isConverted = quote.status === "converted";
    const origin = quoteAirportLabel(quote.trip.origin_name, quote.trip.origin_airport_ident);
    const destination = quoteAirportLabel(quote.trip.destination_name, quote.trip.destination_airport_ident);

    const invalidate = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["quotes"] }),
            queryClient.invalidateQueries({ queryKey: ["quote", quote.id] }),
        ]);
    };

    // ------------------------------------------------------------ acciones
    const handleWhatsApp = async () => {
        if (status === "expired") {
            const ok = await confirmAction({
                title: "Presupuesto vencido",
                message: `La validez venció el ${formatQuoteDate(quote.validUntil, false)}. Podés editarlo para extenderla. ¿Enviarlo igual?`,
                confirmText: "Enviar igual",
            });
            if (!ok) return;
        }
        setBusy("whatsapp");
        try {
            let url: string | null = null;
            try {
                url = (await createQuoteLink(quote.id)).url;
            } catch (e: any) {
                const ok = await confirmAction({
                    title: "No se pudo generar el link",
                    message: `${e?.message || "El servicio no respondió."}\n\n¿Enviar el resumen por WhatsApp sin el link de la hoja?`,
                    confirmText: "Enviar sin link",
                });
                if (!ok) return;
            }
            const phone = phoneForWhatsApp(quote.clientPhone);
            await Linking.openURL(whatsappUrl(phone, buildQuoteWhatsAppMessage(quote, url)));
            // Sin link, el servidor no lo marcó como enviado: se marca acá.
            if (!url && quote.status === "draft") {
                await setStatus.mutateAsync({ quoteId: quote.id, status: "sent" });
            }
            if (!phone) {
                Toast.show({ type: "info", text1: "El cliente no tiene teléfono", text2: "Elegí el contacto en WhatsApp." });
            }
        } catch (e: any) {
            console.error("Error al enviar el presupuesto por WhatsApp:", e);
            showNotice("Error", e?.message || "No se pudo abrir WhatsApp.");
        } finally {
            setBusy(null);
            await invalidate();
        }
    };

    const handlePdf = async () => {
        setBusy("pdf");
        try {
            await shareQuotePdf(quote);
        } catch (e: any) {
            showNotice("Error", e?.message || "No se pudo generar el PDF del presupuesto.");
        } finally {
            setBusy(null);
        }
    };

    const handleEdit = () => {
        const route = roleFlightRoute(role, "quote-edit", { quoteId: quote.id });
        if (route) router.push(toHref(route));
    };

    const changeStatus = async (next: QuoteStatus, title: string, message: string) => {
        const ok = await confirmAction({ title, message, confirmText: "Confirmar" });
        if (!ok) return;
        setBusy(next);
        try {
            await setStatus.mutateAsync({ quoteId: quote.id, status: next });
            Toast.show({ type: "success", text1: next === "accepted" ? "Marcado como aceptado" : "Marcado como rechazado" });
        } catch (e: any) {
            showNotice("Error", e?.message || "No se pudo cambiar el estado.");
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = async () => {
        const ok = await confirmAction({
            title: "Eliminar presupuesto",
            message: `¿Eliminar el presupuesto #${quoteShortNumber(quote.id)} de ${quote.clientName}? No se puede deshacer.`,
            confirmText: "Eliminar",
            destructive: true,
        });
        if (!ok) return;
        setBusy("delete");
        try {
            await deleteQuote.mutateAsync(quote.id);
            Toast.show({ type: "success", text1: "Presupuesto eliminado" });
            goToList();
        } catch (e: any) {
            showNotice("Error", e?.message || "No se pudo eliminar el presupuesto.");
        } finally {
            setBusy(null);
        }
    };

    const handleCreateReservation = async () => {
        const ok = await confirmAction({
            title: "Crear reserva",
            message: `Se crea la reserva por ${formatUsd(quote.subtotalUsd)} + IVA (total ${formatUsd(quote.totalUsd)}) y se bloquea el calendario de ${quote.aircraftRegistration}.`,
            confirmText: "Crear reserva",
        });
        if (!ok) return;
        setBusy("convert");
        try {
            const { reservationId } = await convert.mutateAsync(quote.id);
            const assignRoute = roleFlightRoute(role, "assign-pilots", { reservationId });
            if (assignRoute) {
                const go = await confirmAction({
                    title: "Reserva creada",
                    message: "La reserva quedó pendiente de aprobación. ¿Asignar tripulación y aprobarla ahora?",
                    confirmText: "Asignar tripulación y aprobar",
                    cancelText: "Más tarde",
                });
                if (go) router.push(toHref(assignRoute));
            } else {
                await showNotice("Reserva creada", "La reserva quedó pendiente de aprobación. Podés verla en Reservas y Cobros.");
            }
        } catch (e: any) {
            if (e instanceof ReservationConflictError) {
                showNotice("Horario no disponible", `${e.message}\n\nEditá el presupuesto para cambiar el horario.`);
            } else {
                showNotice("Error", e?.message || "No se pudo crear la reserva.");
            }
        } finally {
            setBusy(null);
            refetch();
        }
    };

    const handleOpenReservation = () => {
        if (!quote.reservationId) return;
        const route = roleFlightRoute(role, "flight-details", { reservationId: quote.reservationId });
        if (route) router.push(toHref(route));
        else router.push("/(admin)/reservations" as Href);
    };

    const canAccept = ["draft", "sent", "expired", "rejected"].includes(status);
    const canReject = ["draft", "sent", "expired", "accepted"].includes(status);

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goToList} style={styles.iconButton} hitSlop={8}>
                    <Ionicons name="arrow-back" size={20} color={BRAND_COLORS.navy} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, brandFont(800)]}>Presupuesto #{quoteShortNumber(quote.id)}</Text>
                    <Text style={[styles.subtitle, brandFont(400)]}>
                        Versión {quote.version ?? 1} · {quote.aircraftModel} {quote.aircraftRegistration}
                    </Text>
                </View>
                <QuoteStatusBadge status={status} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48, gap: 14 }}>
                {/* Acciones */}
                <View style={{ gap: 8 }}>
                    {quote.status === "accepted" && (
                        <ActionButton
                            label="Crear reserva"
                            icon="checkmark-done-circle"
                            variant="success"
                            onPress={handleCreateReservation}
                            loading={busy === "convert"}
                            disabled={!!busy}
                        />
                    )}
                    {isConverted && quote.reservationId && (
                        <ActionButton label="Ver reserva" icon="airplane" variant="primary" onPress={handleOpenReservation} />
                    )}
                    {!isConverted && (
                        <ActionButton
                            label="Enviar por WhatsApp"
                            icon="logo-whatsapp"
                            variant="whatsapp"
                            onPress={handleWhatsApp}
                            loading={busy === "whatsapp"}
                            disabled={!!busy}
                        />
                    )}
                    <View style={styles.actionRow}>
                        <View style={{ flex: 1 }}>
                            <ActionButton label="Compartir PDF" icon="document-attach-outline" onPress={handlePdf} loading={busy === "pdf"} disabled={!!busy} />
                        </View>
                        {!isConverted && (
                            <View style={{ flex: 1 }}>
                                <ActionButton label="Editar" icon="create-outline" onPress={handleEdit} disabled={!!busy} />
                            </View>
                        )}
                    </View>
                    {!isConverted && (
                        <View style={styles.actionRow}>
                            {canAccept && (
                                <View style={{ flex: 1 }}>
                                    <ActionButton
                                        label="Marcar aceptado"
                                        icon="thumbs-up-outline"
                                        onPress={() =>
                                            changeStatus("accepted", "Marcar aceptado", "¿El cliente aceptó el presupuesto (por WhatsApp o teléfono)?")
                                        }
                                        loading={busy === "accepted"}
                                        disabled={!!busy}
                                    />
                                </View>
                            )}
                            {canReject && (
                                <View style={{ flex: 1 }}>
                                    <ActionButton
                                        label="Marcar rechazado"
                                        icon="thumbs-down-outline"
                                        variant="danger"
                                        onPress={() => changeStatus("rejected", "Marcar rechazado", "¿El cliente rechazó el presupuesto?")}
                                        loading={busy === "rejected"}
                                        disabled={!!busy}
                                    />
                                </View>
                            )}
                        </View>
                    )}
                    {canAccept && quote.status !== "accepted" && (
                        <Text style={[styles.hint, brandFont(400)]}>
                            Si el cliente aceptó respondiendo por WhatsApp, marcalo aceptado para poder crear la reserva.
                        </Text>
                    )}
                </View>

                {/* Como lo ve el cliente */}
                <Text style={[styles.sectionLabel, brandFont(700)]}>COMO LO VE EL CLIENTE</Text>
                <View style={styles.sheet}>
                    <View style={styles.sheetHeader}>
                        <Image
                            source={BRAND_LOGOS.horizontalColor}
                            style={{ width: 110, height: 110 / BRAND_LOGO_ASPECT.horizontal }}
                            resizeMode="contain"
                        />
                        <View style={{ alignItems: "flex-end" }}>
                            <Text style={[styles.sheetTitle, brandFont(800)]}>PRESUPUESTO</Text>
                            <Text style={[styles.sheetNumber, brandFont(700)]}>N.º {quoteShortNumber(quote.id)}</Text>
                        </View>
                    </View>
                    <Text style={[styles.meta, brandFont(400)]}>
                        Fecha {formatQuoteDate(quote.sentAt || quote.createdAt, false)} · Válido hasta {formatQuoteDate(quote.validUntil, false)}
                    </Text>

                    <View style={styles.sheetGrid}>
                        <View style={styles.sheetCell}>
                            <Text style={[styles.cellLabel, brandFont(600)]}>Cliente</Text>
                            <Text style={[styles.cellValue, brandFont(700)]}>{quote.clientName}</Text>
                            {!!quote.clientPhone && <Text style={[styles.meta, brandFont(400)]}>{quote.clientPhone}</Text>}
                        </View>
                        <View style={styles.sheetCell}>
                            <Text style={[styles.cellLabel, brandFont(600)]}>Aeronave</Text>
                            <Text style={[styles.cellValue, brandFont(700)]}>{quote.aircraftModel}</Text>
                            <Text style={[styles.meta, brandFont(400)]}>{quote.aircraftRegistration}</Text>
                        </View>
                    </View>
                    <View style={styles.sheetCellWide}>
                        <Text style={[styles.cellLabel, brandFont(600)]}>Ruta</Text>
                        <Text style={[styles.cellValue, brandFont(700)]}>
                            {origin} → {destination}
                        </Text>
                        <Text style={[styles.meta, brandFont(400)]}>
                            {quote.schedule.roundtrip ? "Ida y vuelta" : "Solo ida"} · {quote.passengers}{" "}
                            {quote.passengers === 1 ? "pasajero" : "pasajeros"}
                        </Text>
                        <Text style={[styles.meta, brandFont(400)]}>
                            Salida {formatQuoteDate(quote.schedule.outbound_flight_departure_time)} hs
                        </Text>
                        {quote.schedule.roundtrip && !!quote.schedule.return_flight_departure_time && (
                            <Text style={[styles.meta, brandFont(400)]}>
                                Regreso {formatQuoteDate(quote.schedule.return_flight_departure_time)} hs
                            </Text>
                        )}
                    </View>

                    <View style={styles.divider} />
                    {view.lines.map((l, idx) => (
                        <View key={`${l.label}-${idx}`} style={styles.lineRow}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.lineLabel, brandFont(600)]}>{l.label}</Text>
                                {!!l.detail && <Text style={[styles.meta, brandFont(400)]}>{l.detail}</Text>}
                            </View>
                            <Text style={[styles.lineAmount, brandFont(700)]}>{formatUsd(l.amountUsd)}</Text>
                        </View>
                    ))}
                    <View style={styles.divider} />
                    <View style={styles.lineRow}>
                        <Text style={[styles.lineLabel, brandFont(600)]}>Subtotal (sin IVA)</Text>
                        <Text style={[styles.lineAmount, brandFont(700)]}>{formatUsd(view.subtotalUsd)}</Text>
                    </View>
                    <View style={styles.lineRow}>
                        <Text style={[styles.meta, brandFont(500)]}>IVA {Math.round(view.ivaPct * 100)} %</Text>
                        <Text style={[styles.lineAmount, brandFont(600)]}>{formatUsd(view.ivaUsd)}</Text>
                    </View>
                    <View style={[styles.lineRow, { marginTop: 4 }]}>
                        <Text style={[styles.totalLabel, brandFont(800)]}>Total a pagar</Text>
                        <Text style={[styles.totalValue, brandFont(800)]}>{formatUsd(view.totalUsd)}</Text>
                    </View>
                    <Text style={[styles.legend, brandFont(400)]}>
                        Montos expresados en USD sin IVA. El total a pagar incluye IVA {Math.round(view.ivaPct * 100)} %.
                    </Text>
                    {!!quote.notes && (
                        <View style={styles.notesBox}>
                            <Text style={[styles.cellLabel, brandFont(600)]}>Notas</Text>
                            <Text style={[styles.notesText, brandFont(400)]}>{quote.notes}</Text>
                        </View>
                    )}
                </View>

                {/* Interno */}
                <Text style={[styles.sectionLabel, brandFont(700)]}>INTERNO (NO LO VE EL CLIENTE)</Text>
                <View style={styles.internal}>
                    {(hiddenLines.length > 0 || adjustment !== 0) && (
                        <View style={{ marginBottom: 10 }}>
                            <Text style={[styles.cellLabel, brandFont(600)]}>Incluido en “Servicio de vuelo”</Text>
                            {hiddenLines.map((l) => (
                                <View key={l.id} style={styles.lineRow}>
                                    <Text style={[styles.meta, brandFont(500)]}>{l.label} (oculto)</Text>
                                    <Text style={[styles.metaStrong, brandFont(600)]}>{formatUsd(l.amountUsd)}</Text>
                                </View>
                            ))}
                            {adjustment !== 0 && (
                                <View style={styles.lineRow}>
                                    <Text style={[styles.meta, brandFont(500)]}>Ajuste del total escrito a mano</Text>
                                    <Text style={[styles.metaStrong, brandFont(600)]}>{formatUsd(adjustment)}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <Text style={[styles.cellLabel, brandFont(600)]}>Costos estimados</Text>
                    {(quote.costs || []).map((c) => (
                        <View key={c.id} style={styles.lineRow}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.meta, brandFont(500)]}>{c.label}</Text>
                                {!!c.detail && <Text style={[styles.metaSmall, brandFont(400)]}>{c.detail}</Text>}
                            </View>
                            <Text style={[styles.metaStrong, brandFont(600)]}>{formatUsd(c.amountUsd)}</Text>
                        </View>
                    ))}
                    <View style={styles.divider} />
                    <View style={styles.lineRow}>
                        <Text style={[styles.lineLabel, brandFont(600)]}>Costo total estimado</Text>
                        <Text style={[styles.lineAmount, brandFont(700)]}>{formatUsd(quote.estimatedCostUsd)}</Text>
                    </View>
                    <View style={styles.lineRow}>
                        <Text style={[styles.lineLabel, brandFont(600)]}>Margen (sobre el subtotal sin IVA)</Text>
                        <Text style={[{ color: marginColor, fontSize: 15 }, brandFont(800)]}>
                            {formatUsd(quote.marginUsd)} · {marginPct}
                        </Text>
                    </View>
                    {!!quote.internalNotes && (
                        <View style={[styles.notesBox, { backgroundColor: "#FFFBEB" }]}>
                            <Text style={[styles.cellLabel, brandFont(600)]}>Notas internas</Text>
                            <Text style={[styles.notesText, brandFont(400)]}>{quote.internalNotes}</Text>
                        </View>
                    )}

                    <View style={styles.divider} />
                    <Text style={[styles.metaSmall, brandFont(400)]}>Creado: {formatQuoteDate(quote.createdAt)}</Text>
                    {!!toDateSafe(quote.sentAt) && (
                        <Text style={[styles.metaSmall, brandFont(400)]}>Enviado: {formatQuoteDate(quote.sentAt)}</Text>
                    )}
                    {!!toDateSafe(quote.acceptedAt) && (
                        <Text style={[styles.metaSmall, brandFont(400)]}>
                            Aceptado: {formatQuoteDate(quote.acceptedAt)} ({quote.acceptedVia === "link" ? "desde la hoja" : "marcado a mano"})
                        </Text>
                    )}
                    {!!toDateSafe(quote.rejectedAt) && (
                        <Text style={[styles.metaSmall, brandFont(400)]}>Rechazado: {formatQuoteDate(quote.rejectedAt)}</Text>
                    )}
                </View>

                {!isConverted && (
                    <ActionButton
                        label="Eliminar presupuesto"
                        icon="trash-outline"
                        variant="danger"
                        onPress={handleDelete}
                        loading={busy === "delete"}
                        disabled={!!busy}
                    />
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    center: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: 24,
        gap: 12,
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    centerText: {
        fontSize: 14,
        color: BRAND_COLORS.navy,
        textAlign: "center",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 18,
        color: BRAND_COLORS.navy,
    },
    subtitle: {
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
    },
    action: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        borderRadius: BRAND_RADII.input,
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    actionDisabled: {
        opacity: 0.55,
    },
    actionText: {
        fontSize: 14,
    },
    actionRow: {
        flexDirection: "row",
        gap: 8,
    },
    hint: {
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
        textAlign: "center",
    },
    sectionLabel: {
        fontSize: 11,
        letterSpacing: 1,
        color: BRAND_COLORS.textMuted,
        marginTop: 4,
    },
    sheet: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sheetHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: BRAND_COLORS.navy,
        paddingBottom: 10,
        marginBottom: 8,
    },
    sheetTitle: {
        fontSize: 15,
        letterSpacing: 1.5,
        color: BRAND_COLORS.navy,
    },
    sheetNumber: {
        fontSize: 12,
        color: BRAND_COLORS.azur,
    },
    sheetGrid: {
        flexDirection: "row",
        gap: 8,
        marginTop: 10,
    },
    sheetCell: {
        flex: 1,
        backgroundColor: BRAND_COLORS.backgroundAlt,
        borderRadius: 12,
        padding: 10,
    },
    sheetCellWide: {
        backgroundColor: BRAND_COLORS.backgroundAlt,
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
    },
    cellLabel: {
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: BRAND_COLORS.textMuted,
        marginBottom: 2,
    },
    cellValue: {
        fontSize: 13,
        color: BRAND_COLORS.navy,
    },
    meta: {
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
    },
    metaSmall: {
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
    },
    metaStrong: {
        fontSize: 12,
        color: BRAND_COLORS.navy,
    },
    divider: {
        height: 1,
        backgroundColor: BRAND_COLORS.border,
        marginVertical: 10,
    },
    lineRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 3,
    },
    lineLabel: {
        fontSize: 13,
        color: BRAND_COLORS.navy,
        flexShrink: 1,
    },
    lineAmount: {
        fontSize: 13,
        color: BRAND_COLORS.navy,
    },
    totalLabel: {
        fontSize: 15,
        color: BRAND_COLORS.navy,
    },
    totalValue: {
        fontSize: 19,
        color: BRAND_COLORS.azur,
    },
    legend: {
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
        marginTop: 8,
    },
    notesBox: {
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: 12,
        padding: 10,
        marginTop: 10,
    },
    notesText: {
        fontSize: 12,
        color: BRAND_COLORS.navy,
    },
    internal: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: BRAND_COLORS.crystal,
        padding: 16,
    },
});
