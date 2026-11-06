import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
    BANCARD_CONFIG,
    BANCARD_TEST_CARDS,
    confirmBancardPayment,
    getBancardBaseUrl,
    getBancardIframeHtml,
    initiateSingleBuy,
} from "@/services/bancard";
import { ClientReservationItem } from "@/types/all-roles";
import { BancardSingleBuyResult, BancardTestCard } from "@/types/bancard";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";

interface BancardPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    reservation: ClientReservationItem | null;
    onPaymentSuccess: (data: {
        transactionId: string;
        authorizationCode: string;
        cardBrand?: string;
        cardLast4?: string;
    }) => Promise<void>;
}

export function BancardPaymentModal({
    visible,
    onClose,
    reservation,
    onPaymentSuccess,
}: BancardPaymentModalProps) {
    const insets = useSafeAreaInsets();
    const webViewRef = useRef<WebView>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [buy, setBuy] = useState<BancardSingleBuyResult | null>(null);
    const shopProcessId = buy?.shopProcessId ?? 0;
    const isStaging = (buy?.environment ?? "staging") === "staging";
    const returnUrl = buy?.returnUrl ?? "checkout/finish";
    const cancelUrl = buy?.cancelUrl ?? "checkout/cancel";
    const [selectedCard, setSelectedCard] = useState<BancardTestCard>(BANCARD_TEST_CARDS[0]);
    const [copiedCard, setCopiedCard] = useState<string | null>(null);
    const [autofillSuccess, setAutofillSuccess] = useState<boolean>(false);

    const priceUsd = reservation?.price || 0;
    // Monto real calculado por el servidor; mientras tanto, referencia con el cambio del día.
    const { data: exchangeRate } = useExchangeRate();
    const amountPyg = buy?.amountPyg ?? Math.round(priceUsd * (exchangeRate?.dolar ?? 0));
    const formattedGs = amountPyg.toLocaleString("es-PY");
    const originIdent =
        reservation?.originAirport?.iata_code ||
        reservation?.originAirport?.ident ||
        reservation?.trip?.origin_airport_ident ||
        "SGAS";
    const destIdent =
        reservation?.destinationAirport?.iata_code ||
        reservation?.destinationAirport?.ident ||
        reservation?.trip?.destination_airport_ident ||
        "SGCO";
    const routeText = `${originIdent} ➔ ${destIdent}`;
    const aircraftModel = reservation?.aircraftSpecs?.basic_specs?.model || "Aeronave Chárter";

    const fetchSingleBuyProcess = async () => {
        if (!reservation) return;

        setIsInitializing(true);
        setInitError(null);
        setBuy(null);

        try {
            // El servidor calcula el monto desde la reserva en Firestore.
            const result = await initiateSingleBuy(reservation.id);
            setBuy(result);
        } catch (err: any) {
            setInitError(err?.message || "Error al conectar con la pasarela de Bancard");
        } finally {
            setIsInitializing(false);
        }
    };

    // Inicializar single_buy con Bancard cada vez que se abre el modal
    useEffect(() => {
        if (!visible || !reservation) return;
        fetchSingleBuyProcess();
    }, [visible, reservation?.id]);

    /**
     * Inyecta la precarga de la tarjeta directamente en los inputs de Bancard
     */
    const executeAutofill = (card: BancardTestCard) => {
        const cleanCvv = card.cvv === "000" || card.cvv === "N/D" ? "" : card.cvv;
        const script = `
            (function() {
                try {
                    if (typeof window.autofillBancard === 'function') {
                        return window.autofillBancard('${card.cardNumber}', '${card.expiration}', '${cleanCvv}');
                    }
                } catch(e) {}
                return { success: false };
            })();
            true;
        `;
        webViewRef.current?.injectJavaScript(script);
    };

    /**
     * Selecciona una tarjeta de prueba y dispara la precarga automática en Bancard
     */
    const handleSelectAndAutofillCard = async (card: BancardTestCard) => {
        setSelectedCard(card);
        setCopiedCard(card.brand);

        // 1. Copiar al portapapeles siempre por practicidad
        await Clipboard.setStringAsync(card.cardNumber);

        // 2. Disparar autocompletado en el formulario Bancard
        executeAutofill(card);

        // Reintentos automáticos a 400ms y 1200ms por si el inputmask de Bancard está procesando
        setTimeout(() => executeAutofill(card), 400);
        setTimeout(() => executeAutofill(card), 1100);

        Toast.show({
            type: "success",
            text1: `Tarjeta ${card.brand} Precargada`,
            text2: `Campos completados en Bancard (copiada al portapapeles)`,
            visibilityTime: 2500,
        });

        setTimeout(() => setCopiedCard(null), 3000);
    };

    /**
     * Al volver del checkout de Bancard verificamos el pago en el servidor
     * (get_confirmation). Solo si Bancard lo aprobó se continúa con el flujo.
     * La confirmación puede demorar unos segundos: se reintenta brevemente.
     */
    const handlePaymentComplete = async () => {
        if (isProcessing || !reservation) return;
        setIsProcessing(true);

        try {
            let result = await confirmBancardPayment(reservation.id);
            for (let attempt = 0; result.status === "pending" && attempt < 4; attempt++) {
                await new Promise((r) => setTimeout(r, 2500));
                result = await confirmBancardPayment(reservation.id);
            }

            if (result.status === "approved") {
                await onPaymentSuccess({
                    transactionId: result.ticketNumber || String(shopProcessId),
                    authorizationCode: result.authorizationNumber || "",
                });
            } else if (result.status === "declined") {
                Alert.alert(
                    "Pago rechazado",
                    result.responseDescription || "Bancard no aprobó la transacción. Podés intentar con otra tarjeta."
                );
                fetchSingleBuyProcess();
            } else {
                Alert.alert(
                    "Pago en verificación",
                    "Todavía no recibimos la confirmación de Bancard. Si completaste el pago, se reflejará en unos minutos."
                );
                onClose();
            }
        } catch (err: any) {
            Alert.alert("Error", err?.message || "No se pudo verificar el pago con Bancard.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Escuchar mensajes del iFrame o de la ventana
    const handleMessage = async (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "payment_success") {
                await handlePaymentComplete();
            } else if (data.type === "close") {
                onClose();
            } else if (data.type === "iframe_loaded") {
                // Al terminar de cargar el formulario de Bancard, precargamos la tarjeta seleccionada
                executeAutofill(selectedCard);
                setTimeout(() => executeAutofill(selectedCard), 600);
            } else if (data.type === "autofill_success") {
                setAutofillSuccess(true);
                setTimeout(() => setAutofillSuccess(false), 3000);
            }
        } catch (e) {
            // No es un JSON relevante
        }
    };

    // Interceptar redirecciones de Bancard a return_url o cancel_url
    const handleNavigationStateChange = (navState: any) => {
        const url = navState.url || "";

        if (url.includes(returnUrl)) {
            handlePaymentComplete();
        } else if (url.includes(cancelUrl)) {
            onClose();
        }
    };

    const iframeHtml = buy ? getBancardIframeHtml(buy.processId, buy.environment) : "";

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top || 12 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTitleContainer}>
                        <View style={styles.titleRow}>
                            <Text style={styles.headerTitle}>bancard</Text>
                            <Text style={styles.headerTitleVpos}>vPOS 2.0</Text>
                            {isStaging && (
                                <View style={styles.stagingBadge}>
                                    <Text style={styles.stagingBadgeText}>STAGING</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.headerSubtitle}>
                            {BANCARD_CONFIG.commerceName} • Pago Chárter
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        disabled={isProcessing}
                        style={styles.closeBtn}
                    >
                        <Ionicons name="close" size={20} color="#030436" />
                    </TouchableOpacity>
                </View>

                {/* Resumen de vuelo a pagar */}
                <View style={styles.summaryBar}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.summaryRoute}>
                            {routeText} • {aircraftModel}
                        </Text>
                        <Text style={styles.summarySub}>
                            {shopProcessId ? `Proceso: #${shopProcessId}` : "Preparando pago..."}
                        </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.summaryAmount}>
                            USD ${priceUsd.toLocaleString("en-US")}
                        </Text>
                        <Text style={styles.summaryAmountGs}>
                            ≈ Gs. {formattedGs}
                        </Text>
                    </View>
                </View>

                {/* Barra de precarga de tarjetas de prueba (solo staging) */}
                {isStaging && (
                <View style={styles.testCardsBar}>
                    <View style={styles.testCardsBarHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <MaterialCommunityIcons name="lightning-bolt" size={15} color="#0165FF" />
                            <Text style={styles.testCardsTitle}>
                                Tarjetas de Prueba (Toca para precargar en Bancard):
                            </Text>
                        </View>
                        {autofillSuccess && (
                            <View style={styles.autofillBadge}>
                                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                                <Text style={styles.autofillBadgeText}>¡Campos llenados!</Text>
                            </View>
                        )}
                    </View>

                    {/* Chips de selección de tarjeta */}
                    <View style={styles.testCardsRow}>
                        {BANCARD_TEST_CARDS.map((card) => {
                            const isSelected = selectedCard.brand === card.brand;
                            return (
                                <TouchableOpacity
                                    key={card.brand}
                                    onPress={() => handleSelectAndAutofillCard(card)}
                                    style={[
                                        styles.testCardChip,
                                        isSelected ? styles.testCardChipSelected : styles.testCardChipNormal,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={isSelected ? "flash" : "card-outline"}
                                        size={13}
                                        color={isSelected ? "#00529B" : "#64748B"}
                                    />
                                    <Text
                                        style={[
                                            styles.testCardChipText,
                                            isSelected ? styles.testCardChipTextSelected : styles.testCardChipTextNormal,
                                        ]}
                                    >
                                        {card.brand}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Fila de detalles de la tarjeta activa y acciones */}
                    <View style={styles.cardDetailsBox}>
                        <View style={styles.cardDetailsRow}>
                            <View style={styles.cardDetailCol}>
                                <Text style={styles.cardDetailLabel}>NÚMERO</Text>
                                <Text style={styles.cardDetailVal}>{selectedCard.formattedNumber}</Text>
                            </View>
                            <View style={styles.cardDetailColSmall}>
                                <Text style={styles.cardDetailLabel}>EXP</Text>
                                <Text style={styles.cardDetailVal}>{selectedCard.expiration}</Text>
                            </View>
                            <View style={styles.cardDetailColSmall}>
                                <Text style={styles.cardDetailLabel}>CVV</Text>
                                <Text style={styles.cardDetailVal}>{selectedCard.cvv}</Text>
                            </View>
                        </View>

                        <View style={styles.cardActionsRow}>
                            <TouchableOpacity
                                onPress={() => handleSelectAndAutofillCard(selectedCard)}
                                style={styles.autofillBtn}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="lightning-bolt" size={14} color="#FFFFFF" />
                                <Text style={styles.autofillBtnText}>Autocompletar Formulario</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={async () => {
                                    await Clipboard.setStringAsync(selectedCard.cardNumber);
                                    Toast.show({
                                        type: "info",
                                        text1: "Número Copiado",
                                        text2: selectedCard.cardNumber,
                                        visibilityTime: 2000,
                                    });
                                }}
                                style={styles.copyBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="copy-outline" size={13} color="#00529B" />
                                <Text style={styles.copyBtnText}>Copiar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                )}

                {/* Contenido principal: WebView con iFrame oficial o pantalla diagnóstica */}
                <View style={styles.webContainer}>
                    {isInitializing ? (
                        <View style={styles.stateContainer}>
                            <ActivityIndicator size="large" color="#00529B" />
                            <Text style={styles.stateTitle}>Iniciando compra en Bancard vPOS...</Text>
                            <Text style={styles.stateSubtitle}>
                                Generando identificador de proceso (process_id)
                            </Text>
                        </View>
                    ) : initError ? (
                        <View style={styles.errorContainer}>
                            <View style={styles.errorIconWrapper}>
                                <Ionicons name="alert-circle" size={32} color="#DC2626" />
                            </View>
                            <Text style={styles.errorTitle}>No se pudo iniciar el pago</Text>
                            <Text style={styles.errorMessage}>{initError}</Text>

                            <View style={styles.errorHelpBox}>
                                <Text style={styles.errorHelpTitle}>¿Por qué ocurre esto?</Text>
                                <Text style={styles.errorHelpText}>
                                    En el portal de comercios de Bancard para **ALTAGO**, la Clave Pública y Privada deben estar ingresadas y validadas en el menú **"Claves"**.
                                    Bancard rechaza la petición hasta que se configuren las credenciales oficiales en su servidor.
                                </Text>
                            </View>

                            <View style={styles.errorButtonsRow}>
                                <TouchableOpacity
                                    onPress={fetchSingleBuyProcess}
                                    style={styles.retryBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="refresh" size={16} color="#FFFFFF" />
                                    <Text style={styles.retryBtnText}>Reintentar iFrame Oficial</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <WebView
                            ref={webViewRef}
                            originWhitelist={["*"]}
                            source={{
                                html: iframeHtml,
                                baseUrl: getBancardBaseUrl(buy?.environment ?? "staging"), // Obligatorio según Pág. 77 del manual
                            }}
                            onMessage={handleMessage}
                            onNavigationStateChange={handleNavigationStateChange}
                            onLoadEnd={() => {
                                // Al cargar la página principal del webview, ejecutar la precarga de respaldo
                                setTimeout(() => executeAutofill(selectedCard), 1000);
                            }}
                            onShouldStartLoadWithRequest={(request) => {
                                if (request.url.includes(returnUrl)) {
                                    handlePaymentComplete();
                                    return false;
                                }
                                if (request.url.includes(cancelUrl)) {
                                    onClose();
                                    return false;
                                }
                                return true;
                            }}
                            style={{ flex: 1 }}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            sharedCookiesEnabled={true}
                            thirdPartyCookiesEnabled={true}
                        />
                    )}
                </View>

                {/* Processing Overlay */}
                {isProcessing && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#0165FF" />
                        <Text style={styles.loadingTitle}>Confirmando Pago con Bancard...</Text>
                        <Text style={styles.loadingSubtitle}>
                            Generando Factura Electrónica e-Kuatia (SIFEN DNIT)
                        </Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    headerTitleContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#00529B",
    },
    headerTitleVpos: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0165FF",
    },
    stagingBadge: {
        backgroundColor: "#FEF3C7",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#FDE68A",
        marginLeft: 4,
    },
    stagingBadgeText: {
        fontSize: 9,
        fontWeight: "bold",
        color: "#92400E",
    },
    headerSubtitle: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    closeBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: "#F1F5F9",
    },
    summaryBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    summaryRoute: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#030436",
    },
    summarySub: {
        fontSize: 10,
        color: "#64748B",
        marginTop: 1,
    },
    summaryAmount: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#00529B",
    },
    summaryAmountGs: {
        fontSize: 10,
        color: "#64748B",
    },
    testCardsBar: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    testCardsBarHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    testCardsTitle: {
        fontSize: 11,
        fontWeight: "600",
        color: "#475569",
    },
    autofillBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: "#ECFDF5",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    autofillBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#059669",
    },
    testCardsRow: {
        flexDirection: "row",
        gap: 6,
        marginBottom: 8,
    },
    testCardChip: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 7,
        paddingHorizontal: 4,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    testCardChipNormal: {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
    },
    testCardChipSelected: {
        backgroundColor: "#EFF6FF",
        borderColor: "#00529B",
    },
    testCardChipText: {
        fontSize: 11,
        fontWeight: "700",
    },
    testCardChipTextNormal: {
        color: "#64748B",
    },
    testCardChipTextSelected: {
        color: "#00529B",
    },
    cardDetailsBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        gap: 6,
    },
    cardDetailsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    cardDetailCol: {
        flex: 2,
    },
    cardDetailColSmall: {
        flex: 1,
        alignItems: "center",
    },
    cardDetailLabel: {
        fontSize: 9,
        fontWeight: "700",
        color: "#94A3B8",
        letterSpacing: 0.5,
    },
    cardDetailVal: {
        fontSize: 12,
        fontWeight: "700",
        color: "#030436",
    },
    cardActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
    },
    autofillBtn: {
        flex: 2,
        backgroundColor: "#00529B",
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    autofillBtnText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
    },
    copyBtn: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#BFDBFE",
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    copyBtnText: {
        color: "#00529B",
        fontSize: 11,
        fontWeight: "700",
    },
    webContainer: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    stateContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
    },
    stateTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#030436",
    },
    stateSubtitle: {
        fontSize: 12,
        color: "#64748B",
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    errorIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#FEE2E2",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#030436",
        marginBottom: 6,
    },
    errorMessage: {
        fontSize: 12,
        color: "#DC2626",
        textAlign: "center",
        backgroundColor: "#FEF2F2",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FECACA",
        marginBottom: 16,
    },
    errorHelpBox: {
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 20,
        width: "100%",
    },
    errorHelpTitle: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#030436",
        marginBottom: 4,
    },
    errorHelpText: {
        fontSize: 11,
        color: "#64748B",
        lineHeight: 16,
    },
    errorButtonsRow: {
        width: "100%",
        gap: 10,
    },
    retryBtn: {
        backgroundColor: "#00529B",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    retryBtnText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "bold",
    },
    mockBtn: {
        backgroundColor: "#EFF6FF",
        borderWidth: 1,
        borderColor: "#BFDBFE",
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    mockBtnText: {
        color: "#00529B",
        fontSize: 12,
        fontWeight: "700",
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(3, 4, 54, 0.85)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 999,
        gap: 10,
    },
    loadingTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
    },
    loadingSubtitle: {
        color: "#0165FF",
        fontSize: 12,
        fontWeight: "500",
        textAlign: "center",
    },
});
