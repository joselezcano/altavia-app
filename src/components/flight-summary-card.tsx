import { FlightWeatherCompact, FlightWeatherDetail } from "@/components/flight-weather";
import { ThemedText } from "@/components/themed-text";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { useFlightWeather } from "@/hooks/useFlightWeather";
import { FlightSummaryCardProps } from "@/types/components";
import { formatUsd } from "@/utils/quote-format";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
    LayoutAnimation,
    Platform,
    StyleSheet,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";

// Android con la arquitectura vieja necesita habilitar LayoutAnimation (en la nueva es un no-op).
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND_ANIMATION = {
    duration: 240,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

const formatDeparture = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "Sin confirmar";
    const day = date.toLocaleDateString("es-PY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const time = date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${time} hs`;
};

/**
 * Card de vuelo colapsable, compartida por las listas de cliente, piloto, owner y reservas.
 * Colapsada: ruta, fecha y hora, estado, matrícula, pasajeros, precio y (si aplica) clima resumido.
 * Al tocarla se despliega con una animación suave y muestra `children` (detalle y acciones).
 */
export function FlightSummaryCard({
    expanded,
    onToggle,
    eyebrow,
    originCode,
    originName,
    destinationCode,
    destinationName,
    departureTime,
    roundtrip,
    status,
    registration,
    passengers,
    priceUsd,
    weatherRequest,
    weatherDetail,
    children,
}: FlightSummaryCardProps) {
    const { data: weather } = useFlightWeather(weatherRequest ?? null);
    const showDetailWeather = expanded && !!weatherDetail && !!weather;

    const handleToggle = () => {
        LayoutAnimation.configureNext(EXPAND_ANIMATION);
        onToggle();
    };

    return (
        <View style={styles.card}>
            <TouchableOpacity
                onPress={handleToggle}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityHint={expanded ? "Oculta el detalle del vuelo" : "Muestra el detalle y las acciones del vuelo"}
            >
                {/* Línea superior: modelo / tramo + estado */}
                <View style={styles.topRow}>
                    <ThemedText style={styles.eyebrow} numberOfLines={1}>
                        {eyebrow || "Vuelo"}
                    </ThemedText>
                    {status && (
                        <View
                            style={[
                                styles.badge,
                                { backgroundColor: status.backgroundColor, borderColor: status.borderColor },
                            ]}
                        >
                            <Ionicons name={status.icon as any} size={12} color={status.iconColor} />
                            <ThemedText style={[styles.badgeText, { color: status.textColor }]} numberOfLines={1}>
                                {status.label}
                            </ThemedText>
                        </View>
                    )}
                </View>

                {/* Ruta ORIGEN → DESTINO */}
                <View style={styles.routeRow}>
                    <View style={styles.airport}>
                        <ThemedText style={styles.code} numberOfLines={1}>{originCode}</ThemedText>
                        {!!originName && (
                            <ThemedText style={styles.city} numberOfLines={1}>{originName}</ThemedText>
                        )}
                    </View>
                    <View style={styles.routeMiddle}>
                        <MaterialCommunityIcons name="airplane" size={18} color={BRAND_COLORS.azur} style={{ transform: [{ rotate: "90deg" }] }} />
                        <View style={styles.routeLine} />
                        {roundtrip && <ThemedText style={styles.roundtrip}>Ida y vuelta</ThemedText>}
                    </View>
                    <View style={[styles.airport, { alignItems: "flex-end" }]}>
                        <ThemedText style={styles.code} numberOfLines={1}>{destinationCode}</ThemedText>
                        {!!destinationName && (
                            <ThemedText style={[styles.city, { textAlign: "right" }]} numberOfLines={1}>
                                {destinationName}
                            </ThemedText>
                        )}
                    </View>
                </View>

                {/* Fecha y hora */}
                <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={14} color={BRAND_COLORS.azur} />
                    <ThemedText style={styles.dateText} numberOfLines={1}>{formatDeparture(departureTime)}</ThemedText>
                </View>

                {/* Matrícula, pasajeros, precio */}
                <View style={styles.metaRow}>
                    <View style={styles.metaLeft}>
                        {!!registration && (
                            <View style={styles.chip}>
                                <MaterialCommunityIcons name="airplane" size={12} color={BRAND_COLORS.navy} />
                                <ThemedText style={styles.chipText}>{registration}</ThemedText>
                            </View>
                        )}
                        {passengers !== undefined && (
                            <View style={styles.chip}>
                                <Ionicons name="people-outline" size={12} color={BRAND_COLORS.navy} />
                                <ThemedText style={styles.chipText}>{passengers} pax</ThemedText>
                            </View>
                        )}
                    </View>
                    {priceUsd !== undefined && priceUsd > 0 && (
                        <ThemedText style={styles.price}>{formatUsd(priceUsd)}</ThemedText>
                    )}
                </View>

                {/* Clima resumido (se reemplaza por el detallado al desplegar, si corresponde) */}
                {!!weather && !showDetailWeather && (
                    <View style={{ marginTop: 10 }}>
                        <FlightWeatherCompact weather={weather} />
                    </View>
                )}

                <View style={styles.toggleRow}>
                    <ThemedText style={styles.toggleText}>{expanded ? "Ver menos" : "Ver detalle y acciones"}</ThemedText>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={BRAND_COLORS.azur} />
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.body}>
                    {showDetailWeather && weather && (
                        <View style={{ gap: 8 }}>
                            <View style={styles.weatherTitleRow}>
                                <MaterialCommunityIcons name="weather-partly-cloudy" size={16} color={BRAND_COLORS.azur} />
                                <ThemedText style={styles.weatherTitle}>Pronóstico del tiempo</ThemedText>
                            </View>
                            <FlightWeatherDetail weather={weather} />
                        </View>
                    )}
                    {children}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 16,
        shadowColor: BRAND_COLORS.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
    },
    eyebrow: {
        flex: 1,
        fontSize: 12,
        fontFamily: "NotoSans_700Bold",
        color: BRAND_COLORS.azur,
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: BRAND_RADII.pill,
        borderWidth: 1,
        maxWidth: "55%",
    },
    badgeText: {
        fontSize: 12,
        fontFamily: "NotoSans_700Bold",
    },
    routeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    airport: {
        flex: 1,
    },
    code: {
        fontSize: 22,
        fontFamily: "NotoSans_800ExtraBold",
        color: BRAND_COLORS.navy,
        letterSpacing: 0.5,
    },
    city: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
        marginTop: 1,
    },
    routeMiddle: {
        alignItems: "center",
        paddingHorizontal: 8,
    },
    routeLine: {
        width: 44,
        height: 1,
        backgroundColor: BRAND_COLORS.crystal,
        marginVertical: 4,
    },
    roundtrip: {
        fontSize: 11,
        fontFamily: "NotoSans_700Bold",
        color: BRAND_COLORS.azur,
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 12,
    },
    dateText: {
        fontSize: 13,
        fontFamily: "NotoSans_600SemiBold",
        color: BRAND_COLORS.navy,
        flexShrink: 1,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginTop: 10,
    },
    metaLeft: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        flex: 1,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: BRAND_COLORS.backgroundAlt,
        borderRadius: BRAND_RADII.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    chipText: {
        fontSize: 12,
        fontFamily: "NotoSans_600SemiBold",
        color: BRAND_COLORS.navy,
    },
    price: {
        fontSize: 15,
        fontFamily: "NotoSans_800ExtraBold",
        color: BRAND_COLORS.navy,
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        marginTop: 12,
    },
    toggleText: {
        fontSize: 12,
        fontFamily: "NotoSans_600SemiBold",
        color: BRAND_COLORS.azur,
    },
    body: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: BRAND_COLORS.border,
        gap: 12,
    },
    weatherTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    weatherTitle: {
        fontSize: 13,
        fontFamily: "NotoSans_700Bold",
        color: BRAND_COLORS.navy,
    },
});
