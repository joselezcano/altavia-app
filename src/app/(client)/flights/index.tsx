import { fetchPaidReservationFields } from "@/utils/paid-reservation";
import { BancardPaymentModal } from "@/components/bancard-modal";
import { FlightSummaryCard } from "@/components/flight-summary-card";
import { LoadingCard } from "@/components/loading-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { ClientReservationItem } from "@/types/all-roles";
import { airportCityName, airportShortCode } from "@/utils/airport-label";
import { buildReservationWeatherRequest } from "@/utils/flight-weather";
import { generateAndShareInvoicePdf } from "@/utils/electronic-invoice";
import { getStatusBadge } from "@/utils/flight-status";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import Toast from "react-native-toast-message";

export default function ClientFlightsScreen() {
    const { user, role } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const {
        data: reservations = [],
        isLoading,
        isRefetching,
        refetch,
    } = useClientReservations(user?.uid);

    const [payingReservation, setPayingReservation] = useState<ClientReservationItem | null>(null);

    // Una sola card abierta a la vez. Mientras el usuario no toque ninguna, se abre sola
    // la primera reserva que espera pago, para que el botón "Pagar" quede a la vista.
    const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);
    const firstAwaitingPaymentId = reservations.find((r) => r.internal_status === "awaiting_payment")?.id ?? null;
    const effectiveExpandedId = expandedId === undefined ? firstAwaitingPaymentId : expandedId;

    const handleBancardPaymentSuccess = async (txData: {
        transactionId: string;
        authorizationCode: string;
        cardBrand?: string;
        cardLast4?: string;
    }) => {
        if (!payingReservation) return;

        try {
            // El servidor (bancardGetConfirmation) ya registró el pago, la factura y la notificación.
            const paid = await fetchPaidReservationFields(payingReservation.id);

            await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["client-notifications"] });

            const updatedResItem: ClientReservationItem = {
                ...payingReservation,
                ...paid,
            };

            setPayingReservation(null);

            // Trigger PDF preview and sharing immediately
            setTimeout(async () => {
                await generateAndShareInvoicePdf(updatedResItem, user?.email || undefined);
            }, 500);

            Toast.show({
                type: "success",
                text1: "¡Pago Aprobado con Éxito!",
                text2: `Factura Electrónica Nº ${paid.invoice_number ?? ""} emitida.`,
            });
        } catch (error) {
            console.error("Error al registrar pago Bancard en Firestore:", error);
            Alert.alert("Error", "No se pudo actualizar el estado del pago. Intente nuevamente.");
        }
    };

    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

    return (
        <ThemedView className="flex-1 bg-brand-light px-4 pt-2">
            {/* Top Header */}
            <View className="flex-row items-center justify-between mb-4 mt-2">
                <View>
                    <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest">
                        Historial de Reservas
                    </ThemedText>
                    <ThemedText type="title" className="mt-0.5 text-xl">
                        Mis Vuelos
                    </ThemedText>
                </View>
                <UserAvatar size={44} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#030436" />
                }
            >
                {isLoading
                    ? <LoadingCard message="Cargando tus reservas..." />
                    : reservations.length === 0 ? (
                        <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
                            <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 border border-slate-200">
                                <Ionicons name="airplane-outline" size={32} color="#94a3b8" />
                            </View>
                            <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                                No tienes vuelos reservados
                            </ThemedText>
                            <ThemedText className="text-slate-500 text-xs text-center mt-1 mb-6 px-4">
                                Realiza una búsqueda desde la pestaña Reservar para programar tu próximo viaje.
                            </ThemedText>
                            <TouchableOpacity
                                onPress={() => router.push("/book")}
                                className="bg-brand-gold px-5 py-3 rounded-xl flex-row items-center gap-2 shadow-md"
                                activeOpacity={0.8}
                            >
                                <Ionicons name="search" size={16} color="#FFFFFF" />
                                <ThemedText className="text-sm font-bold text-white">Buscar y Reservar</ThemedText>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="mb-10" style={{ gap: 14 }}>
                            {reservations.map((item) => {
                                const status = getStatusBadge(item.internal_status);
                                const model = item.aircraftSpecs?.basic_specs?.model || "Aeronave";
                                const registration = item.aircraftSpecs?.basic_specs?.registration || "N/A";
                                const distanceKm = item.distance_nm ? (item.distance_nm * 1.852).toFixed(0) : undefined;
                                const hasBothIata = Boolean(
                                    item.originAirport?.iata_code?.trim() && item.destinationAirport?.iata_code?.trim()
                                );
                                const aircraftPaxCapacity = item.aircraftSpecs?.basic_specs?.pax_count;

                                return (
                                    <FlightSummaryCard
                                        key={item.id}
                                        expanded={effectiveExpandedId === item.id}
                                        onToggle={() => setExpandedId(effectiveExpandedId === item.id ? null : item.id)}
                                        eyebrow={model}
                                        originCode={airportShortCode(item.originAirport, item.trip.origin_airport_ident)}
                                        originName={airportCityName(item.originAirport)}
                                        destinationCode={airportShortCode(item.destinationAirport, item.trip.destination_airport_ident)}
                                        destinationName={airportCityName(item.destinationAirport)}
                                        departureTime={item.schedule.outbound_flight_departure_time}
                                        roundtrip={item.schedule.roundtrip}
                                        status={status}
                                        registration={registration}
                                        passengers={item.capacity.passangers}
                                        priceUsd={item.price}
                                        weatherRequest={buildReservationWeatherRequest(item)}
                                    >
                                        {/* Aeropuertos completos y horarios */}
                                        <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            {!hasBothIata && (
                                                <View className="mb-3" style={{ gap: 10 }}>
                                                    <View className="flex-row items-center" style={{ gap: 8 }}>
                                                        <View className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                                                        <View className="flex-1">
                                                            <ThemedText className="text-xs uppercase tracking-wider font-bold text-slate-400">
                                                                Origen
                                                            </ThemedText>
                                                            <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                                                                {item.originAirport?.name || item.trip.origin_airport_ident}
                                                            </ThemedText>
                                                        </View>
                                                    </View>
                                                    <View className="flex-row items-center" style={{ gap: 8 }}>
                                                        <View className="w-2.5 h-2.5 rounded-full bg-brand-blue" />
                                                        <View className="flex-1">
                                                            <ThemedText className="text-xs uppercase tracking-wider font-bold text-slate-400">
                                                                Destino
                                                            </ThemedText>
                                                            <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                                                                {item.destinationAirport?.name || item.trip.destination_airport_ident}
                                                            </ThemedText>
                                                        </View>
                                                    </View>
                                                    <View className="h-px bg-slate-200" style={{ opacity: 0.6 }} />
                                                </View>
                                            )}

                                            {/* Schedule dates list */}
                                            <View style={{ gap: 6 }}>
                                                <View className="flex-row justify-between items-center">
                                                    <ThemedText className="text-xs text-slate-500 font-medium">Horario de Ida:</ThemedText>
                                                    <ThemedText className="text-xs font-bold text-slate-800">
                                                        {item.schedule.outbound_flight_departure_time.toLocaleString("es-ES", {
                                                            dateStyle: "medium",
                                                            timeStyle: "short",
                                                        })} hs
                                                    </ThemedText>
                                                </View>

                                                {item.schedule.roundtrip && item.schedule.return_flight_departure_time && (
                                                    <>
                                                        <View className="h-px bg-slate-200 my-1" style={{ opacity: 0.4 }} />
                                                        <View className="flex-row justify-between items-center">
                                                            <ThemedText className="text-xs text-slate-500 font-medium">Horario de Vuelta:</ThemedText>
                                                            <ThemedText className="text-xs font-bold text-slate-800">
                                                                {item.schedule.return_flight_departure_time.toLocaleString("es-ES", {
                                                                    dateStyle: "medium",
                                                                    timeStyle: "short",
                                                                })} hs
                                                            </ThemedText>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        </View>

                                        {/* Footer Stats Grid */}
                                        <View className="flex-row justify-between items-center px-1">
                                            <View className="flex-row items-center" style={{ gap: 6 }}>
                                                <Ionicons name="people-outline" size={16} color="#030436" />
                                                <ThemedText className="text-xs font-semibold text-slate-700">
                                                    {item.capacity.passangers} pasajero(s)
                                                </ThemedText>
                                            </View>

                                            <View className="flex-row items-center" style={{ gap: 6 }}>
                                                <MaterialCommunityIcons name="seat-passenger" size={16} color="#030436" />
                                                <ThemedText className="text-xs font-semibold text-slate-700">
                                                    {aircraftPaxCapacity !== undefined ? `${aircraftPaxCapacity} asientos` : "N/A"}
                                                </ThemedText>
                                            </View>

                                            {distanceKm ? (
                                                <View className="flex-row items-center" style={{ gap: 6 }}>
                                                    <Ionicons name="navigate-outline" size={16} color="#030436" />
                                                    <ThemedText className="text-xs font-semibold text-slate-700">
                                                        {distanceKm} km
                                                    </ThemedText>
                                                </View>
                                            ) : (
                                                <View />
                                            )}
                                        </View>

                                        {/* Operational Status Notices and Payment CTA */}
                                        {item.internal_status === "awaiting_payment" ? (
                                            <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                                                <View className="flex-row items-center mb-1.5" style={{ gap: 8 }}>
                                                    <Ionicons name="card" size={18} color="#1e40af" />
                                                    <ThemedText className="font-bold text-blue-900 text-sm">
                                                        ¡Vuelo Aprobado! Listo para Pago
                                                    </ThemedText>
                                                </View>
                                                <ThemedText className="text-xs text-blue-800 leading-4 mb-3">
                                                    La tripulación y la aeronave han sido confirmadas por operaciones. Procede con el pago para emitir tus billetes y asegurar el viaje.
                                                </ThemedText>
                                                <TouchableOpacity
                                                    onPress={() => setPayingReservation(item)}
                                                    className="bg-brand-gold py-3 px-4 rounded-xl flex-row items-center justify-center"
                                                    style={{ gap: 8 }}
                                                    activeOpacity={0.8}
                                                >
                                                    <MaterialCommunityIcons name="credit-card-check-outline" size={18} color="#FFFFFF" />
                                                    <ThemedText className="text-white font-bold text-sm">Pagar Vuelo por Bancard</ThemedText>
                                                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : item.internal_status === "confirmed" ? (
                                            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                                                <View className="flex-row items-center justify-between mb-2">
                                                    <View className="flex-row items-center" style={{ gap: 6 }}>
                                                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                                                        <ThemedText className="font-bold text-emerald-900 text-xs">
                                                            Pago Confirmado • Bancard vPOS
                                                        </ThemedText>
                                                    </View>
                                                    <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                                                        <ThemedText className="text-[10px] font-bold text-emerald-800">
                                                            SIFEN DNIT
                                                        </ThemedText>
                                                    </View>
                                                </View>

                                                {item.invoice_number ? (
                                                    <View className="mb-2 p-2 rounded-lg border border-emerald-100" style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}>
                                                        <ThemedText className="text-[11px] font-semibold text-slate-800">
                                                            Factura Electrónica: {item.invoice_number}
                                                        </ThemedText>
                                                        {item.invoice_timbrado ? (
                                                            <ThemedText className="text-[10px] text-slate-500">
                                                                Timbrado: {item.invoice_timbrado}
                                                            </ThemedText>
                                                        ) : null}
                                                    </View>
                                                ) : null}

                                                <TouchableOpacity
                                                    onPress={() => generateAndShareInvoicePdf(item, user?.email || undefined)}
                                                    className="bg-emerald-600 py-2.5 px-3 rounded-xl flex-row items-center justify-center mt-1"
                                                    style={{ gap: 8 }}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                                                    <ThemedText className="text-white font-bold text-xs">
                                                        Ver / Compartir Factura (PDF)
                                                    </ThemedText>
                                                    <Ionicons name="share-outline" size={14} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : item.internal_status === "pending_approval" || item.internal_status === "pending" ? (
                                            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex-row items-center" style={{ gap: 10 }}>
                                                <Ionicons name="time-outline" size={20} color="#92400e" />
                                                <View className="flex-1">
                                                    <ThemedText className="font-bold text-amber-900 text-xs">
                                                        Esperando Aprobación de Operaciones
                                                    </ThemedText>
                                                    <ThemedText className="text-[11px] text-amber-800">
                                                        El propietario o encargado está validando la disponibilidad y asignando la tripulación.
                                                    </ThemedText>
                                                </View>
                                            </View>
                                        ) : null}

                                        {/* Detalles Button */}
                                        <TouchableOpacity
                                            onPress={() => router.push({ pathname: "/flights/flight-details", params: { reservationId: item.id } })}
                                            className="bg-brand-blue py-3 px-4 rounded-xl flex-row items-center justify-center"
                                            style={{ gap: 6 }}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
                                            <ThemedText className="text-xs font-bold text-white">Detalles</ThemedText>
                                            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                                        </TouchableOpacity>

                                        {/* Tracking de Vuelo Button */}
                                        <TouchableOpacity
                                            onPress={() =>
                                                router.push({
                                                    pathname: "/flights/flight-tracker",
                                                    params: { fa_flight_id: item.fa_flight_id ?? "" },
                                                })
                                            }
                                            className="bg-brand-blue py-3 px-4 rounded-xl flex-row items-center justify-center"
                                            style={{ gap: 6 }}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                                            <ThemedText className="text-xs font-bold text-white">Tracking de Vuelo</ThemedText>
                                            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </FlightSummaryCard>
                                );
                            })}
                        </View>
                    )}
            </ScrollView>

            {/* Bancard Payment Modal */}
            <BancardPaymentModal
                visible={!!payingReservation}
                reservation={payingReservation}
                onClose={() => setPayingReservation(null)}
                onPaymentSuccess={handleBancardPaymentSuccess}
            />
        </ThemedView>
    );
}

