import { airportCode, formatBoardingDate, formatBoardingTime } from "@/components/boarding-pass-card";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { useClientReservations } from "@/hooks/useClientReservations";
import { isCanceled, isPaidForBoarding } from "@/utils/boarding-pass";
import { brandFont } from "@/utils/brand-fonts";
import { toHref } from "@/utils/role-routes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const MAX_ITEMS = 3;

/** Perfil del cliente: accesos a los boarding pass de sus próximos vuelos pagados. */
export function ClientBoardingPassList({ clientId }: { clientId: string | undefined }) {
    const router = useRouter();
    const { data: reservations = [] } = useClientReservations(clientId);

    const upcoming = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return reservations
            .filter((r) => isPaidForBoarding(r) && !isCanceled(r) && r.internal_status !== "completed")
            .filter((r) => {
                const last = r.schedule?.roundtrip && r.schedule?.return_flight_departure_time
                    ? r.schedule.return_flight_departure_time
                    : r.schedule?.outbound_flight_departure_time;
                return !!last && last >= startOfToday;
            })
            .sort(
                (a, b) =>
                    a.schedule.outbound_flight_departure_time.getTime() - b.schedule.outbound_flight_departure_time.getTime()
            )
            .slice(0, MAX_ITEMS);
    }, [reservations]);

    if (upcoming.length === 0) return null;

    return (
        <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, brandFont(800)]}>MIS BOARDING PASS</Text>
            <View style={styles.card}>
                {upcoming.map((r, idx) => {
                    const departure = r.schedule.outbound_flight_departure_time;
                    return (
                        <TouchableOpacity
                            key={r.id}
                            activeOpacity={0.8}
                            style={[styles.row, idx > 0 ? styles.rowBorder : null]}
                            onPress={() =>
                                router.push(
                                    toHref({ pathname: "/(client)/flights/boarding-pass", params: { reservationId: r.id } })
                                )
                            }
                        >
                            <View style={styles.icon}>
                                <MaterialCommunityIcons name="qrcode" size={20} color={BRAND_COLORS.white} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.route, brandFont(700)]}>
                                    {airportCode(r.originAirport, r.trip?.origin_airport_ident)} →{" "}
                                    {airportCode(r.destinationAirport, r.trip?.destination_airport_ident)}
                                </Text>
                                <Text style={[styles.date, brandFont(400)]}>
                                    {formatBoardingDate(departure)} · {formatBoardingTime(departure)} hs
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={BRAND_COLORS.azur} />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontFamily: "NotoSans_400Regular",
        color: "#94A3B8",
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 10,
        paddingLeft: 4,
    },
    card: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
    },
    rowBorder: {
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: BRAND_RADII.input,
        backgroundColor: BRAND_COLORS.navy,
        alignItems: "center",
        justifyContent: "center",
    },
    route: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.navy,
        fontSize: 15,
    },
    date: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.textMuted,
        fontSize: 12,
        marginTop: 1,
    },
});
