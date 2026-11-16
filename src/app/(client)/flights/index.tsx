import { BancardPaymentModal } from "@/components/bancard-modal";
import { FlightSummaryCard } from "@/components/flight-summary-card";
import { LoadingCard } from "@/components/loading-card";
import { ScreenHeader } from "@/components/screen-header";
import UserAvatar from "@/components/user-avatar";
import { WhatsAppContactButton } from "@/components/whatsapp-contact-button";
import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { ClientReservationItem } from "@/types/all-roles";
import { airportCityName, airportShortCode } from "@/utils/airport-label";
import { BOARDING_STATUSES, isCanceled, isPaidForBoarding } from "@/utils/boarding-pass";
import { brandFont } from "@/utils/brand-fonts";
import { formatClientGs, formatClientUsd, formatFlightDateTime } from "@/utils/client-format";
import { getStatusBadge } from "@/utils/flight-status";
import { buildReservationWeatherRequest } from "@/utils/flight-weather";
import { fetchPaidReservationFields } from "@/utils/paid-reservation";
import { generateAndSharePaymentReceiptPdf } from "@/utils/payment-receipt";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

type FlightsTab = "upcoming" | "past";

/** Un vuelo pasa a "Anteriores" si terminó, se canceló o salió hace más de 6 horas. */
function isPastFlight(r: ClientReservationItem, now: number): boolean {
    if (isCanceled(r) || r.internal_status === "completed" || r.internal_status === "no_show") return true;
    const last = r.schedule.return_flight_departure_time ?? r.schedule.outbound_flight_departure_time;
    const t = last?.getTime?.();
    return typeof t === "number" && !isNaN(t) && t < now - 6 * 3600 * 1000;
}

export default function ClientFlightsScreen() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: exchange } = useExchangeRate();
    const rate = exchange?.dolar;
    const { data: reservations = [], isLoading, isRefetching, refetch } = useClientReservations(user?.uid);

    const [payingReservation, setPayingReservation] = useState<ClientReservationItem | null>(null);
    const [tab, setTab] = useState<FlightsTab>("upcoming");

    const clientName = `${userData?.firstName ?? ""} ${userData?.lastName ?? ""}`.trim();
    const receiptOptions = { clientName, clientEmail: user?.email ?? undefined, exchangeRate: rate };

    const { upcoming, past } = useMemo(() => {
        const now = Date.now();
        const byDate = (a: ClientReservationItem, b: ClientReservationItem) =>
            a.schedule.outbound_flight_departure_time.getTime() - b.schedule.outbound_flight_departure_time.getTime();
        return {
            upcoming: reservations.filter((r) => !isPastFlight(r, now)).sort(byDate),
            past: reservations.filter((r) => isPastFlight(r, now)).sort((a, b) => byDate(b, a)),
        };
    }, [reservations]);
    const list = tab === "upcoming" ? upcoming : past;

    // Una sola card abierta a la vez. Mientras el usuario no toque ninguna, se abre sola
    // la primera reserva que espera pago, para que el botón "Pagar" quede a la vista.
    const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);
    const firstAwaitingPaymentId = upcoming.find((r) => r.internal_status === "awaiting_payment")?.id ?? null;
    const effectiveExpandedId = expandedId === undefined ? firstAwaitingPaymentId : expandedId;

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
                generateAndSharePaymentReceiptPdf(updated, receiptOptions);
            }, 500);
            Toast.show({ type: "success", text1: "¡Pago recibido!", text2: "Tu vuelo quedó confirmado." });
        } catch (error) {
            console.error("Error al registrar el pago Bancard:", error);
            Alert.alert("Error", "No se pudo actualizar el estado del pago. Intentá de nuevo.");
        }
    };

    const goToDetails = (id: string) => router.push({ pathname: "/flights/flight-details", params: { reservationId: id } });

    const renderActions = (item: ClientReservationItem) => {
        const paid = isPaidForBoarding(item);
        const canBoard = paid && BOARDING_STATUSES.includes(item.internal_status);
        const canTrack = !!item.fa_flight_id && (item.internal_status === "in_flight" || item.internal_status === "delayed" || item.internal_status === "confirmed");

        if (item.internal_status === "awaiting_payment") {
            const gs = formatClientGs(item.price, rate);
            return (
                <View style={[styles.notice, styles.noticeBlue]}>
                    <Text style={[styles.noticeTitle, brandFont(700), { color: BRAND_COLORS.navy }]}>Vuelo aprobado: falta el pago</Text>
                    <Text style={[styles.noticeText, brandFont(400), { color: BRAND_COLORS.navy }]}>
                        Confirmamos el avión y la tripulación. Pagá con tarjeta para asegurar tu vuelo.
                    </Text>
                    <View style={styles.payRow}>
                        <View>
                            <Text style={[styles.label, brandFont(700)]}>Total · IVA incluido</Text>
                            <Text style={[styles.amount, brandFont(800)]}>{formatClientUsd(item.price)}</Text>
                            {gs && <Text style={[styles.secondaryText, brandFont(400)]}>{gs}</Text>}
                        </View>
                        <TouchableOpacity onPress={() => setPayingReservation(item)} style={styles.primaryButton} activeOpacity={0.85}>
                            <MaterialCommunityIcons name="credit-card-outline" size={18} color="#FFFFFF" />
                            <Text style={[styles.primaryButtonText, brandFont(700)]}>Pagar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        if (item.internal_status === "pending_approval" || item.internal_status === "pending") {
            return (
                <View style={[styles.notice, styles.noticeAmber]}>
                    <Text style={[styles.noticeTitle, brandFont(700), { color: BRAND_COLORS.navy }]}>Esperando confirmación</Text>
                    <Text style={[styles.noticeText, brandFont(400), { color: BRAND_COLORS.navy }]}>
                        Estamos confirmando la disponibilidad del avión y la tripulación. Te avisamos apenas esté listo para pagar.
                    </Text>
                </View>
            );
        }

        return (
            <View style={{ gap: 10 }}>
                {canBoard && (
                    <TouchableOpacity
                        onPress={() =>
                            router.push({ pathname: "/(client)/flights/boarding-pass", params: { reservationId: item.id } })
                        }
                        style={styles.primaryButtonWide}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="qrcode" size={18} color="#FFFFFF" />
                        <Text style={[styles.primaryButtonText, brandFont(700)]}>Ver boarding pass</Text>
                    </TouchableOpacity>
                )}
                {canTrack && (
                    <TouchableOpacity
                        onPress={() =>
                            router.push({ pathname: "/flights/flight-tracker", params: { fa_flight_id: item.fa_flight_id ?? "" } })
                        }
                        style={styles.secondaryButton}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="navigate-outline" size={17} color={BRAND_COLORS.navy} />
                        <Text style={[styles.secondaryButtonText, brandFont(700)]}>Seguir el vuelo</Text>
                    </TouchableOpacity>
                )}
                {paid && (
                    <TouchableOpacity
                        onPress={() => generateAndSharePaymentReceiptPdf(item, receiptOptions)}
                        style={styles.secondaryButton}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="receipt-outline" size={17} color={BRAND_COLORS.navy} />
                        <Text style={[styles.secondaryButtonText, brandFont(700)]}>Comprobante de pago</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={{ paddingHorizontal: 16 }}>
                <ScreenHeader title="Mis vuelos" subtitle="Tus reservas y su estado" hideBack right={<UserAvatar size={40} />} />
                <View style={styles.segment}>
                    {(["upcoming", "past"] as FlightsTab[]).map((t) => {
                        const active = tab === t;
                        const count = t === "upcoming" ? upcoming.length : past.length;
                        return (
                            <TouchableOpacity
                                key={t}
                                onPress={() => setTab(t)}
                                style={[styles.segmentItem, active ? styles.segmentItemActive : null]}
                                activeOpacity={0.85}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                            >
                                <Text style={[styles.segmentText, brandFont(700), active ? styles.segmentTextActive : null]}>
                                    {t === "upcoming" ? "Próximos" : "Anteriores"} ({count})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND_COLORS.navy} />}
            >
                {isLoading ? (
                    <LoadingCard message="Cargando tus reservas..." />
                ) : list.length === 0 ? (
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="airplane-clock" size={34} color={BRAND_COLORS.azur} />
                        <Text style={[styles.emptyTitle, brandFont(700)]}>
                            {tab === "upcoming" ? "No tenés vuelos próximos" : "Todavía no tenés vuelos anteriores"}
                        </Text>
                        {tab === "upcoming" && (
                            <>
                                <Text style={[styles.secondaryText, brandFont(400), { textAlign: "center" }]}>
                                    Buscá tu ruta y fecha, o escribinos y te armamos el presupuesto.
                                </Text>
                                <TouchableOpacity onPress={() => router.push("/book")} style={styles.primaryButtonWide} activeOpacity={0.85}>
                                    <Ionicons name="search" size={17} color="#FFFFFF" />
                                    <Text style={[styles.primaryButtonText, brandFont(700)]}>Buscar un vuelo</Text>
                                </TouchableOpacity>
                                <View style={{ alignSelf: "stretch" }}>
                                    <WhatsAppContactButton variant="outline" message="Hola, quiero consultar por un vuelo privado con AltaGo." />
                                </View>
                            </>
                        )}
                    </View>
                ) : (
                    <View style={{ gap: 14 }}>
                        {list.map((item) => (
                            <FlightSummaryCard
                                key={item.id}
                                expanded={effectiveExpandedId === item.id}
                                onToggle={() => setExpandedId(effectiveExpandedId === item.id ? null : item.id)}
                                eyebrow={item.aircraftSpecs?.basic_specs?.model || "Vuelo privado"}
                                originCode={airportShortCode(item.originAirport, item.trip.origin_airport_ident)}
                                originName={airportCityName(item.originAirport)}
                                destinationCode={airportShortCode(item.destinationAirport, item.trip.destination_airport_ident)}
                                destinationName={airportCityName(item.destinationAirport)}
                                departureTime={item.schedule.outbound_flight_departure_time}
                                roundtrip={item.schedule.roundtrip}
                                status={getStatusBadge(item.internal_status)}
                                registration={item.aircraftSpecs?.basic_specs?.registration}
                                passengers={item.capacity.passangers}
                                priceUsd={item.price}
                                weatherRequest={tab === "upcoming" ? buildReservationWeatherRequest(item) : null}
                            >
                                {/* Horarios */}
                                <View style={styles.scheduleBox}>
                                    <View style={styles.scheduleRow}>
                                        <Text style={[styles.secondaryText, brandFont(400)]}>Ida</Text>
                                        <Text style={[styles.scheduleValue, brandFont(700)]}>
                                            {formatFlightDateTime(item.schedule.outbound_flight_departure_time)}
                                        </Text>
                                    </View>
                                    {item.schedule.roundtrip && item.schedule.return_flight_departure_time && (
                                        <View style={styles.scheduleRow}>
                                            <Text style={[styles.secondaryText, brandFont(400)]}>Vuelta</Text>
                                            <Text style={[styles.scheduleValue, brandFont(700)]}>
                                                {formatFlightDateTime(item.schedule.return_flight_departure_time)}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {tab === "upcoming" && renderActions(item)}

                                <TouchableOpacity onPress={() => goToDetails(item.id)} style={styles.linkButton} activeOpacity={0.8}>
                                    <Text style={[styles.linkText, brandFont(700)]}>Ver detalle del vuelo</Text>
                                    <Ionicons name="chevron-forward" size={16} color={BRAND_COLORS.azur} />
                                </TouchableOpacity>
                            </FlightSummaryCard>
                        ))}
                    </View>
                )}
            </ScrollView>

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
    segment: {
        flexDirection: "row",
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.input,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 4,
        marginBottom: 14,
    },
    segmentItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 },
    segmentItemActive: { backgroundColor: BRAND_COLORS.navy },
    segmentText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.textMuted },
    segmentTextActive: { color: "#FFFFFF" },
    scheduleBox: {
        backgroundColor: BRAND_COLORS.backgroundAlt,
        borderRadius: 14,
        padding: 12,
        gap: 8,
    },
    scheduleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    scheduleValue: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.navy },
    notice: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
    noticeBlue: { backgroundColor: BRAND_COLORS.surfaceTint, borderColor: BRAND_COLORS.crystal },
    noticeAmber: { backgroundColor: BRAND_COLORS.white, borderColor: BRAND_COLORS.border },
    noticeTitle: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body },
    noticeText: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary + 1, lineHeight: 20 },
    payRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 },
    label: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.label,
        color: BRAND_COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    amount: { fontFamily: "NotoSans_800ExtraBold", fontSize: 20, color: BRAND_COLORS.navy },
    secondaryText: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary, color: BRAND_COLORS.textMuted },
    primaryButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: BRAND_COLORS.azur,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: BRAND_RADII.input,
    },
    primaryButtonWide: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: BRAND_COLORS.azur,
        paddingVertical: 13,
        borderRadius: BRAND_RADII.input,
        alignSelf: "stretch",
    },
    primaryButtonText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: "#FFFFFF" },
    secondaryButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: BRAND_COLORS.surfaceTint,
        paddingVertical: 12,
        borderRadius: BRAND_RADII.input,
    },
    secondaryButtonText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.navy },
    linkButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 },
    linkText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.azur },
    empty: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 22,
        alignItems: "center",
        gap: 10,
        marginTop: 8,
    },
    emptyTitle: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.cardTitle, color: BRAND_COLORS.navy, textAlign: "center" },
});
