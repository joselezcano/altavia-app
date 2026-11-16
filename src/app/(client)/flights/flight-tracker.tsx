import { LoadingCard } from "@/components/loading-card";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useFlightTracker } from "@/hooks/useFlightTracker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { cssInterop } from "nativewind";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

cssInterop(Image, { className: "style" });

const blurhash =
    "|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[";

function formatTimeDifference(diffInMs: number) {
    const totalHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor(
        (diffInMs % (1000 * 60 * 60)) / (1000 * 60)
    );
    return `${totalHours}h ${remainingMinutes}m`;
}

function convertToDMS(coordinate: number | undefined | null, isLat: boolean) {
    if (coordinate === undefined || coordinate === null || isNaN(coordinate)) {
        return "N/A";
    }
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

    let direction = isLat ? (coordinate >= 0 ? "N" : "S") : coordinate >= 0 ? "E" : "W";
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

function formatTimestampWithTimezone(val: any, timezone?: string | null): string {
    if (!val) return "";
    let dateObj: Date;
    if (typeof val?.toDate === "function") {
        dateObj = val.toDate();
    } else if (val instanceof Date) {
        dateObj = val;
    } else if (typeof val === "number" || typeof val === "string") {
        dateObj = new Date(val);
    } else {
        return "";
    }
    if (timezone) {
        try {
            return dateObj.toLocaleString("es-ES", {
                timeZone: timezone,
                dateStyle: "medium",
                timeStyle: "short",
            });
        } catch {
            return dateObj.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) + " hs";
        }
    }
    return dateObj.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) + " hs";
}

function getDateMs(val: any): number {
    if (!val) return 0;
    if (typeof val?.toDate === "function") return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    if (typeof val === "number") return val;
    if (typeof val === "string") return new Date(val).getTime();
    return 0;
}

function getFlightStatusBadge(status: string) {
    switch (status.toLowerCase()) {
        case "en route":
            return {
                label: "En Ruta",
                bg: "bg-blue-100",
                border: "border-blue-200",
                text: "text-blue-800",
                icon: "airplane-outline",
                backgroundColor: "#DBEAFE",
                borderColor: "#BFDBFE",
                textColor: "#1E40AF",
                iconColor: "#1e40af",
            };
        case "arrived":
            return {
                label: "Aterrizado",
                bg: "bg-emerald-100",
                border: "border-emerald-200",
                text: "text-emerald-800",
                icon: "checkmark-circle-outline",
                backgroundColor: "#D1FAE5",
                borderColor: "#A7F3D0",
                textColor: "#065F46",
                iconColor: "#059669",
            };
        case "scheduled":
            return {
                label: "Programado",
                bg: "bg-amber-100",
                border: "border-amber-200",
                text: "text-amber-800",
                icon: "time-outline",
                backgroundColor: "#FEF3C7",
                borderColor: "#FDE68A",
                textColor: "#92400E",
                iconColor: "#b45309",
            };
        default:
            return {
                label: "Por Confirmar",
                bg: "bg-slate-100",
                border: "border-slate-200",
                text: "text-slate-700",
                icon: "help-circle-outline",
                backgroundColor: "#F1F5F9",
                borderColor: "#E2E8F0",
                textColor: "#334155",
                iconColor: "#475569",
            };
    }
}

export default function FlightTrackerScreen() {
    const router = useRouter();
    const { fa_flight_id } = useLocalSearchParams<{
        fa_flight_id?: string;
    }>();
    const [copied, setCopied] = useState(false);

    const { data, isLoading } = useFlightTracker(fa_flight_id);

    const handleShareWebLink = async () => {
        if (!fa_flight_id) return;
        const url = `https://flightaware.com/live/flight/id/${fa_flight_id}`;
        await Clipboard.setStringAsync(url);
        setCopied(true);
        Toast.show({
            type: "success",
            text1: "Enlace copiado",
            text2: "Se ha copiado el enlace al portapapeles.",
        });
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    };

    const fp = data?.positionData;
    const mapBase64Image = data?.mapBase64Image || "";

    let flightStatus = "scheduled";
    let departureTime = "";
    let arrivalTime = "";
    let elapsedTimeStr = "";

    if (fp) {
        if (fp.actual_off) {
            const offMs = getDateMs(fp.actual_off);
            departureTime = formatTimestampWithTimezone(fp.actual_off, fp.origin?.timezone);

            if (fp.actual_on) {
                const onMs = getDateMs(fp.actual_on);
                if (onMs !== offMs) {
                    flightStatus = "arrived";
                    arrivalTime = formatTimestampWithTimezone(fp.actual_on, fp.destination?.timezone);
                } else {
                    flightStatus = "to be confirmed";
                }
            } else {
                elapsedTimeStr = formatTimeDifference(Date.now() - offMs);
                flightStatus = "en route";
            }
        }
    }

    const statusBadge = getFlightStatusBadge(flightStatus);

    return (
        <ThemedView className="flex-1 bg-brand-light px-4">
            <ScreenHeader
                title="Seguir el vuelo"
                subtitle="Seguimiento en vivo"
                onBack={() => router.push("/(client)/flights")}
            />

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {isLoading
                    ? <LoadingCard message="Cargando seguimiento de vuelo..." />
                    : !fp ? (
                        <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6">
                            <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4 border border-amber-100">
                                <Ionicons name="airplane-outline" size={32} color="#d97706" />
                            </View>
                            <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                                Seguimiento no disponible
                            </ThemedText>
                            <ThemedText className="text-slate-500 text-xs text-center mt-2 mb-6 px-4">
                                Tracking de vuelo no disponible en este momento.
                            </ThemedText>
                            <TouchableOpacity
                                onPress={() => router.push("/(client)/flights")}
                                className="bg-brand-blue px-5 py-3 rounded-xl flex-row items-center" style={{ gap: 8 }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                                <ThemedText className="text-sm font-bold text-white">Volver</ThemedText>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="mb-10" style={{ gap: 16 }}>
                            {/* Card 1: Flight Overview */}
                            <View className="bg-brand-white rounded-3xl p-5 border border-slate-200">
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 mr-2">
                                        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                                            {fp.ident_iata || fp.ident_icao || fp.ident}
                                        </ThemedText>
                                        <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
                                            {fp.aircraft_type && (
                                                <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                    <ThemedText className="text-xs font-bold text-slate-700">
                                                        {fp.aircraft_type}
                                                    </ThemedText>
                                                </View>
                                            )}
                                            {fp.registration && (
                                                <ThemedText className="text-xs text-slate-500 font-bold">
                                                    {fp.registration}
                                                </ThemedText>
                                            )}
                                        </View>
                                    </View>

                                    <View
                                        className="border px-3 py-1 rounded-full flex-row items-center"
                                        style={{ gap: 6, backgroundColor: statusBadge.backgroundColor, borderColor: statusBadge.borderColor }}
                                    >
                                        <Ionicons name={statusBadge.icon as any} size={14} color={statusBadge.iconColor} />
                                        <ThemedText className="text-xs font-bold" style={{ color: statusBadge.textColor }}>
                                            {statusBadge.label}
                                        </ThemedText>
                                    </View>
                                </View>

                                {elapsedTimeStr ? (
                                    <View className="mt-4 pt-3 border-t border-slate-100 flex-row items-center justify-between">
                                        <View className="flex-row items-center" style={{ gap: 8 }}>
                                            <Ionicons name="time-outline" size={16} color="#030436" />
                                            <ThemedText className="text-xs font-medium text-slate-600">
                                                Tiempo transcurrido:
                                            </ThemedText>
                                        </View>
                                        <ThemedText className="text-xs font-bold text-brand-blue">
                                            {elapsedTimeStr}
                                        </ThemedText>
                                    </View>
                                ) : null}
                            </View>

                            {/* Card 2: Interactive Flight Map */}
                            {mapBase64Image ? (
                                <View className="bg-brand-white rounded-3xl p-4 border border-slate-200">
                                    <View className="flex-row items-center mb-3 px-1" style={{ gap: 8 }}>
                                        <Ionicons name="map-outline" size={18} color="#030436" />
                                        <ThemedText type="subtitle" className="text-brand-blue font-bold text-base">
                                            Mapa de Vuelo
                                        </ThemedText>
                                    </View>
                                    <View className="w-full rounded-2xl overflow-hidden border border-slate-200">
                                        <Image
                                            className="w-full aspect-[4/3]"
                                            source={{ uri: `data:image/png;base64,${mapBase64Image}` }}
                                            placeholder={{ blurhash }}
                                            contentFit="cover"
                                            transition={1000}
                                        />
                                    </View>
                                </View>
                            ) : null}

                            {/* Card 3: Route Details */}
                            <View className="bg-brand-white rounded-3xl p-5 border border-slate-200">
                                <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-4">
                                    Ruta del Vuelo
                                </ThemedText>

                                <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100" style={{ gap: 16 }}>
                                    {/* Origin */}
                                    <View className="flex-row items-start" style={{ gap: 12 }}>
                                        <View className="w-3 h-3 rounded-full bg-brand-gold mt-1.5" />
                                        <View className="flex-1">
                                            <ThemedText className="text-xs uppercase tracking-wider font-bold text-slate-400">
                                                Origen
                                            </ThemedText>
                                            <ThemedText className="text-base font-bold text-brand-blue">
                                                {fp.origin?.name || "Aeropuerto de Origen"} {fp.origin?.code_iata ? `(${fp.origin.code_iata})` : ""}
                                            </ThemedText>
                                            {fp.origin?.city && (
                                                <ThemedText className="text-xs text-slate-500 font-medium mt-0.5">
                                                    {fp.origin.city}
                                                </ThemedText>
                                            )}
                                            {departureTime ? (
                                                <ThemedText className="text-xs font-semibold text-slate-700 mt-1">
                                                    Salida: {departureTime}
                                                </ThemedText>
                                            ) : null}
                                        </View>
                                    </View>

                                    {/* Connector */}
                                    <View className="flex-row items-center pl-1 my-0.5" style={{ gap: 8 }}>
                                        <View className="w-0.5 h-6 bg-slate-300 ml-0.5" />
                                        <MaterialCommunityIcons name={flightStatus === "arrived" || flightStatus === "to be confirmed" ? "airplane-landing" : "airplane-takeoff"} size={16} color="#0165FF" className="ml-2" />
                                    </View>

                                    {/* Destination */}
                                    <View className="flex-row items-start" style={{ gap: 12 }}>
                                        <View className="w-3 h-3 rounded-full bg-brand-blue mt-1.5" />
                                        <View className="flex-1">
                                            <ThemedText className="text-xs uppercase tracking-wider font-bold text-slate-400">
                                                Destino
                                            </ThemedText>
                                            <ThemedText className="text-base font-bold text-brand-blue">
                                                {fp.destination?.name || "Aeropuerto de Destino"} {fp.destination?.code_iata ? `(${fp.destination.code_iata})` : ""}
                                            </ThemedText>
                                            {fp.destination?.city && (
                                                <ThemedText className="text-xs text-slate-500 font-medium mt-0.5">
                                                    {fp.destination.city}
                                                </ThemedText>
                                            )}
                                            {arrivalTime ? (
                                                <ThemedText className="text-xs font-semibold text-slate-700 mt-1">
                                                    Llegada: {arrivalTime}
                                                </ThemedText>
                                            ) : null}
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Card 4: Position Telemetry */}
                            <View className="bg-brand-white rounded-3xl p-5 border border-slate-200" style={{ gap: 12 }}>
                                <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                                    Telemetría en Tiempo Real
                                </ThemedText>

                                {/* Latitude */}
                                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                                    <View className="flex-row items-center" style={{ gap: 10 }}>
                                        <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                                            <Ionicons name="compass-outline" size={18} color="#030436" />
                                        </View>
                                        <ThemedText className="text-xs font-medium text-slate-600">
                                            Latitud
                                        </ThemedText>
                                    </View>
                                    <ThemedText className="text-xs font-bold text-slate-900">
                                        {convertToDMS(fp.last_position?.latitude, true)}
                                    </ThemedText>
                                </View>

                                {/* Longitude */}
                                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                                    <View className="flex-row items-center" style={{ gap: 10 }}>
                                        <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                                            <Ionicons name="location-outline" size={18} color="#030436" />
                                        </View>
                                        <ThemedText className="text-xs font-medium text-slate-600">
                                            Longitud
                                        </ThemedText>
                                    </View>
                                    <ThemedText className="text-xs font-bold text-slate-900">
                                        {convertToDMS(fp.last_position?.longitude, false)}
                                    </ThemedText>
                                </View>

                                {/* Altitude */}
                                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                                    <View className="flex-row items-center" style={{ gap: 10 }}>
                                        <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                                            <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#030436" />
                                        </View>
                                        <ThemedText className="text-xs font-medium text-slate-600">
                                            Altitud
                                        </ThemedText>
                                    </View>
                                    <ThemedText className="text-xs font-bold text-slate-900">
                                        {fp.last_position?.altitude !== undefined
                                            ? `${(fp.last_position.altitude * 100).toLocaleString("es-ES")} pies`
                                            : "N/A"}
                                    </ThemedText>
                                </View>

                                {/* Groundspeed */}
                                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                                    <View className="flex-row items-center" style={{ gap: 10 }}>
                                        <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                                            <MaterialCommunityIcons name="speedometer" size={18} color="#030436" />
                                        </View>
                                        <ThemedText className="text-xs font-medium text-slate-600">
                                            Velocidad de tierra
                                        </ThemedText>
                                    </View>
                                    <ThemedText className="text-xs font-bold text-slate-900">
                                        {fp.last_position?.groundspeed !== undefined
                                            ? `${fp.last_position.groundspeed} nudos`
                                            : "N/A"}
                                    </ThemedText>
                                </View>

                                {/* Heading */}
                                <View className="flex-row items-center justify-between py-2">
                                    <View className="flex-row items-center" style={{ gap: 10 }}>
                                        <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                                            <Ionicons name="navigate-outline" size={18} color="#030436" />
                                        </View>
                                        <ThemedText className="text-xs font-medium text-slate-600">
                                            Rumbo
                                        </ThemedText>
                                    </View>
                                    <ThemedText className="text-xs font-bold text-slate-900">
                                        {fp.last_position?.heading !== undefined
                                            ? `${fp.last_position.heading}°`
                                            : "N/A"}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Share Web Link Button */}
                            {fa_flight_id ? (
                                <TouchableOpacity
                                    onPress={handleShareWebLink}
                                    className="bg-brand-blue rounded-2xl py-4 px-5 flex-row items-center justify-center border border-[rgba(3,4,54,0.2)] active:opacity-90 mt-2" style={{ gap: 10 }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name={copied ? "checkmark-circle" : "share-outline"} size={20} color="#FFFFFF" />
                                    <ThemedText className="text-white font-bold text-sm tracking-wide">
                                        {copied ? "¡Enlace Copiado!" : "Compartir enlace web"}
                                    </ThemedText>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}
            </ScrollView>
        </ThemedView>
    );
}