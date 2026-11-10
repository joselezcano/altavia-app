import { BoardingPassCard } from "@/components/boarding-pass-card";
import { PassengerManifestModal } from "@/components/passenger-manifest-modal";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { useBoardingPasses } from "@/hooks/useBoardingPasses";
import { useReservationDetails } from "@/hooks/useReservationDetails";
import { isCanceled, isPaidForBoarding } from "@/utils/boarding-pass";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function Notice({
    icon,
    title,
    message,
    actionLabel,
    onAction,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <View style={styles.notice}>
            <View style={styles.noticeIcon}>
                <Ionicons name={icon} size={22} color={BRAND_COLORS.azur} />
            </View>
            <Text style={[styles.noticeTitle, brandFont(700)]}>{title}</Text>
            <Text style={[styles.noticeMessage, brandFont(400)]}>{message}</Text>
            {actionLabel && onAction ? (
                <TouchableOpacity onPress={onAction} style={styles.primaryButton} activeOpacity={0.85}>
                    <Ionicons name="people-outline" size={18} color={BRAND_COLORS.white} />
                    <Text style={[styles.primaryButtonText, brandFont(700)]}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/** Boarding pass del cliente: una tarjeta con QR por cada pasajero del manifiesto. */
export default function BoardingPassScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
    const [isManifestVisible, setIsManifestVisible] = useState(false);

    const {
        data: reservation,
        isLoading: isLoadingReservation,
        refetch: refetchReservation,
        isRefetching: isRefetchingReservation,
    } = useReservationDetails(reservationId);

    const paid = reservation ? isPaidForBoarding(reservation) : false;
    const canceled = reservation ? isCanceled(reservation) : false;

    const {
        data: passengers = [],
        isLoading: isLoadingPasses,
        refetch: refetchPasses,
        isRefetching: isRefetchingPasses,
    } = useBoardingPasses(reservationId, paid && !canceled);

    const isLoading = isLoadingReservation || (paid && !canceled && isLoadingPasses);
    const qrSize = Math.min(Math.max(width - 32 - 40 - 26, 160), 260);

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/(client)/flights" as Href);
    };

    const refresh = async () => {
        await refetchReservation();
        if (paid && !canceled) await refetchPasses();
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={BRAND_COLORS.azur} />
                    <Text style={[styles.loadingText, brandFont(500)]}>Preparando tus boarding pass...</Text>
                </View>
            );
        }
        if (!reservation) {
            return (
                <Notice
                    icon="alert-circle-outline"
                    title="Reserva no encontrada"
                    message="No pudimos recuperar los datos de esta reserva. Revisá tu conexión e intentá de nuevo."
                />
            );
        }
        if (canceled) {
            return (
                <Notice
                    icon="close-circle-outline"
                    title="Reserva cancelada"
                    message="Esta reserva fue cancelada, por eso no tiene boarding pass."
                />
            );
        }
        if (!paid) {
            return (
                <Notice
                    icon="card-outline"
                    title="Pago pendiente"
                    message="Los boarding pass se emiten cuando el pago del vuelo está confirmado."
                />
            );
        }
        if (passengers.length === 0) {
            return (
                <Notice
                    icon="people-outline"
                    title="Cargá el manifiesto de pasajeros"
                    message="Para emitir los boarding pass necesitamos el nombre y el documento de cada persona que viaja. Es un requisito de la DINAC."
                    actionLabel="Cargar manifiesto"
                    onAction={() => setIsManifestVisible(true)}
                />
            );
        }
        return (
            <View style={{ gap: 20 }}>
                <View style={styles.tip}>
                    <Ionicons name="information-circle-outline" size={18} color={BRAND_COLORS.azur} />
                    <Text style={[styles.tipText, brandFont(500)]}>
                        Cada pasajero tiene su propio código. Podés hacer una captura de pantalla para tenerlo sin conexión;
                        si cambiás el nombre o el documento de alguien, se genera un código nuevo.
                    </Text>
                </View>
                {passengers.map((p, idx) => (
                    <BoardingPassCard
                        key={p.id || idx}
                        reservation={reservation}
                        passenger={p}
                        index={idx}
                        total={passengers.length}
                        qrSize={qrSize}
                    />
                ))}
                <TouchableOpacity onPress={() => setIsManifestVisible(true)} style={styles.secondaryButton} activeOpacity={0.85}>
                    <Ionicons name="create-outline" size={18} color={BRAND_COLORS.azur} />
                    <Text style={[styles.secondaryButtonText, brandFont(700)]}>Modificar manifiesto</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={20} color={BRAND_COLORS.navy} />
                </TouchableOpacity>
                <View style={{ alignItems: "center" }}>
                    <Text style={[styles.headerEyebrow, brandFont(700)]}>TU VIAJE</Text>
                    <Text style={[styles.headerTitle, brandFont(700)]}>Boarding pass</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetchingReservation || isRefetchingPasses}
                        onRefresh={refresh}
                        tintColor={BRAND_COLORS.azur}
                    />
                }
            >
                {renderContent()}
            </ScrollView>

            {reservation ? (
                <PassengerManifestModal
                    visible={isManifestVisible}
                    onClose={() => setIsManifestVisible(false)}
                    reservation={reservation}
                    onSaved={() => {
                        refetchPasses();
                    }}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        alignItems: "center",
        justifyContent: "center",
    },
    headerEyebrow: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.azur,
        fontSize: 10,
        letterSpacing: 2,
    },
    headerTitle: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.navy,
        fontSize: 18,
    },
    loading: {
        alignItems: "center",
        paddingVertical: 60,
        gap: 12,
    },
    loadingText: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.textMuted,
        fontSize: 13,
    },
    notice: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 24,
        alignItems: "center",
        gap: 10,
        marginTop: 8,
    },
    noticeIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: BRAND_COLORS.surfaceTint,
        alignItems: "center",
        justifyContent: "center",
    },
    noticeTitle: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.navy,
        fontSize: 17,
        textAlign: "center",
    },
    noticeMessage: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.textMuted,
        fontSize: 13,
        lineHeight: 19,
        textAlign: "center",
    },
    primaryButton: {
        marginTop: 8,
        height: 52,
        alignSelf: "stretch",
        borderRadius: BRAND_RADII.button,
        backgroundColor: BRAND_COLORS.azur,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    primaryButtonText: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.white,
        fontSize: 15,
    },
    secondaryButton: {
        height: 52,
        borderRadius: BRAND_RADII.button,
        borderWidth: 1.5,
        borderColor: BRAND_COLORS.azur,
        backgroundColor: BRAND_COLORS.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    secondaryButtonText: {
        fontFamily: "NotoSans_400Regular",
        color: BRAND_COLORS.azur,
        fontSize: 15,
    },
    tip: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: 14,
        padding: 12,
    },
    tipText: {
        fontFamily: "NotoSans_400Regular",
        flex: 1,
        color: BRAND_COLORS.navy,
        fontSize: 12,
        lineHeight: 17,
    },
});
