import { BRAND_COLORS, BRAND_LOGO_ASPECT, BRAND_LOGOS } from "@/constants/brand";
import type { Airport, ClientReservationItem, PassengerManifestItem } from "@/types/all-roles";
import { buildBoardingQrValue } from "@/utils/boarding-pass";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

const LOGO_HEIGHT = 24;

export function airportCode(airport: Airport | undefined, fallbackIdent: string | undefined): string {
    return airport?.iata_code || airport?.icao_code || airport?.ident || fallbackIdent || "----";
}

export function airportCity(airport: Airport | undefined): string {
    return airport?.municipality || airport?.name || "";
}

export function formatBoardingDate(date: Date | null | undefined): string {
    if (!date) return "A confirmar";
    return date.toLocaleDateString("es-PY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export function formatBoardingTime(date: Date | null | undefined): string {
    if (!date) return "--:--";
    return date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function InfoCell({ label, value, flex = 1, align = "left" }: { label: string; value: string; flex?: number; align?: "left" | "right" }) {
    return (
        <View style={{ flex, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
            <Text style={[styles.label, brandFont(700)]}>{label}</Text>
            <Text style={[styles.value, brandFont(700)]} numberOfLines={2}>
                {value}
            </Text>
        </View>
    );
}

/** Pase de abordar de un pasajero, con el QR que escanea el piloto. */
export function BoardingPassCard({
    reservation,
    passenger,
    index,
    total,
    qrSize,
}: {
    reservation: ClientReservationItem;
    passenger: PassengerManifestItem;
    index: number;
    total: number;
    qrSize: number;
}) {
    const qrValue = buildBoardingQrValue(reservation.id, passenger);
    const departure = reservation.schedule?.outbound_flight_departure_time;
    const returnDeparture = reservation.schedule?.roundtrip ? reservation.schedule?.return_flight_departure_time : null;
    const registration = reservation.aircraftSpecs?.basic_specs?.registration || "—";
    const originCode = airportCode(reservation.originAirport, reservation.trip?.origin_airport_ident);
    const destinationCode = airportCode(reservation.destinationAirport, reservation.trip?.destination_airport_ident);
    const boardedAt = passenger.boardedAt ? new Date(passenger.boardedAt) : null;

    return (
        <View style={styles.card}>
            {/* Cabecera navy con logo y ruta */}
            <View style={styles.top}>
                <View style={styles.topRow}>
                    <Image
                        source={BRAND_LOGOS.horizontalNegative}
                        style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * BRAND_LOGO_ASPECT.horizontal }}
                        contentFit="contain"
                    />
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.topEyebrow, brandFont(700)]}>BOARDING PASS</Text>
                        <Text style={[styles.topCounter, brandFont(500)]}>
                            Pasajero {index + 1} de {total}
                        </Text>
                    </View>
                </View>

                <View style={styles.routeRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.routeCode, brandFont(800)]}>{originCode}</Text>
                        <Text style={[styles.routeCity, brandFont(500)]} numberOfLines={2}>
                            {airportCity(reservation.originAirport) || "Origen"}
                        </Text>
                    </View>
                    <View style={styles.routeMiddle}>
                        <View style={styles.routeLine} />
                        <View style={styles.planeBadge}>
                            <Ionicons name="airplane" size={16} color={BRAND_COLORS.white} />
                        </View>
                        <View style={styles.routeLine} />
                    </View>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={[styles.routeCode, brandFont(800)]}>{destinationCode}</Text>
                        <Text style={[styles.routeCity, brandFont(500), { textAlign: "right" }]} numberOfLines={2}>
                            {airportCity(reservation.destinationAirport) || "Destino"}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Datos del vuelo y del pasajero */}
            <View style={styles.body}>
                <View style={styles.infoRow}>
                    <InfoCell label="FECHA" value={formatBoardingDate(departure)} flex={1.4} />
                    <InfoCell label="SALIDA" value={`${formatBoardingTime(departure)} hs`} />
                    <InfoCell label="MATRÍCULA" value={registration} align="right" />
                </View>
                {returnDeparture ? (
                    <View style={styles.returnRow}>
                        <Ionicons name="return-down-back" size={14} color={BRAND_COLORS.azur} />
                        <Text style={[styles.returnText, brandFont(500)]}>
                            Vuelta {destinationCode} → {originCode}: {formatBoardingDate(returnDeparture)} · {formatBoardingTime(returnDeparture)} hs
                        </Text>
                    </View>
                ) : null}
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                    <InfoCell label="PASAJERO" value={passenger.fullName.toUpperCase()} flex={2} />
                    <InfoCell
                        label="DOCUMENTO"
                        value={`${passenger.documentType} ${passenger.documentNumber}`}
                        flex={1.2}
                        align="right"
                    />
                </View>
                <View style={styles.infoRow}>
                    <InfoCell label="RESERVA" value={`#${reservation.id.slice(0, 8).toUpperCase()}`} />
                    <InfoCell label="EQUIPAJE" value={`${passenger.luggageKg ?? 0} kg`} align="right" />
                </View>
            </View>

            {/* Troquel */}
            <View style={styles.perforation}>
                <View style={[styles.notch, styles.notchLeft]} />
                <View style={styles.dashed} />
                <View style={[styles.notch, styles.notchRight]} />
            </View>

            {/* QR */}
            <View style={styles.qrSection}>
                {qrValue ? (
                    <View style={styles.qrFrame}>
                        <QRCode value={qrValue} size={qrSize} color={BRAND_COLORS.navy} backgroundColor={BRAND_COLORS.white} ecl="M" />
                    </View>
                ) : (
                    <View style={[styles.qrPlaceholder, { width: qrSize, height: qrSize }]}>
                        <Ionicons name="cloud-offline-outline" size={36} color={BRAND_COLORS.textMuted} />
                        <Text style={[styles.qrPlaceholderText, brandFont(500)]}>
                            El código todavía no está disponible. Conectate a internet y actualizá la pantalla.
                        </Text>
                    </View>
                )}

                {boardedAt ? (
                    <View style={[styles.statusPill, styles.statusBoarded]}>
                        <Ionicons name="checkmark-circle" size={16} color="#047857" />
                        <Text style={[styles.statusText, { color: "#047857" }, brandFont(700)]}>
                            Embarcado a las {formatBoardingTime(boardedAt)} hs
                        </Text>
                    </View>
                ) : (
                    <Text style={[styles.qrHint, brandFont(500)]}>Mostrá este código al piloto al embarcar.</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: 24,
        overflow: "hidden",
        shadowColor: BRAND_COLORS.navy,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 5,
    },
    top: {
        backgroundColor: BRAND_COLORS.navy,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 22,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    topEyebrow: {
        color: BRAND_COLORS.crystal,
        fontSize: 11,
        letterSpacing: 2,
    },
    topCounter: {
        color: BRAND_COLORS.white,
        fontSize: 11,
        marginTop: 2,
        opacity: 0.8,
    },
    routeRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    routeCode: {
        color: BRAND_COLORS.white,
        fontSize: 34,
        letterSpacing: 1,
    },
    routeCity: {
        color: BRAND_COLORS.crystal,
        fontSize: 12,
        marginTop: 2,
    },
    routeMiddle: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 14,
        paddingHorizontal: 8,
        width: 96,
    },
    routeLine: {
        flex: 1,
        height: 1,
        borderTopWidth: 1,
        borderStyle: "dashed",
        borderColor: BRAND_COLORS.crystal,
    },
    planeBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: BRAND_COLORS.azur,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 4,
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 6,
        gap: 14,
    },
    infoRow: {
        flexDirection: "row",
        gap: 12,
    },
    label: {
        color: BRAND_COLORS.textMuted,
        fontSize: 10,
        letterSpacing: 1.2,
        marginBottom: 3,
    },
    value: {
        color: BRAND_COLORS.navy,
        fontSize: 14,
    },
    returnRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    returnText: {
        color: BRAND_COLORS.navy,
        fontSize: 12,
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: BRAND_COLORS.border,
    },
    perforation: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 14,
    },
    notch: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    notchLeft: {
        marginLeft: -12,
    },
    notchRight: {
        marginRight: -12,
    },
    dashed: {
        flex: 1,
        height: 1,
        borderTopWidth: 1.5,
        borderStyle: "dashed",
        borderColor: BRAND_COLORS.border,
        marginHorizontal: 6,
    },
    qrSection: {
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 22,
        gap: 14,
    },
    qrFrame: {
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        backgroundColor: BRAND_COLORS.white,
    },
    qrPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: BRAND_COLORS.border,
        padding: 20,
        gap: 10,
    },
    qrPlaceholderText: {
        color: BRAND_COLORS.textMuted,
        fontSize: 12,
        textAlign: "center",
    },
    qrHint: {
        color: BRAND_COLORS.textMuted,
        fontSize: 12,
        textAlign: "center",
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    statusBoarded: {
        backgroundColor: "#D1FAE5",
    },
    statusText: {
        fontSize: 13,
    },
});
