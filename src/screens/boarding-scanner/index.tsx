import { formatBoardingTime } from "@/components/boarding-pass-card";
import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { useMarkPassengerBoarded } from "@/hooks/useMarkPassengerBoarded";
import { useReservationDetails } from "@/hooks/useReservationDetails";
import type { BoardingQrPayload, BoardingScanResult } from "@/types/boarding";
import {
    fetchBoardingSnapshot,
    isCanceled,
    isPaidForBoarding,
    parseBoardingQr,
    precheckBoarding,
} from "@/utils/boarding-pass";
import { brandFont } from "@/utils/brand-fonts";
import { canManageReservationAircraft } from "@/utils/reservation-permissions";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Mismo QR leÃ­do de nuevo dentro de este lapso se ignora (la cÃ¡mara dispara varias veces por segundo). */
const SAME_CODE_COOLDOWN_MS = 4000;
/** El resultado OK se cierra solo para seguir escaneando. */
const SUCCESS_AUTO_DISMISS_MS = 2500;

const SUCCESS = "#059669";
const WARNING = "#D97706";
const DANGER = "#DC2626";

function resultVisual(result: BoardingScanResult) {
    if (result.kind === "boarded") {
        return { color: SUCCESS, icon: "checkmark-circle" as const, title: "Embarque registrado" };
    }
    if (result.kind === "already_boarded") {
        return { color: WARNING, icon: "alert-circle" as const, title: "Ya estaba embarcado" };
    }
    return { color: DANGER, icon: "close-circle" as const, title: "No puede embarcar" };
}

/** EscÃ¡ner de boarding pass para el piloto asignado, el owner y la encargada de la aeronave. */
export default function BoardingScannerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, role, profileData } = useAuth();
    const { reservationId } = useLocalSearchParams<{ reservationId: string }>();

    const [permission, requestPermission] = useCameraPermissions();
    const [torchOn, setTorchOn] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<BoardingScanResult | null>(null);

    const busyRef = useRef(false);
    const lastScanRef = useRef<{ data: string; at: number }>({ data: "", at: 0 });
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: reservation, isLoading, refetch, isRefetching } = useReservationDetails(reservationId);
    const markBoarded = useMarkPassengerBoarded();

    // Limpia el temporizador del cierre automÃ¡tico al salir de la pantalla.
    useEffect(() => {
        return () => {
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        };
    }, []);

    const isAssignedPilot = !!user?.uid && !!reservation?.pilot_ids?.includes(user.uid);
    const canManage = canManageReservationAircraft({
        role,
        uid: user?.uid,
        profileData,
        aircraftId: reservation?.aircraftId,
        aircraftOwnerId: reservation?.aircraftSpecs?.ownerId,
    });
    const canScan = isAssignedPilot || canManage;
    const paid = reservation ? isPaidForBoarding(reservation) : false;
    const canceled = reservation ? isCanceled(reservation) : false;

    const passengers = reservation?.passengers ?? [];
    const boardedCount = passengers.filter((p) => !!p.boardedAt).length;

    const showResult = (next: BoardingScanResult) => {
        setResult(next);
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        if (next.kind === "boarded") {
            dismissTimerRef.current = setTimeout(() => {
                setResult(null);
                busyRef.current = false;
            }, SUCCESS_AUTO_DISMISS_MS);
        }
    };

    const finish = (next: BoardingScanResult) => {
        setIsProcessing(false);
        showResult(next);
    };

    const dismissResult = () => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        setResult(null);
        busyRef.current = false;
    };

    const registerBoarding = async (payload: BoardingQrPayload) => {
        if (!user?.uid) return;
        try {
            const res = await markBoarded.mutateAsync({ payload, uid: user.uid });
            finish(res);
        } catch (error: any) {
            finish({
                kind: "rejected",
                reason: "error",
                message: error?.code === "permission-denied"
                    ? "No tenÃ©s permiso para registrar embarques en este vuelo."
                    : "No se pudo registrar el embarque. RevisÃ¡ la conexiÃ³n e intentÃ¡ de nuevo.",
            });
        }
    };

    const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
        const now = Date.now();
        if (busyRef.current) return;
        if (data === lastScanRef.current.data && now - lastScanRef.current.at < SAME_CODE_COOLDOWN_MS) return;
        lastScanRef.current = { data, at: now };
        busyRef.current = true;

        const payload = parseBoardingQr(data);
        if (!payload) {
            showResult({ kind: "rejected", reason: "invalid_format", message: "Este cÃ³digo no es un boarding pass de AltaGo." });
            return;
        }
        if (payload.reservationId !== reservationId) {
            showResult({ kind: "rejected", reason: "other_reservation", message: "Este boarding pass es de otra reserva." });
            return;
        }

        setIsProcessing(true);
        try {
            // Se valida contra el dato del servidor, no contra la cachÃ© de la pantalla.
            const snapshot = await fetchBoardingSnapshot(payload.reservationId);
            if (!snapshot) {
                finish({ kind: "rejected", reason: "not_found", message: "No se encontrÃ³ la reserva." });
                return;
            }
            const check = precheckBoarding(snapshot, payload);
            if (!check.ok) {
                finish(check.result);
                return;
            }
            if (check.alreadyBoarded) {
                finish({ kind: "already_boarded", passenger: check.passenger });
                return;
            }
            if (!check.isFlightToday) {
                const flightDate = snapshot.departures[0]?.toLocaleDateString("es-PY", { day: "2-digit", month: "long" });
                Alert.alert(
                    "El vuelo no es hoy",
                    `Este vuelo estÃ¡ programado para el ${flightDate ?? "otro dÃ­a"}. Â¿Registrar igual el embarque de ${check.passenger.fullName}?`,
                    [
                        {
                            text: "Cancelar",
                            style: "cancel",
                            onPress: () => {
                                setIsProcessing(false);
                                busyRef.current = false;
                            },
                        },
                        { text: "Registrar embarque", onPress: () => registerBoarding(payload) },
                    ],
                    { cancelable: false }
                );
                return;
            }
            await registerBoarding(payload);
        } catch (error) {
            console.error("Error al validar el boarding pass:", error);
            finish({
                kind: "rejected",
                reason: "error",
                message: "No se pudo validar el cÃ³digo. RevisÃ¡ la conexiÃ³n e intentÃ¡ de nuevo.",
            });
        }
    };

    const handlePermission = async () => {
        if (permission && !permission.canAskAgain) {
            Linking.openSettings();
            return;
        }
        await requestPermission();
    };

    const renderCamera = () => {
        if (!permission) {
            return (
                <View style={[styles.cameraBox, styles.centered]}>
                    <ActivityIndicator color={BRAND_COLORS.white} />
                </View>
            );
        }
        if (!permission.granted) {
            return (
                <View style={[styles.cameraBox, styles.centered, { padding: 24, gap: 12 }]}>
                    <Ionicons name="camera-outline" size={40} color={BRAND_COLORS.crystal} />
                    <Text style={[styles.permissionTitle, brandFont(700)]}>Permitir el uso de la cÃ¡mara</Text>
                    <Text style={[styles.permissionText, brandFont(400)]}>
                        La cÃ¡mara se usa solo para leer el QR del boarding pass de cada pasajero.
                    </Text>
                    <TouchableOpacity onPress={handlePermission} style={styles.permissionButton} activeOpacity={0.85}>
                        <Text style={[styles.permissionButtonText, brandFont(700)]}>
                            {permission.canAskAgain ? "Permitir cÃ¡mara" : "Abrir ajustes"}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        const visual = result ? resultVisual(result) : null;
        return (
            <View style={styles.cameraBox}>
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={torchOn}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={result || isProcessing ? undefined : handleBarcodeScanned}
                />

                {/* Marco de lectura */}
                <View style={styles.frameWrap}>
                    <View style={styles.frame}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <Text style={[styles.frameHint, brandFont(600)]}>ApuntÃ¡ al QR del boarding pass</Text>
                </View>

                <TouchableOpacity onPress={() => setTorchOn((v) => !v)} style={styles.torchButton} activeOpacity={0.8}>
                    <Ionicons name={torchOn ? "flash" : "flash-off"} size={20} color={BRAND_COLORS.white} />
                </TouchableOpacity>

                {isProcessing && !result ? (
                    <View style={[styles.overlay, styles.centered]}>
                        <ActivityIndicator size="large" color={BRAND_COLORS.white} />
                        <Text style={[styles.overlayText, brandFont(600)]}>Validando...</Text>
                    </View>
                ) : null}

                {result && visual ? (
                    <TouchableOpacity
                        activeOpacity={0.95}
                        onPress={dismissResult}
                        style={[styles.resultOverlay, { backgroundColor: visual.color }]}
                    >
                        <Ionicons name={visual.icon} size={120} color={BRAND_COLORS.white} />
                        <Text style={[styles.resultTitle, brandFont(800)]}>{visual.title}</Text>
                        {result.passenger ? (
                            <Text style={[styles.resultName, brandFont(700)]} numberOfLines={2}>
                                {result.passenger.fullName}
                            </Text>
                        ) : null}
                        {result.passenger ? (
                            <Text style={[styles.resultDetail, brandFont(500)]}>
                                {result.passenger.documentType} {result.passenger.documentNumber}
                            </Text>
                        ) : null}
                        {result.kind === "already_boarded" && result.passenger.boardedAt ? (
                            <Text style={[styles.resultDetail, brandFont(500)]}>
                                Registrado a las {formatBoardingTime(new Date(result.passenger.boardedAt))} hs
                            </Text>
                        ) : null}
                        {result.kind === "rejected" ? (
                            <Text style={[styles.resultDetail, brandFont(500)]}>{result.message}</Text>
                        ) : null}
                        <View style={styles.resultButton}>
                            <Text style={[styles.resultButtonText, { color: visual.color }, brandFont(700)]}>
                                Escanear siguiente
                            </Text>
                        </View>
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    };

    const renderBody = () => {
        if (isLoading) {
            return (
                <View style={[styles.centered, { paddingVertical: 60 }]}>
                    <ActivityIndicator size="large" color={BRAND_COLORS.azur} />
                </View>
            );
        }
        if (!reservation) {
            return <Text style={[styles.blockedText, brandFont(500)]}>No se encontrÃ³ la reserva.</Text>;
        }
        if (!canScan) {
            return (
                <Text style={[styles.blockedText, brandFont(500)]}>
                    Solo el piloto asignado, el dueÃ±o o la encargada de la aeronave pueden registrar embarques.
                </Text>
            );
        }
        if (canceled || !paid) {
            return (
                <Text style={[styles.blockedText, brandFont(500)]}>
                    {canceled ? "La reserva estÃ¡ cancelada." : "La reserva todavÃ­a no estÃ¡ pagada: no se puede embarcar."}
                </Text>
            );
        }

        const progress = passengers.length > 0 ? boardedCount / passengers.length : 0;
        return (
            <View style={{ gap: 16 }}>
                {renderCamera()}

                <View style={styles.listCard}>
                    <View style={styles.counterRow}>
                        <View>
                            <Text style={[styles.counterLabel, brandFont(700)]}>EMBARQUE</Text>
                            <Text style={[styles.counterValue, brandFont(800)]}>
                                {boardedCount}/{passengers.length} embarcados
                            </Text>
                        </View>
                        {passengers.length > 0 && boardedCount === passengers.length ? (
                            <View style={[styles.pill, { backgroundColor: "#D1FAE5" }]}>
                                <Ionicons name="checkmark-done" size={14} color={SUCCESS} />
                                <Text style={[styles.pillText, { color: SUCCESS }, brandFont(700)]}>Completo</Text>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>

                    {passengers.length === 0 ? (
                        <Text style={[styles.emptyText, brandFont(400)]}>
                            Esta reserva todavÃ­a no tiene manifiesto de pasajeros.
                        </Text>
                    ) : (
                        passengers.map((p, idx) => {
                            const boarded = !!p.boardedAt;
                            return (
                                <View key={p.id || idx} style={styles.paxRow}>
                                    <View style={[styles.paxIcon, boarded ? styles.paxIconBoarded : styles.paxIconPending]}>
                                        <Ionicons
                                            name={boarded ? "checkmark" : "time-outline"}
                                            size={16}
                                            color={boarded ? SUCCESS : BRAND_COLORS.textMuted}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.paxName, brandFont(700)]} numberOfLines={1}>
                                            {p.fullName}
                                        </Text>
                                        <Text style={[styles.paxDoc, brandFont(400)]}>
                                            {p.documentType} {p.documentNumber}
                                        </Text>
                                    </View>
                                    <Text style={[styles.paxStatus, { color: boarded ? SUCCESS : BRAND_COLORS.textMuted }, brandFont(700)]}>
                                        {boarded ? `Embarcado ${formatBoardingTime(new Date(p.boardedAt as string))}` : "Pendiente"}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={20} color={BRAND_COLORS.white} />
                </TouchableOpacity>
                <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={[styles.headerEyebrow, brandFont(700)]}>EMBARQUE</Text>
                    <Text style={[styles.headerTitle, brandFont(700)]} numberOfLines={1}>
                        {reservation
                            ? `${reservation.trip?.origin_airport_ident ?? ""} â†’ ${reservation.trip?.destination_airport_ident ?? ""}`
                            : "Escanear pasajeros"}
                    </Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={BRAND_COLORS.white} />
                }
            >
                {renderBody()}
            </ScrollView>
        </View>
    );
}

const CORNER = 28;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: BRAND_COLORS.navy,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerEyebrow: {
        color: BRAND_COLORS.crystal,
        fontSize: 10,
        letterSpacing: 2,
    },
    headerTitle: {
        color: BRAND_COLORS.white,
        fontSize: 18,
    },
    centered: {
        alignItems: "center",
        justifyContent: "center",
    },
    cameraBox: {
        height: 340,
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: "#000",
    },
    permissionTitle: {
        color: BRAND_COLORS.white,
        fontSize: 16,
        textAlign: "center",
    },
    permissionText: {
        color: BRAND_COLORS.crystal,
        fontSize: 13,
        textAlign: "center",
        lineHeight: 18,
    },
    permissionButton: {
        marginTop: 4,
        height: 48,
        paddingHorizontal: 24,
        borderRadius: BRAND_RADII.button,
        backgroundColor: BRAND_COLORS.azur,
        alignItems: "center",
        justifyContent: "center",
    },
    permissionButtonText: {
        color: BRAND_COLORS.white,
        fontSize: 15,
    },
    frameWrap: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        pointerEvents: "none",
    },
    frame: {
        width: 220,
        height: 220,
    },
    corner: {
        position: "absolute",
        width: CORNER,
        height: CORNER,
        borderColor: BRAND_COLORS.white,
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
    frameHint: {
        color: BRAND_COLORS.white,
        fontSize: 13,
        backgroundColor: "rgba(3,4,54,0.6)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: "hidden",
    },
    torchButton: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(3,4,54,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(3,4,54,0.7)",
        gap: 10,
    },
    overlayText: {
        color: BRAND_COLORS.white,
        fontSize: 14,
    },
    resultOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 4,
    },
    resultTitle: {
        color: BRAND_COLORS.white,
        fontSize: 24,
        textAlign: "center",
    },
    resultName: {
        color: BRAND_COLORS.white,
        fontSize: 20,
        textAlign: "center",
        marginTop: 4,
    },
    resultDetail: {
        color: BRAND_COLORS.white,
        fontSize: 13,
        textAlign: "center",
        opacity: 0.9,
    },
    resultButton: {
        marginTop: 14,
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.button,
        paddingHorizontal: 22,
        paddingVertical: 12,
    },
    resultButtonText: {
        fontSize: 14,
    },
    blockedText: {
        color: BRAND_COLORS.white,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        paddingVertical: 40,
        paddingHorizontal: 12,
    },
    listCard: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        padding: 16,
        gap: 12,
    },
    counterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    counterLabel: {
        color: BRAND_COLORS.azur,
        fontSize: 10,
        letterSpacing: 1.5,
    },
    counterValue: {
        color: BRAND_COLORS.navy,
        fontSize: 22,
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    pillText: {
        fontSize: 12,
    },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: BRAND_COLORS.surfaceTint,
        overflow: "hidden",
    },
    progressFill: {
        height: 8,
        borderRadius: 4,
        backgroundColor: SUCCESS,
    },
    emptyText: {
        color: BRAND_COLORS.textMuted,
        fontSize: 13,
        textAlign: "center",
        paddingVertical: 8,
    },
    paxRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: BRAND_COLORS.border,
    },
    paxIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    paxIconBoarded: {
        backgroundColor: "#D1FAE5",
    },
    paxIconPending: {
        backgroundColor: BRAND_COLORS.backgroundAlt,
    },
    paxName: {
        color: BRAND_COLORS.navy,
        fontSize: 14,
    },
    paxDoc: {
        color: BRAND_COLORS.textMuted,
        fontSize: 12,
    },
    paxStatus: {
        fontSize: 12,
    },
});
