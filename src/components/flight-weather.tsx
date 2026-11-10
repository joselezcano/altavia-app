import { ThemedText } from "@/components/themed-text";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { useFlightWeather } from "@/hooks/useFlightWeather";
import { FlightWeatherCardProps, FlightWeatherViewProps } from "@/types/components";
import { WeatherPoint } from "@/types/weather";
import { getWeatherCodeInfo } from "@/utils/flight-weather";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

const formatHour = (date: Date) =>
    date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });

const formatTemp = (value: number | null) => (value === null ? "--" : `${value}°`);

/** Flecha hacia donde VA el viento (la dirección de Open-Meteo es desde donde viene). */
function WindArrow({ deg, size = 12 }: { deg: number | null; size?: number }) {
    if (deg === null) return null;
    return (
        <View style={{ transform: [{ rotate: `${(deg + 180) % 360}deg` }] }}>
            <MaterialCommunityIcons name="navigation" size={size} color={BRAND_COLORS.azur} />
        </View>
    );
}

/** Una línea por aeropuerto: ícono + temperatura + código. */
function CompactPoint({ point }: { point: WeatherPoint }) {
    const info = getWeatherCodeInfo(point.weatherCode, point.isDay);
    return (
        <View style={styles.compactPoint}>
            <MaterialCommunityIcons name={info.icon as any} size={16} color={info.color} />
            <ThemedText style={styles.compactTemp}>{formatTemp(point.temperatureC)}</ThemedText>
            <ThemedText style={styles.compactLabel} numberOfLines={1}>{point.label}</ThemedText>
        </View>
    );
}

/** Resumen en una línea (cards colapsadas y cliente). */
export function FlightWeatherCompact({ weather }: FlightWeatherViewProps) {
    const maxRain = Math.max(
        weather.origin?.precipitationProbability ?? -1,
        weather.destination?.precipitationProbability ?? -1
    );
    return (
        <View style={styles.compactRow} accessibilityLabel="Pronóstico del tiempo">
            {weather.origin && <CompactPoint point={weather.origin} />}
            {weather.origin && weather.destination && (
                <MaterialCommunityIcons name="arrow-right" size={12} color={BRAND_COLORS.textMuted} />
            )}
            {weather.destination && <CompactPoint point={weather.destination} />}
            {maxRain >= 0 && (
                <View style={styles.compactRain}>
                    <MaterialCommunityIcons name="water-percent" size={14} color={BRAND_COLORS.azur} />
                    <ThemedText style={styles.compactRainText}>{maxRain}%</ThemedText>
                </View>
            )}
        </View>
    );
}

function DetailPoint({ point, caption }: { point: WeatherPoint; caption: string }) {
    const info = getWeatherCodeInfo(point.weatherCode, point.isDay);
    const showGusts =
        point.windGustsKmh !== null && point.windSpeedKmh !== null && point.windGustsKmh >= point.windSpeedKmh + 10;

    return (
        <View style={styles.detailPoint}>
            <View style={styles.detailHeader}>
                <ThemedText style={styles.detailCode} numberOfLines={1}>{point.label}</ThemedText>
                <ThemedText style={styles.detailCaption}>{caption} {formatHour(point.time)}</ThemedText>
            </View>

            <View style={styles.detailMain}>
                <MaterialCommunityIcons name={info.icon as any} size={30} color={info.color} />
                <View style={{ flex: 1 }}>
                    <ThemedText style={styles.detailTemp}>{formatTemp(point.temperatureC)}</ThemedText>
                    <ThemedText style={styles.detailCondition} numberOfLines={1}>{info.label}</ThemedText>
                </View>
            </View>

            <View style={styles.detailLine}>
                <MaterialCommunityIcons name="weather-windy" size={14} color={BRAND_COLORS.textMuted} />
                <ThemedText style={styles.detailLineText} numberOfLines={2}>
                    {point.windSpeedKmh === null
                        ? "Viento s/d"
                        : `${point.windSpeedKmh} km/h · ${point.windSpeedKt ?? "--"} kt`}
                    {point.windDirectionCardinal ? ` del ${point.windDirectionCardinal}` : ""}
                </ThemedText>
                <WindArrow deg={point.windDirectionDeg} />
            </View>
            {showGusts && (
                <ThemedText style={styles.detailGusts}>
                    Ráfagas {point.windGustsKmh} km/h · {point.windGustsKt} kt
                </ThemedText>
            )}

            <View style={styles.detailLine}>
                <MaterialCommunityIcons name="water-percent" size={14} color={BRAND_COLORS.azur} />
                <ThemedText style={styles.detailLineText}>
                    Lluvia {point.precipitationProbability === null ? "s/d" : `${point.precipitationProbability}%`}
                </ThemedText>
            </View>
        </View>
    );
}

/** Bloque completo: origen (a la salida) y destino (a la llegada estimada). */
export function FlightWeatherDetail({ weather }: FlightWeatherViewProps) {
    return (
        <View style={styles.detailRow}>
            {weather.origin && <DetailPoint point={weather.origin} caption="Salida" />}
            {weather.destination && <DetailPoint point={weather.destination} caption="Llegada" />}
        </View>
    );
}

/** Card de clima con su propia consulta, para el detalle del vuelo. No muestra nada si falla. */
export function FlightWeatherCard({ request, variant = "detail" }: FlightWeatherCardProps) {
    const { data } = useFlightWeather(request);
    if (!request || !data) return null;

    return (
        <View style={styles.card}>
            <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color={BRAND_COLORS.azur} />
                <ThemedText style={styles.cardTitle}>Pronóstico del tiempo</ThemedText>
            </View>
            {variant === "compact" ? <FlightWeatherCompact weather={data} /> : <FlightWeatherDetail weather={data} />}
            <ThemedText style={styles.source}>Fuente: Open-Meteo · referencia, no reemplaza el METAR/TAF</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    compactRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    compactPoint: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    compactTemp: {
        fontSize: 12,
        fontFamily: "NotoSans_700Bold",
        color: BRAND_COLORS.navy,
    },
    compactLabel: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
    },
    compactRain: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        marginLeft: "auto",
    },
    compactRainText: {
        fontSize: 11,
        fontFamily: "NotoSans_600SemiBold",
        color: BRAND_COLORS.azur,
    },
    detailRow: {
        flexDirection: "row",
        gap: 10,
    },
    detailPoint: {
        flex: 1,
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: 14,
        padding: 10,
        gap: 6,
    },
    detailHeader: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 4,
    },
    detailCode: {
        fontSize: 13,
        fontFamily: "NotoSans_800ExtraBold",
        color: BRAND_COLORS.navy,
        flexShrink: 1,
    },
    detailCaption: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 10,
        color: BRAND_COLORS.textMuted,
    },
    detailMain: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    detailTemp: {
        fontSize: 20,
        fontFamily: "NotoSans_700Bold",
        color: BRAND_COLORS.navy,
        lineHeight: 24,
    },
    detailCondition: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
        color: BRAND_COLORS.textMuted,
    },
    detailLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    detailLineText: {
        fontSize: 11,
        fontFamily: "NotoSans_600SemiBold",
        color: BRAND_COLORS.navy,
        flexShrink: 1,
    },
    detailGusts: {
        fontSize: 10,
        color: "#B45309",
        fontFamily: "NotoSans_600SemiBold",
        marginLeft: 18,
        marginTop: -4,
    },
    card: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 16,
        gap: 10,
        shadowColor: BRAND_COLORS.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
    },
    cardTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    cardTitle: {
        fontSize: 15,
        fontFamily: "NotoSans_700Bold",
        color: BRAND_COLORS.navy,
    },
    source: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 10,
        color: BRAND_COLORS.textMuted,
    },
});
