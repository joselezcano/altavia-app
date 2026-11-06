/**
 * Editar reserva (owner, encargada y admin).
 *  - Sin pagar: ruta, fechas y horas, ida/vuelta, pasajeros y precio (con la cotización por hora).
 *  - Pagada: solo reprogramar fechas y horas; el precio queda fijo.
 * Los bloqueos de calendario se recrean en useEditReservation. La fila de GIO la sincroniza el servidor.
 */
import AirportPicker from "@/components/airport-picker";
import { CustomDatePicker } from "@/components/custom-date-picker";
import { LoadingCard } from "@/components/loading-card";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { AircraftSpecsDoc } from "@/hooks/useOwnerAircrafts";
import { useEditReservation } from "@/hooks/useReservationEditing";
import { useReservationDetails } from "@/hooks/useReservationDetails";
import { Airport, ClientReservationItem } from "@/types/all-roles";
import { getDistanceBetweenAirports } from "@/utils/flight-distance";
import { computeFlightQuote, DEFAULT_CRUISE_SPEED_KNOTS } from "@/utils/flight-pricing";
import { isReservationPaid } from "@/utils/paid-reservation";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const BRAND_BLUE = "#0f1e3d";
const BRAND_GOLD = "#C5A059";
const HOUR_MS = 3600 * 1000;

export default function EditReservationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { role, profileData } = useAuth();
    const params = useLocalSearchParams<{ reservationId: string }>();

    const { data: reservation, isLoading: isLoadingReservation } = useReservationDetails(params.reservationId);
    const { data: aircraft, isLoading: isLoadingAircraft } = useAircraftDetails(reservation?.aircraftId);

    const canManage = role === "ADMIN" || role === "OWNER" || (role === "PILOT" && profileData?.isEncargado === true);
    const isLoading = isLoadingReservation || (!!reservation?.aircraftId && isLoadingAircraft);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.screen}
        >
            <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
                {/* Cabecera */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backCircle} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={20} color={BRAND_BLUE} />
                    </TouchableOpacity>
                    <View style={{ alignItems: "center" }}>
                        <Text style={styles.headerEyebrow}>Gestión de Reserva</Text>
                        <Text style={styles.headerTitle}>Editar Reserva</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {isLoading ? (
                    <LoadingCard message="Cargando la reserva..." />
                ) : !reservation ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Reserva no encontrada</Text>
                        <Text style={styles.cardSubtitle}>No fue posible recuperar la reserva seleccionada.</Text>
                    </View>
                ) : !canManage ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Sin permisos</Text>
                        <Text style={styles.cardSubtitle}>
                            Solo el propietario de la aeronave, su encargada o el administrador pueden editar la reserva.
                        </Text>
                    </View>
                ) : (
                    <EditReservationForm
                        key={reservation.id}
                        reservation={reservation}
                        aircraft={aircraft ?? null}
                        onSaved={() => router.back()}
                    />
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

type PriceMode = "current" | "suggested" | "manual";

function EditReservationForm({
    reservation,
    aircraft,
    onSaved,
}: {
    reservation: ClientReservationItem;
    aircraft: AircraftSpecsDoc | null;
    onSaved: () => void;
}) {
    const editReservation = useEditReservation();
    const { data: exchangeRate } = useExchangeRate();
    const isPaid = isReservationPaid(reservation);

    // Valores iniciales tomados de la reserva (el formulario se monta con la reserva ya cargada).
    const [origin, setOrigin] = useState<Airport | undefined>(reservation.originAirport);
    const [destination, setDestination] = useState<Airport | undefined>(reservation.destinationAirport);
    const [roundtrip, setRoundtrip] = useState<boolean>(reservation.schedule.roundtrip);
    const [departureDate, setDepartureDate] = useState<Date | null>(reservation.schedule.outbound_flight_departure_time);
    const [returnDate, setReturnDate] = useState<Date | null>(reservation.schedule.return_flight_departure_time);
    const [passengers, setPassengers] = useState<number>(reservation.capacity?.passangers || 1);
    const [hangarInput, setHangarInput] = useState<string>(
        reservation.hangar_per_night_usd !== undefined && reservation.hangar_per_night_usd !== null
            ? String(reservation.hangar_per_night_usd)
            : ""
    );
    const [priceMode, setPriceMode] = useState<PriceMode>("current");
    const [manualPrice, setManualPrice] = useState<string>(String(reservation.price ?? 0));

    // Si cambia algo que mueve la cotización, el precio pasa a seguir al sugerido (salvo que lo hayan escrito a mano).
    const touchQuote = () => setPriceMode((m) => (m === "manual" ? m : "suggested"));

    const cruiseSpeed =
        aircraft?.operating_specs?.cruise_speed_knots || reservation.cruise_speed_knots || DEFAULT_CRUISE_SPEED_KNOTS;
    const maxPax = aircraft?.basic_specs?.pax_count || 8;
    const manifestCount = reservation.passengers?.length || 0;

    const distanceNm = useMemo(
        () => Math.round(getDistanceBetweenAirports(origin, destination, "nm")),
        [origin, destination]
    );

    const quote = useMemo(
        () =>
            computeFlightQuote({
                origin,
                destination,
                base: aircraft?.base_airport,
                roundtrip,
                outboundDeparture: departureDate,
                returnDeparture: roundtrip ? returnDate : null,
                cruiseSpeedKnots: cruiseSpeed,
                pricing: aircraft?.pricing,
                hangarPerNightOverrideUsd: hangarInput.trim() === "" ? null : parseFloat(hangarInput) || 0,
            }),
        [origin, destination, aircraft, roundtrip, departureDate, returnDate, cruiseSpeed, hangarInput]
    );

    const suggestedPrice = quote.hasPricing && quote.totalUsd > 0 ? quote.totalUsd : reservation.price;
    const priceText =
        priceMode === "current" ? String(reservation.price) : priceMode === "suggested" ? String(suggestedPrice) : manualPrice;
    const priceNumber = parseFloat(priceText) || 0;
    const exchangeRateValue = exchangeRate?.dolar && exchangeRate.dolar > 0 ? exchangeRate.dolar : 0;

    const originalOutboundMs =
        reservation.schedule.outbound_flight_arrival_time.getTime() -
        reservation.schedule.outbound_flight_departure_time.getTime();
    const originalReturnMs =
        reservation.schedule.return_flight_arrival_time && reservation.schedule.return_flight_departure_time
            ? reservation.schedule.return_flight_arrival_time.getTime() -
              reservation.schedule.return_flight_departure_time.getTime()
            : 0;

    const handleSave = async () => {
        if (!departureDate) {
            Alert.alert("Fecha requerida", "Indicá la fecha y hora de salida.");
            return;
        }
        if (roundtrip && !returnDate) {
            Alert.alert("Fecha de retorno", "Es un vuelo de ida y vuelta: indicá la fecha y hora de retorno.");
            return;
        }
        if (roundtrip && returnDate && returnDate <= departureDate) {
            Alert.alert("Fecha inválida", "El retorno debe ser posterior a la salida.");
            return;
        }
        if (!isPaid) {
            if (!origin || !destination) {
                Alert.alert("Ruta incompleta", "Seleccioná el aeropuerto de origen y el de destino.");
                return;
            }
            if (origin.ident === destination.ident) {
                Alert.alert("Ruta inválida", "El origen y el destino no pueden ser el mismo aeropuerto.");
                return;
            }
            if (passengers < manifestCount) {
                Alert.alert(
                    "Pasajeros",
                    `El manifiesto ya tiene ${manifestCount} pasajero(s). Quitá pasajeros del manifiesto antes de bajar la cantidad.`
                );
                return;
            }
            if (priceNumber <= 0) {
                Alert.alert("Precio inválido", "Ingresá un precio mayor a 0.");
                return;
            }
        }

        // Duración de cada tramo: pagada conserva la original; sin pagar se estima como en new-booking.
        const estimatedLegMs = (distanceNm > 0 ? distanceNm / cruiseSpeed : 1) * HOUR_MS;
        const outboundMs = isPaid && originalOutboundMs > 0 ? originalOutboundMs : estimatedLegMs;
        const returnMs = isPaid && originalReturnMs > 0 ? originalReturnMs : estimatedLegMs;

        const outboundStart = new Date(departureDate);
        const outboundEnd = new Date(outboundStart.getTime() + outboundMs);
        const returnStart = roundtrip && returnDate ? new Date(returnDate) : null;
        const returnEnd = returnStart ? new Date(returnStart.getTime() + returnMs) : null;

        try {
            await editReservation.mutateAsync({
                reservation,
                isPaid,
                roundtrip,
                outboundStart,
                outboundEnd,
                returnStart,
                returnEnd,
                ...(isPaid
                    ? {}
                    : {
                          origin,
                          destination,
                          distanceNm,
                          cruiseSpeedKnots: cruiseSpeed,
                          passengers,
                          price: priceNumber,
                          quote,
                      }),
            });
            Toast.show({
                type: "success",
                text1: "Reserva actualizada",
                text2: isPaid ? "Se reprogramaron las fechas del vuelo." : "Se guardaron los cambios de la reserva.",
            });
            // Si ya se había enviado el link de pago, ahora cobra el precio nuevo: conviene avisar al cliente.
            const priceChanged = !isPaid && Math.round(priceNumber) !== Math.round(Number(reservation.price) || 0);
            if (priceChanged && reservation.internal_status === "awaiting_payment") {
                Alert.alert(
                    "Precio actualizado",
                    `El link de pago va a cobrar el precio nuevo (USD ${Math.round(priceNumber).toLocaleString("es-PY")}). ` +
                        "Si ya se lo enviaste al cliente, reenviáselo por WhatsApp para que vea el monto correcto."
                );
            }
            onSaved();
        } catch (error: any) {
            Alert.alert("No se pudo guardar", error?.message || "Intentá nuevamente.");
        }
    };

    const isSaving = editReservation.isPending;

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            {isPaid && (
                <View style={styles.infoBox}>
                    <Ionicons name="lock-closed-outline" size={16} color="#92400e" />
                    <Text style={styles.infoBoxText}>
                        Reserva pagada: solo se pueden reprogramar las fechas y horas. La ruta, los pasajeros y el precio
                        (USD {reservation.price.toLocaleString("en-US")}) quedan fijos.
                    </Text>
                </View>
            )}

            {/* Ruta */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Ruta</Text>
                {aircraft && (
                    <Text style={styles.cardSubtitle}>
                        {aircraft.basic_specs?.model} ({aircraft.basic_specs?.registration}) • Crucero: {cruiseSpeed} kts
                    </Text>
                )}

                {isPaid ? (
                    <View style={{ marginTop: 10, gap: 6 }}>
                        <Text style={styles.readOnlyText}>
                            Origen: {reservation.originAirport?.name || reservation.trip.origin_airport_ident}
                        </Text>
                        <Text style={styles.readOnlyText}>
                            Destino: {reservation.destinationAirport?.name || reservation.trip.destination_airport_ident}
                        </Text>
                        <Text style={styles.readOnlyText}>{roundtrip ? "Ida y vuelta" : "Solo ida"}</Text>
                    </View>
                ) : (
                    <>
                        <View style={{ marginTop: 10 }}>
                            <Text style={styles.inputLabel}>Aeropuerto de Origen</Text>
                            <AirportPicker
                                value={origin}
                                onChange={(airport) => {
                                    setOrigin(airport || undefined);
                                    touchQuote();
                                }}
                            />
                        </View>
                        <View style={{ marginTop: 10 }}>
                            <Text style={styles.inputLabel}>Aeropuerto de Destino</Text>
                            <AirportPicker
                                value={destination}
                                onChange={(airport) => {
                                    setDestination(airport || undefined);
                                    touchQuote();
                                }}
                            />
                        </View>
                        {distanceNm > 0 && (
                            <Text style={styles.helperText}>
                                Distancia: {distanceNm} NM ({Math.round(distanceNm * 1.852)} km)
                            </Text>
                        )}
                        <View style={styles.switchRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Vuelo de Ida y Vuelta</Text>
                                <Text style={styles.helperText}>Habilita la fecha de retorno</Text>
                            </View>
                            <Switch
                                value={roundtrip}
                                onValueChange={(v) => {
                                    setRoundtrip(v);
                                    touchQuote();
                                }}
                                trackColor={{ false: "#CBD5E1", true: BRAND_BLUE }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </>
                )}
            </View>

            {/* Fechas */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Fechas y Horas</Text>
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>Salida (Ida)</Text>
                    <CustomDatePicker
                        value={departureDate}
                        onChange={(date) => {
                            setDepartureDate(date || null);
                            touchQuote();
                        }}
                        placeholder="Seleccionar salida..."
                    />
                </View>
                {roundtrip && (
                    <View style={{ marginTop: 10 }}>
                        <Text style={styles.inputLabel}>Retorno (Vuelta)</Text>
                        <CustomDatePicker
                            value={returnDate}
                            onChange={(date) => {
                                setReturnDate(date || null);
                                touchQuote();
                            }}
                            placeholder="Seleccionar retorno..."
                        />
                    </View>
                )}
            </View>

            {/* Pasajeros */}
            {!isPaid && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Pasajeros</Text>
                    <View style={styles.paxCounterRow}>
                        <TouchableOpacity
                            onPress={() => setPassengers((p) => Math.max(1, p - 1))}
                            style={styles.paxButton}
                        >
                            <Ionicons name="remove" size={18} color={BRAND_BLUE} />
                        </TouchableOpacity>
                        <Text style={styles.paxCountValue}>{passengers} pasajero(s)</Text>
                        <TouchableOpacity
                            onPress={() => setPassengers((p) => Math.min(maxPax, p + 1))}
                            style={styles.paxButton}
                        >
                            <Ionicons name="add" size={18} color={BRAND_BLUE} />
                        </TouchableOpacity>
                    </View>
                    {manifestCount > 0 && (
                        <Text style={styles.helperText}>Manifiesto cargado: {manifestCount} pasajero(s).</Text>
                    )}
                </View>
            )}

            {/* Cotización y precio */}
            {!isPaid && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Cotización</Text>
                    <View style={styles.quoteBox}>
                        {quote.legs.map((leg, idx) => (
                            <View key={`${leg.from}-${leg.to}-${idx}`} style={styles.quoteRow}>
                                <Text style={styles.quoteLabel}>
                                    {leg.from} → {leg.to}
                                    {leg.kind === "positioning"
                                        ? " (posicionamiento)"
                                        : leg.kind === "return_empty"
                                          ? " (regreso vacío)"
                                          : ""}
                                </Text>
                                <Text style={styles.quoteValue}>{leg.hours.toFixed(1)} h</Text>
                            </View>
                        ))}
                        <View style={styles.quoteRow}>
                            <Text style={styles.quoteLabel}>
                                {quote.billableHours} h × tarifa por hora (IVA incl.):
                            </Text>
                            <Text style={styles.quoteValue}>
                                {quote.hasPricing ? `USD ${quote.pricePerHourUsd.toLocaleString("en-US")}` : "Sin tarifa cargada"}
                            </Text>
                        </View>
                        {quote.nights > 0 && (
                            <>
                                <View style={styles.quoteRow}>
                                    <Text style={styles.quoteLabel}>
                                        {quote.nights} {quote.nights === 1 ? "noche" : "noches"} × (pernocte USD {quote.overnightFeeUsd} + hangaraje):
                                    </Text>
                                    <Text style={styles.quoteValue}>USD {quote.overnightTotalUsd.toLocaleString("en-US")}</Text>
                                </View>
                                <View style={styles.quoteRow}>
                                    <Text style={styles.quoteLabel}>Hangaraje por noche (USD):</Text>
                                    <TextInput
                                        value={hangarInput}
                                        onChangeText={(val) => {
                                            setHangarInput(val.replace(/[^0-9.]/g, ""));
                                            touchQuote();
                                        }}
                                        placeholder={String(aircraft?.pricing?.hangarPerNightUsd ?? 0)}
                                        keyboardType="numeric"
                                        style={styles.hangarInput}
                                    />
                                </View>
                            </>
                        )}
                        {!quote.hasPricing && (
                            <Text style={[styles.quoteLabel, { marginTop: 6, color: "#B45309" }]}>
                                Esta aeronave no tiene tarifa por hora. Cargala en Contable → Ajustes o escribí el precio a mano.
                            </Text>
                        )}
                        <View style={styles.divider} />
                        <View style={styles.quoteRow}>
                            <Text style={styles.suggestedTitle}>Precio sugerido:</Text>
                            <Text style={styles.suggestedValue}>USD {quote.totalUsd.toLocaleString("en-US")}</Text>
                        </View>
                        <View style={styles.quoteRow}>
                            <Text style={styles.quoteLabel}>Precio actual de la reserva:</Text>
                            <Text style={styles.quoteValue}>USD {reservation.price.toLocaleString("en-US")}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 14 }}>
                        <View style={styles.priceLabelRow}>
                            <Text style={styles.inputLabel}>Precio Final (USD)</Text>
                            <View style={{ flexDirection: "row", gap: 12 }}>
                                {priceMode !== "suggested" && quote.hasPricing && (
                                    <TouchableOpacity onPress={() => setPriceMode("suggested")}>
                                        <Text style={styles.linkText}>Usar sugerido</Text>
                                    </TouchableOpacity>
                                )}
                                {priceMode !== "current" && (
                                    <TouchableOpacity onPress={() => setPriceMode("current")}>
                                        <Text style={styles.linkText}>Mantener actual</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <View style={styles.priceInputWrapper}>
                            <Text style={styles.priceCurrencySymbol}>$</Text>
                            <TextInput
                                value={priceText}
                                onChangeText={(val) => {
                                    setPriceMode("manual");
                                    setManualPrice(val.replace(/[^0-9.]/g, ""));
                                }}
                                placeholder="0"
                                keyboardType="numeric"
                                style={styles.priceTextInput}
                            />
                            <Text style={styles.priceCurrencyBadge}>USD</Text>
                        </View>
                        {priceNumber > 0 && exchangeRateValue > 0 && (
                            <Text style={styles.pygText}>
                                Equivalente: ₲ {Math.round(priceNumber * exchangeRateValue).toLocaleString("es-PY")} (T.C.{" "}
                                {exchangeRateValue.toLocaleString("es-PY")})
                            </Text>
                        )}
                    </View>
                </View>
            )}

            <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : null]}
                activeOpacity={0.8}
            >
                {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>{isPaid ? "Reprogramar Vuelo" : "Guardar Cambios"}</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    container: {
        flex: 1,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    backCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    headerEyebrow: {
        fontSize: 10,
        color: BRAND_GOLD,
        fontWeight: "bold",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: BRAND_BLUE,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: BRAND_BLUE,
    },
    cardSubtitle: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    infoBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: "#FFFBEB",
        borderWidth: 1,
        borderColor: "#FDE68A",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    infoBoxText: {
        flex: 1,
        fontSize: 12,
        color: "#92400e",
        lineHeight: 17,
    },
    readOnlyText: {
        fontSize: 13,
        color: "#334155",
        fontWeight: "600",
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: "bold",
        color: BRAND_BLUE,
        marginBottom: 4,
    },
    helperText: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 4,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 12,
        marginTop: 12,
        borderTopWidth: 1,
        borderColor: "#F1F5F9",
    },
    paxCounterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        padding: 6,
        marginTop: 10,
    },
    paxButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },
    paxCountValue: {
        fontSize: 14,
        fontWeight: "bold",
        color: BRAND_BLUE,
    },
    quoteBox: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
        gap: 4,
    },
    quoteRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
    },
    quoteLabel: {
        flex: 1,
        fontSize: 12,
        color: "#64748B",
    },
    quoteValue: {
        fontSize: 12,
        fontWeight: "600",
        color: BRAND_BLUE,
    },
    hangarInput: {
        minWidth: 80,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        textAlign: "right",
        backgroundColor: "#FFFFFF",
    },
    divider: {
        height: 1,
        backgroundColor: "#E2E8F0",
        marginVertical: 6,
    },
    suggestedTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: "bold",
        color: BRAND_BLUE,
    },
    suggestedValue: {
        fontSize: 16,
        fontWeight: "bold",
        color: BRAND_GOLD,
    },
    priceLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 6,
    },
    linkText: {
        fontSize: 11,
        color: "#00529B",
        fontWeight: "600",
    },
    priceInputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: BRAND_GOLD,
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    priceCurrencySymbol: {
        fontSize: 22,
        fontWeight: "bold",
        color: BRAND_BLUE,
        marginRight: 6,
    },
    priceTextInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: "bold",
        color: BRAND_BLUE,
        paddingVertical: 10,
    },
    priceCurrencyBadge: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#94A3B8",
    },
    pygText: {
        fontSize: 12,
        color: "#059669",
        fontWeight: "600",
        marginTop: 4,
    },
    saveButton: {
        backgroundColor: "#059669",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 4,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: "#FFFFFF",
        fontWeight: "bold",
        fontSize: 14,
    },
});
