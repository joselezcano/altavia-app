/**
 * Lista de presupuestos (admin, owner y encargada). Chips por estado; cada item muestra
 * cliente, ruta, fecha, total con IVA, estado y vencimiento.
 * Rutas: (admin)/quotes, (owner)/flights/quotes y (pilot)/flights/quotes.
 */
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteDoc } from "@/types/quote";
import { QuoteListFilter } from "@/types/quote-ui";
import { brandFont } from "@/utils/brand-fonts";
import {
    formatQuoteDate,
    formatUsd,
    QUOTE_FILTERS,
    quoteDisplayStatus,
    quoteMatchesFilter,
    quoteRouteLabel,
    quoteShortNumber,
    isPastDate,
    toDateSafe,
} from "@/utils/quote-format";
import { roleFlightRoute, toHref } from "@/utils/role-routes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuoteListScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { role } = useAuth();
    // El admin tiene el header del Drawer; owner y encargada, header propio con "volver".
    const inDrawer = role === "ADMIN";
    const { data: quotes = [], isLoading, isRefetching, refetch, error } = useQuotes();
    const [filter, setFilter] = useState<QuoteListFilter>("all");

    const filtered = useMemo(() => quotes.filter((q) => quoteMatchesFilter(q, filter)), [quotes, filter]);
    const counts = useMemo(() => {
        const out: Record<string, number> = {};
        QUOTE_FILTERS.forEach((f) => {
            out[f.id] = quotes.filter((q) => quoteMatchesFilter(q, f.id)).length;
        });
        return out;
    }, [quotes]);

    const openNew = () => {
        const route = roleFlightRoute(role, "new-booking");
        if (route) router.push(toHref(route));
    };
    const openQuote = (q: QuoteDoc) => {
        const route = roleFlightRoute(role, "quote-details", { quoteId: q.id });
        if (route) router.push(toHref(route));
    };

    const renderItem = ({ item }: { item: QuoteDoc }) => {
        const status = quoteDisplayStatus(item);
        const until = toDateSafe(item.validUntil);
        const expired = isPastDate(until);
        return (
            <TouchableOpacity onPress={() => openQuote(item)} style={styles.item} activeOpacity={0.75}>
                <View style={styles.itemTop}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.client, brandFont(700)]} numberOfLines={1}>
                            {item.clientName || "Sin cliente"}
                        </Text>
                        <Text style={[styles.number, brandFont(500)]}>
                            #{quoteShortNumber(item.id)} · {item.aircraftRegistration}
                        </Text>
                    </View>
                    <QuoteStatusBadge status={status} />
                </View>
                <View style={styles.routeRow}>
                    <Ionicons name="airplane-outline" size={14} color={BRAND_COLORS.azur} />
                    <Text style={[styles.route, brandFont(600)]} numberOfLines={1}>
                        {quoteRouteLabel(item, true)}
                    </Text>
                </View>
                <View style={styles.itemBottom}>
                    <View>
                        <Text style={[styles.meta, brandFont(400)]}>
                            Salida {formatQuoteDate(item.schedule.outbound_flight_departure_time)}
                        </Text>
                        <Text style={[styles.meta, brandFont(400)]}>
                            {item.status === "converted"
                                ? "Reserva creada"
                                : `${expired ? "Venció" : "Vence"} ${formatQuoteDate(item.validUntil, false)}`}
                        </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.total, brandFont(800)]}>{formatUsd(item.totalUsd)}</Text>
                        <Text style={[styles.meta, brandFont(400)]}>con IVA</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: inDrawer ? 12 : insets.top + 8 }]}>
            <View style={styles.header}>
                {!inDrawer && (
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
                        <Ionicons name="arrow-back" size={20} color={BRAND_COLORS.navy} />
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, brandFont(800)]}>Presupuestos</Text>
                    <Text style={[styles.subtitle, brandFont(400)]}>Cotizaciones enviadas por WhatsApp</Text>
                </View>
                <TouchableOpacity onPress={openNew} style={styles.newButton} activeOpacity={0.8}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={[styles.newButtonText, brandFont(700)]}>Nuevo</Text>
                </TouchableOpacity>
            </View>

            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {QUOTE_FILTERS.map((f) => {
                        const active = filter === f.id;
                        return (
                            <TouchableOpacity
                                key={f.id}
                                onPress={() => setFilter(f.id)}
                                style={[styles.chip, active ? styles.chipActive : null]}
                            >
                                <Text style={[styles.chipText, active ? styles.chipTextActive : null, brandFont(600)]}>
                                    {f.label} ({counts[f.id] ?? 0})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {isLoading ? (
                <ActivityIndicator color={BRAND_COLORS.navy} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(q) => q.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 10 }}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={36} color={BRAND_COLORS.crystal} />
                            <Text style={[styles.emptyText, brandFont(500)]}>
                                {error
                                    ? "No se pudieron cargar los presupuestos."
                                    : filter === "all"
                                      ? "Todavía no hay presupuestos. Armá uno desde \"Nuevo\"."
                                      : "No hay presupuestos con este estado."}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: BRAND_COLORS.backgroundAlt,
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
        fontSize: 20,
        color: BRAND_COLORS.navy,
    },
    subtitle: {
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
    },
    newButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: BRAND_COLORS.azur,
        borderRadius: BRAND_RADII.button,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    newButtonText: {
        color: "#FFFFFF",
        fontSize: 13,
    },
    chips: {
        gap: 8,
        paddingBottom: 12,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: BRAND_RADII.pill,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        backgroundColor: BRAND_COLORS.white,
    },
    chipActive: {
        backgroundColor: BRAND_COLORS.navy,
        borderColor: BRAND_COLORS.navy,
    },
    chipText: {
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
    },
    chipTextActive: {
        color: "#FFFFFF",
    },
    item: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    itemTop: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    client: {
        fontSize: 15,
        color: BRAND_COLORS.navy,
    },
    number: {
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
        marginTop: 1,
    },
    routeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
    },
    route: {
        fontSize: 13,
        color: BRAND_COLORS.navy,
        flex: 1,
    },
    itemBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginTop: 8,
    },
    meta: {
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
    },
    total: {
        fontSize: 16,
        color: BRAND_COLORS.azur,
    },
    empty: {
        alignItems: "center",
        paddingVertical: 48,
        gap: 10,
    },
    emptyText: {
        fontSize: 13,
        color: BRAND_COLORS.textMuted,
        textAlign: "center",
    },
});
