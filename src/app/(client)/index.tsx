import { BancardPaymentModal } from "@/components/bancard-modal";
import { ScreenContainer } from "@/components/screen-container";
import UserAvatar from "@/components/user-avatar";
import { WhatsAppContactButton } from "@/components/whatsapp-contact-button";
import { BRAND_COLORS, BRAND_LOGO_ASPECT, BRAND_LOGOS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { ClientReservationItem } from "@/types/all-roles";
import { airportCityName, airportShortCode } from "@/utils/airport-label";
import { isCanceled, isPaidForBoarding } from "@/utils/boarding-pass";
import { brandFont } from "@/utils/brand-fonts";
import { formatClientGs, formatClientUsd, formatFlightDateTime, openAltaGoWhatsApp } from "@/utils/client-format";
import { getStatusBadge } from "@/utils/flight-status";
import { fetchPaidReservationFields } from "@/utils/paid-reservation";
import { generateAndSharePaymentReceiptPdf } from "@/utils/payment-receipt";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const HERO_PHOTO = require("../../../assets/images/brand/login-background.jpg");

const FEATURED_DESTINATIONS = [
    {
        id: "wrc",
        title: "WRC Paraguay 2026",
        subtitle: "Vuelos nacionales para el Rally Mundial",
        image: require("../../../assets/images/Chapa-PY-WRC-2026PNG.webp"),
        message: "Hola, quiero consultar un vuelo para el WRC Paraguay 2026.",
    },
    {
        id: "pde",
        title: "Punta del Este",
        subtitle: "Tus vacaciones, más cerca",
        image: require("../../../assets/images/punta-del-este-visit-casapueblo-hero-1920x890.avif"),
        message: "Hola, quiero consultar un vuelo a Punta del Este.",
    },
];

/** Próximo vuelo del cliente: el más cercano a futuro que no esté cancelado. */
function findNextFlight(reservations: ClientReservationItem[]): ClientReservationItem | null {
    const now = Date.now();
    const upcoming = reservations
        .filter((r) => !isCanceled(r) && r.internal_status !== "completed")
        .filter((r) => {
            const t = r.schedule?.outbound_flight_departure_time?.getTime?.();
            return typeof t === "number" && !isNaN(t) && t >= now - 6 * 3600 * 1000;
        })
        .sort(
            (a, b) =>
                a.schedule.outbound_flight_departure_time.getTime() - b.schedule.outbound_flight_departure_time.getTime()
        );
    return upcoming[0] ?? null;
}

export default function ClientHomeScreen() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { data: exchange } = useExchangeRate();
    const rate = exchange?.dolar;

    const { data: reservations = [] } = useClientReservations(user?.uid);
    const [payingReservation, setPayingReservation] = useState<ClientReservationItem | null>(null);

    const pendingPayment = reservations.find((r) => r.internal_status === "awaiting_payment") ?? null;
    const nextFlight = findNextFlight(reservations.filter((r) => r.id !== pendingPayment?.id));

    const firstName = (userData?.firstName || "").trim().split(/\s+/)[0];
    const clientName = `${userData?.firstName ?? ""} ${userData?.lastName ?? ""}`.trim();

    const handleBancardPaymentSuccess = async () => {
        if (!payingReservation) return;
        try {
            // El servidor (bancardGetConfirmation) ya registró el pago y la notificación.
            const paid = await fetchPaidReservationFields(payingReservation.id);
            await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["client-notifications"] });

            const updated: ClientReservationItem = { ...payingReservation, ...paid };
            setPayingReservation(null);
            setTimeout(() => {
                generateAndSharePaymentReceiptPdf(updated, {
                    clientName,
                    clientEmail: user?.email ?? undefined,
                    exchangeRate: rate,
                });
            }, 500);
            Toast.show({ type: "success", text1: "¡Pago recibido!", text2: "Tu vuelo quedó confirmado." });
        } catch (error) {
            console.error("Error al registrar el pago Bancard:", error);
            Alert.alert("Error", "No se pudo actualizar el estado del pago.");
        }
    };

    const nextStatus = nextFlight ? getStatusBadge(nextFlight.internal_status) : null;
    const nextIsPaid = !!nextFlight && isPaidForBoarding(nextFlight);

    return (
        <View style={styles.screen}>
            <ScreenContainer maxWidth={1100}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }} bounces={false}>
                    {/* HERO con la foto de la marca */}
                    <ImageBackground source={HERO_PHOTO} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
                        <View style={styles.heroOverlay} />
                        <View style={[styles.heroContent, { paddingTop: insets.top + 12 }]}>
                            <View style={styles.heroTopRow}>
                                <Image
                                    source={BRAND_LOGOS.horizontalWhite}
                                    style={{ width: 118, height: 118 / BRAND_LOGO_ASPECT.horizontal }}
                                    contentFit="contain"
                                    accessibilityLabel="AltaGo"
                                />
                                <UserAvatar size={42} light />
                            </View>

                            <Text style={[styles.heroGreeting, brandFont(800)]}>
                                {firstName ? `Hola, ${firstName}` : "Hola"}
                            </Text>
                            <Text style={[styles.heroSubtitle, brandFont(400)]}>¿A dónde volamos?</Text>

                            <View style={styles.heroActions}>
                                <TouchableOpacity
                                    onPress={() => router.push("/(client)/book")}
                                    style={styles.primaryButton}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.primaryButtonText, brandFont(700)]}>Reservar un vuelo</Text>
                                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                                <WhatsAppContactButton
                                    variant="light"
                                    compact
                                    label="Hablar con un asesor"
                                    message="Hola, quiero consultar por un vuelo privado con AltaGo."
                                />
                            </View>
                        </View>
                    </ImageBackground>

                    <View style={styles.content}>
                        {/* PAGO PENDIENTE */}
                        {pendingPayment && (
                            <View style={[styles.card, styles.payCard]}>
                                <View style={styles.rowBetween}>
                                    <Text style={[styles.eyebrow, brandFont(700)]}>Vuelo aprobado</Text>
                                    <View style={styles.pendingPill}>
                                        <Text style={[styles.pendingPillText, brandFont(700)]}>Pago pendiente</Text>
                                    </View>
                                </View>
                                <Text style={[styles.routeText, brandFont(800)]}>
                                    {airportShortCode(pendingPayment.originAirport, pendingPayment.trip.origin_airport_ident)} →{" "}
                                    {airportShortCode(pendingPayment.destinationAirport, pendingPayment.trip.destination_airport_ident)}
                                </Text>
                                <Text style={[styles.secondaryText, brandFont(400)]}>
                                    {formatFlightDateTime(pendingPayment.schedule.outbound_flight_departure_time)} ·{" "}
                                    {pendingPayment.capacity.passangers}{" "}
                                    {pendingPayment.capacity.passangers === 1 ? "pasajero" : "pasajeros"}
                                </Text>
                                <Text style={[styles.bodyText, brandFont(400), { marginTop: 8 }]}>
                                    Confirmamos el avión y la tripulación. Pagá con tarjeta para asegurar tu vuelo.
                                </Text>

                                <View style={styles.payFooter}>
                                    <View>
                                        <Text style={[styles.label, brandFont(700)]}>Total · IVA incluido</Text>
                                        <Text style={[styles.amount, brandFont(800)]}>{formatClientUsd(pendingPayment.price)}</Text>
                                        {formatClientGs(pendingPayment.price, rate) && (
                                            <Text style={[styles.secondaryText, brandFont(400)]}>
                                                {formatClientGs(pendingPayment.price, rate)}
                                            </Text>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setPayingReservation(pendingPayment)}
                                        style={styles.payButton}
                                        activeOpacity={0.85}
                                    >
                                        <MaterialCommunityIcons name="credit-card-outline" size={18} color="#FFFFFF" />
                                        <Text style={[styles.primaryButtonText, brandFont(700)]}>Pagar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TU PRÓXIMO VUELO */}
                        <Text style={[styles.sectionTitle, brandFont(700)]}>Tu próximo vuelo</Text>
                        {nextFlight && nextStatus ? (
                            <TouchableOpacity
                                style={styles.card}
                                activeOpacity={0.9}
                                onPress={() =>
                                    router.push({ pathname: "/flights/flight-details", params: { reservationId: nextFlight.id } })
                                }
                            >
                                <View style={styles.rowBetween}>
                                    <Text style={[styles.eyebrow, brandFont(700)]}>
                                        {formatFlightDateTime(nextFlight.schedule.outbound_flight_departure_time)}
                                    </Text>
                                    <View
                                        style={[
                                            styles.statusPill,
                                            { backgroundColor: nextStatus.backgroundColor, borderColor: nextStatus.borderColor },
                                        ]}
                                    >
                                        <Text style={[styles.statusPillText, brandFont(700), { color: nextStatus.textColor }]}>
                                            {nextStatus.label}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.routeRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.code, brandFont(800)]}>
                                            {airportShortCode(nextFlight.originAirport, nextFlight.trip.origin_airport_ident)}
                                        </Text>
                                        <Text style={[styles.secondaryText, brandFont(400)]} numberOfLines={1}>
                                            {airportCityName(nextFlight.originAirport)}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons
                                        name="airplane"
                                        size={22}
                                        color={BRAND_COLORS.azur}
                                        style={{ transform: [{ rotate: "90deg" }], marginHorizontal: 8 }}
                                    />
                                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                                        <Text style={[styles.code, brandFont(800)]}>
                                            {airportShortCode(nextFlight.destinationAirport, nextFlight.trip.destination_airport_ident)}
                                        </Text>
                                        <Text style={[styles.secondaryText, brandFont(400), { textAlign: "right" }]} numberOfLines={1}>
                                            {airportCityName(nextFlight.destinationAirport)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.cardActionRow}>
                                    {nextIsPaid ? (
                                        <TouchableOpacity
                                            onPress={() =>
                                                router.push({
                                                    pathname: "/(client)/flights/boarding-pass",
                                                    params: { reservationId: nextFlight.id },
                                                })
                                            }
                                            style={styles.secondaryButton}
                                            activeOpacity={0.85}
                                        >
                                            <MaterialCommunityIcons name="qrcode" size={18} color={BRAND_COLORS.navy} />
                                            <Text style={[styles.secondaryButtonText, brandFont(700)]}>Boarding pass</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={[styles.secondaryText, brandFont(400), { flex: 1 }]}>
                                            Te avisamos cuando operaciones confirme tu vuelo.
                                        </Text>
                                    )}
                                    <View style={styles.linkRow}>
                                        <Text style={[styles.linkText, brandFont(700)]}>Ver detalle</Text>
                                        <Ionicons name="chevron-forward" size={16} color={BRAND_COLORS.azur} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.card, { alignItems: "center" }]}>
                                <MaterialCommunityIcons name="airplane-clock" size={30} color={BRAND_COLORS.azur} />
                                <Text style={[styles.cardTitle, brandFont(700), { marginTop: 8 }]}>
                                    Todavía no tenés vuelos programados
                                </Text>
                                <Text style={[styles.secondaryText, brandFont(400), { textAlign: "center", marginTop: 4 }]}>
                                    Buscá tu ruta y fecha, o escribinos y lo armamos a tu medida.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => router.push("/(client)/book")}
                                    style={[styles.secondaryButton, { marginTop: 14 }]}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="search" size={16} color={BRAND_COLORS.navy} />
                                    <Text style={[styles.secondaryButtonText, brandFont(700)]}>Buscar un vuelo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* DESTINOS DESTACADOS */}
                        <Text style={[styles.sectionTitle, brandFont(700)]}>Destinos destacados</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                            {FEATURED_DESTINATIONS.map((d) => (
                                <TouchableOpacity
                                    key={d.id}
                                    style={styles.destCard}
                                    activeOpacity={0.9}
                                    onPress={() => openAltaGoWhatsApp(d.message)}
                                    accessibilityHint="Abre WhatsApp para consultar este destino"
                                >
                                    <Image source={d.image} style={styles.destImage} contentFit="cover" />
                                    <View style={{ padding: 12 }}>
                                        <Text style={[styles.cardTitle, brandFont(700)]} numberOfLines={1}>{d.title}</Text>
                                        <Text style={[styles.secondaryText, brandFont(400)]} numberOfLines={1}>{d.subtitle}</Text>
                                        <View style={[styles.linkRow, { marginTop: 8 }]}>
                                            <Ionicons name="logo-whatsapp" size={15} color={BRAND_COLORS.azur} />
                                            <Text style={[styles.linkText, brandFont(700)]}>Consultar</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* VUELO A MEDIDA */}
                        <View style={styles.helpCard}>
                            <Text style={[styles.helpTitle, brandFont(800)]}>¿Necesitás un vuelo a medida?</Text>
                            <Text style={[styles.helpText, brandFont(400)]}>
                                Otra ciudad, varias escalas o un pedido especial: te armamos el presupuesto.
                            </Text>
                            <WhatsAppContactButton message="Hola, quiero pedir un presupuesto para un vuelo a medida." />
                        </View>
                    </View>
                </ScrollView>
            </ScreenContainer>

            <BancardPaymentModal
                visible={!!payingReservation}
                reservation={payingReservation}
                onClose={() => setPayingReservation(null)}
                onPaymentSuccess={handleBancardPaymentSuccess}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BRAND_COLORS.backgroundAlt },
    hero: { overflow: "hidden", borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    heroImage: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    heroOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(3,4,54,0.62)" },
    heroContent: { paddingHorizontal: 20, paddingBottom: 28 },
    heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
    heroGreeting: { fontFamily: "NotoSans_800ExtraBold", fontSize: 28, color: "#FFFFFF" },
    heroSubtitle: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.body + 2, color: "#E6EEFF", marginTop: 2 },
    heroActions: { marginTop: 20, gap: 10, alignItems: "flex-start" },
    primaryButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: BRAND_COLORS.azur,
        paddingVertical: 13,
        paddingHorizontal: 20,
        borderRadius: BRAND_RADII.input,
    },
    primaryButtonText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: "#FFFFFF" },
    content: { paddingHorizontal: 16, paddingTop: 18 },
    card: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 16,
        marginBottom: 18,
    },
    payCard: { borderColor: BRAND_COLORS.azur, borderWidth: 1.5 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    eyebrow: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.label,
        color: BRAND_COLORS.azur,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        flexShrink: 1,
    },
    pendingPill: { backgroundColor: BRAND_COLORS.navy, borderRadius: BRAND_RADII.pill, paddingHorizontal: 10, paddingVertical: 3 },
    pendingPillText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.label, color: BRAND_COLORS.white },
    statusPill: { borderRadius: BRAND_RADII.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
    statusPillText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.label },
    routeText: { fontFamily: "NotoSans_800ExtraBold", fontSize: 22, color: BRAND_COLORS.navy, marginTop: 8 },
    routeRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
    code: { fontFamily: "NotoSans_800ExtraBold", fontSize: 24, color: BRAND_COLORS.navy },
    cardTitle: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.cardTitle, color: BRAND_COLORS.navy },
    bodyText: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.body - 1, color: BRAND_COLORS.navy, lineHeight: 20 },
    secondaryText: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary, color: BRAND_COLORS.textMuted },
    label: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.label,
        color: BRAND_COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    amount: { fontFamily: "NotoSans_800ExtraBold", fontSize: 22, color: BRAND_COLORS.navy },
    payFooter: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: BRAND_COLORS.border,
    },
    payButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: BRAND_COLORS.azur,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: BRAND_RADII.input,
    },
    sectionTitle: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.cardTitle + 1, color: BRAND_COLORS.navy, marginBottom: 10 },
    cardActionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: BRAND_COLORS.border,
    },
    secondaryButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: BRAND_RADII.input,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    secondaryButtonText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.navy },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    linkText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.azur },
    destCard: {
        width: 250,
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        overflow: "hidden",
        marginBottom: 18,
    },
    destImage: { width: "100%", height: 120 },
    helpCard: {
        backgroundColor: BRAND_COLORS.navy,
        borderRadius: BRAND_RADII.card,
        padding: 18,
        gap: 10,
        marginTop: 4,
    },
    helpTitle: { fontFamily: "NotoSans_800ExtraBold", fontSize: BRAND_TYPE.cardTitle + 1, color: "#FFFFFF" },
    helpText: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary + 1, color: "#D5E3FF", lineHeight: 20 },
});
