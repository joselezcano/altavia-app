import { BancardPaymentModal } from "@/components/bancard-modal";
import { fetchPaidReservationFields } from "@/utils/paid-reservation";
import { FlightWeatherCard } from "@/components/flight-weather";
import { LoadingCard } from "@/components/loading-card";
import { PassengerManifestModal } from "@/components/passenger-manifest-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { useFlightPlanByReservation } from "@/hooks/useFlightPlanByReservation";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { useDeleteReservation } from "@/hooks/useReservationEditing";
import { useReservationDetails } from "@/hooks/useReservationDetails";
import { AircraftCard } from "@/screens/flight-details/components/aircraft-card";
import { AltitudeCard } from "@/screens/flight-details/components/altitude-card";
import { CruiseSpeedCard } from "@/screens/flight-details/components/cruise-speed-card";
import { FlightAwareCard } from "@/screens/flight-details/components/flight-aware-card";
import { FlightCard } from "@/screens/flight-details/components/flight-card";
import { FlightStatusModal } from "@/screens/flight-details/components/modal";
import { OwnerToolBar } from "@/screens/flight-details/components/owner-tool-bar";
import { PilotToolBar } from "@/screens/flight-details/components/pilot-tool-bar";
import { RouteCard } from "@/screens/flight-details/components/route-card";
import { ScheduleCard } from "@/screens/flight-details/components/schedule-card";
import { generateAndShareInvoicePdf } from "@/utils/electronic-invoice";
import { getFlightData, getStatusBadge, PILOT_OPERATIONAL_STATUSES } from "@/utils/flight-status";
import { buildLegWeatherRequest, buildReservationWeatherRequest } from "@/utils/flight-weather";
import { isReservationPaid } from "@/utils/paid-reservation";
import { NON_EDITABLE_STATUSES } from "@/utils/reservation-permissions";
import { roleFlightRoute, toHref } from "@/utils/role-routes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
    Alert,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";


export default function FlightDetailsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { user, role, profileData } = useAuth();

    const params = useLocalSearchParams<{
        reservationId: string;
        legType?: string;
        originIdent?: string;
        destinationIdent?: string;
        originIcaoCode?: string;
        destinationIcaoCode?: string;
        departureTime?: string;
        aircraftId?: string;
        paxCount?: string;
    }>();

    const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isPayingBancard, setIsPayingBancard] = useState(false);
    const [isManifestModalVisible, setIsManifestModalVisible] = useState(false);

    const handleBancardPaymentSuccess = async (txData: {
        transactionId: string;
        authorizationCode: string;
        cardBrand?: string;
        cardLast4?: string;
    }) => {
        if (!reservation) return;

        try {
            // El servidor (bancardGetConfirmation) ya registró el pago, la factura y la notificación.
            const paid = await fetchPaidReservationFields(reservation.id);

            await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["client-notifications"] });

            setIsPayingBancard(false);

            setTimeout(async () => {
                await generateAndShareInvoicePdf({
                    ...reservation,
                    ...paid,
                }, user?.email || undefined);
            }, 500);

            Alert.alert("¡Pago Exitoso!", `Pago confirmado vía Bancard vPOS. Factura electrónica Nº ${paid.invoice_number ?? ""} emitida.`);
        } catch (error) {
            console.error("Error al registrar pago Bancard en Firestore:", error);
            Alert.alert("Error", "No se pudo actualizar el pago.");
        }
    };

    const {
        data: reservations = [],
        isLoading: isLoadingReservation,
    } = role === "CLIENT" ? useClientReservations(user?.uid) : (role === "PILOT" ? usePilotReservations(user?.uid) : useOwnerReservations(user?.uid));

    const { data: directReservation, isLoading: isLoadingDirectRes } = useReservationDetails(params.reservationId);

    const reservation = useMemo(() => {
        if (directReservation) return directReservation;
        if (!params.reservationId || !reservations.length) return null;
        return reservations.find((r) => r.id === params.reservationId) || null;
    }, [directReservation, params.reservationId, reservations]);

    const { data: outboundFlightPlan, isLoading: isLoadingOutboundFlightPlan } = useFlightPlanByReservation(
        reservation?.id,
        reservation?.originAirport?.ident,
        reservation?.destinationAirport?.ident
    );

    const { data: returnFlightPlan, isLoading: isLoadingReturnFlightPlan } = useFlightPlanByReservation(
        reservation?.id,
        reservation?.destinationAirport?.ident,
        reservation?.originAirport?.ident
    );

    const { data: aircraft, isLoading: isLoadingAircraft } = useAircraftDetails(reservation?.aircraftId);

    // Clima del tramo que se está viendo (el piloto entra por tramo; el resto, al próximo tramo).
    const weatherRequest = useMemo(() => {
        if (!reservation) return null;
        if (params.legType === "return") {
            return buildLegWeatherRequest({
                internalStatus: reservation.internal_status,
                originAirport: reservation.destinationAirport,
                destinationAirport: reservation.originAirport,
                departureTime: reservation.schedule.return_flight_departure_time,
                arrivalTime: reservation.schedule.return_flight_arrival_time,
            });
        }
        if (params.legType === "outbound") {
            return buildLegWeatherRequest({
                internalStatus: reservation.internal_status,
                originAirport: reservation.originAirport,
                destinationAirport: reservation.destinationAirport,
                departureTime: reservation.schedule.outbound_flight_departure_time,
                arrivalTime: reservation.schedule.outbound_flight_arrival_time,
            });
        }
        return buildReservationWeatherRequest(reservation);
    }, [reservation, params.legType]);

    const isLoading = (isLoadingReservation && !directReservation) || isLoadingDirectRes || isLoadingOutboundFlightPlan || isLoadingReturnFlightPlan || isLoadingAircraft;

    // Owner y encargada: cualquier estado. Piloto asignado: solo estados operativos
    // de un vuelo ya confirmado (mismo criterio que firestore.rules).
    const canManageStatus = role === "OWNER" || (role === "PILOT" && profileData?.isEncargado === true);
    const isAssignedPilot = role === "PILOT" && !!user?.uid && !!reservation?.pilot_ids?.includes(user.uid);
    const canPilotMoveStatus =
        isAssignedPilot && PILOT_OPERATIONAL_STATUSES.includes(reservation?.internal_status ?? "");

    // Editar / eliminar reserva (owner y encargada). Pagada: solo reprogramar; eliminar solo sin pagar.
    const deleteReservation = useDeleteReservation();
    const isPaid = reservation ? isReservationPaid(reservation) : false;
    const editReservationRoute =
        reservation && !NON_EDITABLE_STATUSES.includes(reservation.internal_status)
            ? roleFlightRoute(role, "edit-reservation", { reservationId: reservation.id })
            : null;

    const handleDeleteReservation = () => {
        if (!reservation) return;
        Alert.alert(
            "Eliminar reserva",
            "Se va a eliminar la reserva y se liberarán sus horarios en el calendario de la aeronave. Esta acción no se puede deshacer.",
            [
                { text: "Volver", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteReservation.mutateAsync(reservation);
                            Toast.show({ type: "success", text1: "Reserva eliminada" });
                            router.back();
                        } catch (error: any) {
                            Alert.alert("Error", error?.message || "No se pudo eliminar la reserva.");
                        }
                    },
                },
            ]
        );
    };

    // ID de FlightAware: owner, encargada o piloto asignado, en vuelos ya confirmados.
    const canEditFaFlightId =
        (canManageStatus || isAssignedPilot) && PILOT_OPERATIONAL_STATUSES.includes(reservation?.internal_status ?? "");

    const openStatusModal = () => {
        if (reservation) {
            setSelectedStatus(reservation.internal_status);
            setIsStatusModalVisible(true);
        }
    };

    const handleUpdateStatus = async () => {
        if (!reservation || !selectedStatus) return;

        setIsUpdatingStatus(true);
        try {
            const reservationRef = doc(db, "aircraft-reservation", reservation.id);
            await updateDoc(reservationRef, {
                internal_status: selectedStatus,
            });

            const queryKey = role === "CLIENT" ? "client-reservations" : (role === "PILOT" ? "pilot-reservations" : "owner-reservations");
            await queryClient.invalidateQueries({
                queryKey: [queryKey, user?.uid],
            });
            await queryClient.invalidateQueries({
                queryKey: ["reservation-details", reservation.id],
            });

            setIsStatusModalVisible(false);
        } catch (error) {
            console.error("Error al actualizar el estado del vuelo:", error);
            Alert.alert("Error", "No se pudo actualizar el estado del vuelo. Intente nuevamente.");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleCreateFlightPlan = () => {
        if (!reservation) return;

        const isReturn = params.legType === "return";
        const currentFlightPlan = isReturn ? returnFlightPlan : outboundFlightPlan;

        if (currentFlightPlan) {
            router.push({
                pathname: "./view-flight-plan",
                params: {
                    flightPlanId: currentFlightPlan.id,
                    aircraftModel: aircraft?.basic_specs.model,
                },
            });
        } else {
            const originIdent = isReturn ? reservation.trip.destination_airport_ident : reservation.trip.origin_airport_ident;
            const destinationIdent = isReturn ? reservation.trip.origin_airport_ident : reservation.trip.destination_airport_ident;
            const originIcao = isReturn
                ? (reservation.destinationAirport?.icao_code || reservation.trip.destination_airport_ident)
                : (reservation.originAirport?.icao_code || reservation.trip.origin_airport_ident);
            const destinationIcao = isReturn
                ? (reservation.originAirport?.icao_code || reservation.trip.origin_airport_ident)
                : (reservation.destinationAirport?.icao_code || reservation.trip.destination_airport_ident);

            const depTime = isReturn
                ? (reservation.schedule.return_flight_departure_time instanceof Date
                    ? reservation.schedule.return_flight_departure_time.toISOString()
                    : new Date(reservation.schedule.return_flight_departure_time || "").toISOString())
                : (reservation.schedule.outbound_flight_departure_time instanceof Date
                    ? reservation.schedule.outbound_flight_departure_time.toISOString()
                    : new Date(reservation.schedule.outbound_flight_departure_time || "").toISOString());

            const paxCount = reservation.passengers && reservation.passengers.length > 0
                ? String(reservation.passengers.length)
                : String(reservation.capacity?.passangers || 1);

            router.push({
                pathname: "/flights/create-flight-plan",
                params: {
                    reservationId: reservation.id,
                    legType: isReturn ? "return" : "outbound",
                    originIdent: originIdent || "",
                    destinationIdent: destinationIdent || "",
                    originIcaoCode: originIcao || "",
                    destinationIcaoCode: destinationIcao || "",
                    departureTime: depTime || new Date().toISOString(),
                    aircraftId: reservation.aircraftId || "",
                    paxCount: paxCount,
                },
            });
        }
    };

    return (
        <ThemedView className="flex-1 bg-brand-light px-4" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 mt-2">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={20} color="#030436" />
                </TouchableOpacity>
                <View className="items-center">
                    <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[10px]">
                        Detalles de Reserva
                    </ThemedText>
                    <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                        Información del Vuelo
                    </ThemedText>
                </View>
                <View className="w-10" />
            </View>

            {/* Pilot Tool Bar */}
            {reservation && role === "PILOT" &&
                <PilotToolBar
                    handleCreateFlightPlan={handleCreateFlightPlan}
                    aircraftId={reservation.aircraftId}
                    fa_flight_id={reservation.fa_flight_id}
                    hasFlightPlan={!!outboundFlightPlan}
                    onOpenManifest={() => setIsManifestModalVisible(true)}
                    passengerCount={reservation.passengers?.length || 0}
                />
            }

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {isLoading
                    ? <LoadingCard message="Cargando información del vuelo..." />
                    : !reservation ? (
                        <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
                            <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center mb-4 border border-rose-100">
                                <Ionicons name="alert-circle-outline" size={32} color="#e11d48" />
                            </View>
                            <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                                Reserva no encontrada
                            </ThemedText>
                            <ThemedText className="text-slate-500 text-xs text-center mt-1 mb-6 px-4">
                                No fue posible recuperar los detalles de la reservación seleccionada.
                            </ThemedText>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="bg-brand-blue px-5 py-3 rounded-xl flex-row items-center gap-2 shadow-md"
                                activeOpacity={0.8}
                            >
                                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                                <ThemedText className="text-sm font-bold text-white">Volver a Mis Vuelos</ThemedText>
                            </TouchableOpacity>
                        </View>
                    ) : (() => {
                        const status = getStatusBadge(reservation.internal_status);
                        const { model, registration, aircraftType, distanceKm, cruiseSpeedAircraft, cruiseSpeedOutbound, cruiseSpeedReturn, altitudeOutbound, altitudeReturn, paxCapacity, serviceCeiling, flightDurationHoursOutbound, flightDurationHoursReturn } = getFlightData(reservation, outboundFlightPlan, returnFlightPlan);
                        const aircraftPhoto = aircraft?.profile_photo || (aircraft?.photos && aircraft.photos.length > 0 ? aircraft.photos[0] : (reservation?.aircraftSpecs?.profile_photo || (reservation?.aircraftSpecs?.photos && reservation.aircraftSpecs.photos.length > 0 ? reservation.aircraftSpecs.photos[0] : undefined)));

                        return (
                            <View className="gap-4 mb-10">
                                {/* Owner / Encargado Tool Bar */}
                                {reservation && (role === "OWNER" || (role === "PILOT" && profileData?.isEncargado)) &&
                                    <OwnerToolBar
                                        reservation={reservation}
                                        outboundFlightPlanId={outboundFlightPlan?.id}
                                        returnFlightPlanId={returnFlightPlan?.id}
                                        aircraftModel={aircraft?.basic_specs.model}
                                        onOpenManifest={() => setIsManifestModalVisible(true)}
                                        onEditReservation={editReservationRoute ? () => router.push(toHref(editReservationRoute)) : undefined}
                                        editLabel={isPaid ? "Reprogramar" : "Editar Reserva"}
                                        onDeleteReservation={!isPaid ? handleDeleteReservation : undefined}
                                        isDeleting={deleteReservation.isPending}
                                    />
                                }

                                {/* Pending Approval Action Banner for Owner/Encargado */}
                                {reservation && (role === "OWNER" || (role === "PILOT" && profileData?.isEncargado)) &&
                                    (reservation.internal_status === "pending_approval" || reservation.internal_status === "pending") && (
                                    <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                                        <View className="flex-row items-center gap-2 mb-1.5">
                                            <Ionicons name="time" size={18} color="#92400e" />
                                            <ThemedText className="font-bold text-amber-900 text-sm">
                                                Solicitud Pendiente de Aprobación
                                            </ThemedText>
                                        </View>
                                        <ThemedText className="text-xs text-amber-800 leading-4 mb-3">
                                            El cliente solicitó esta reserva. Revisa la disponibilidad, asigna los pilotos y aprueba el vuelo para solicitar el pago.
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() =>
                                                router.push({
                                                    pathname: "./assign-pilots",
                                                    params: { reservationId: reservation.id },
                                                })
                                            }
                                            className="bg-brand-gold py-2.5 px-4 rounded-xl flex-row items-center justify-center gap-1.5 shadow-sm"
                                            activeOpacity={0.8}
                                        >
                                            <MaterialCommunityIcons name="account-tie-hat" size={18} color="#FFFFFF" />
                                            <ThemedText className="text-white font-bold text-xs">
                                                Asignar Tripulación y Aprobar
                                            </ThemedText>
                                            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Client Payment CTA if awaiting_payment */}
                                {reservation && role === "CLIENT" && reservation.internal_status === "awaiting_payment" && (
                                    <View
                                        className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
                                        style={{
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 2,
                                            elevation: 2,
                                        }}
                                    >
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
                                            onPress={() => setIsPayingBancard(true)}
                                            className="bg-brand-gold py-3 px-4 rounded-xl flex-row items-center justify-center"
                                            style={{
                                                gap: 8,
                                                shadowColor: "#000",
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 2,
                                                elevation: 2,
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <MaterialCommunityIcons name="credit-card-check-outline" size={18} color="#FFFFFF" />
                                            <ThemedText className="text-white font-bold text-sm">Pagar Vuelo por Bancard</ThemedText>
                                            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Confirmed Payment & Electronic Invoice Card */}
                                {reservation && (reservation.internal_status === "confirmed" || !!reservation.invoice_number) && (
                                    <View
                                        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4"
                                        style={{
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 2,
                                            elevation: 2,
                                        }}
                                    >
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

                                        {reservation.invoice_number ? (
                                            <View
                                                className="mb-3 p-2.5 rounded-xl border border-emerald-100"
                                                style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}
                                            >
                                                <ThemedText className="text-xs font-semibold text-slate-800">
                                                    Factura Electrónica: {reservation.invoice_number}
                                                </ThemedText>
                                                {reservation.invoice_timbrado ? (
                                                    <ThemedText className="text-[11px] text-slate-500 mt-0.5">
                                                        Timbrado: {reservation.invoice_timbrado}
                                                    </ThemedText>
                                                ) : null}
                                                {reservation.invoice_cdc ? (
                                                    <ThemedText className="text-[10px] text-slate-400 mt-0.5" numberOfLines={1}>
                                                        CDC: {reservation.invoice_cdc}
                                                    </ThemedText>
                                                ) : null}
                                            </View>
                                        ) : null}

                                        <TouchableOpacity
                                            onPress={() => generateAndShareInvoicePdf(reservation, user?.email || undefined)}
                                            className="bg-emerald-600 py-2.5 px-3 rounded-xl flex-row items-center justify-center"
                                            style={{ gap: 8 }}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                                            <ThemedText className="text-white font-bold text-xs">
                                                Ver / Descargar Factura (PDF)
                                            </ThemedText>
                                            <Ionicons name="share-outline" size={14} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* ID de vuelo de FlightAware (tracking) */}
                                {reservation && canEditFaFlightId && (
                                    <FlightAwareCard
                                        reservationId={reservation.id}
                                        faFlightId={reservation.fa_flight_id}
                                    />
                                )}

                                {/* Manifiesto de Pasajeros (DINAC) Card */}
                                {reservation && (
                                    <View
                                        className="bg-white rounded-2xl p-4 border border-slate-200"
                                        style={{
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 2,
                                            elevation: 2,
                                        }}
                                    >
                                        <View className="flex-row items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                                            <View className="flex-row items-center" style={{ gap: 8 }}>
                                                <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                                                    <Ionicons name="people" size={16} color="#030436" />
                                                </View>
                                                <View>
                                                    <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                                                        Requisito Oficial DINAC
                                                    </ThemedText>
                                                    <ThemedText className="font-bold text-slate-800 text-sm">
                                                        Manifiesto de Pasajeros
                                                    </ThemedText>
                                                </View>
                                            </View>
                                            <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                                                <ThemedText className="text-[11px] font-bold text-slate-700">
                                                    {reservation.passengers?.length || 0} / {reservation.capacity?.passangers || 1} Pax
                                                </ThemedText>
                                            </View>
                                        </View>

                                        {/* Passenger Summary / Weight & Balance */}
                                        <View className="flex-row items-center justify-between bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                                            <View>
                                                <ThemedText className="text-[11px] text-slate-500">Pasajeros a Bordo</ThemedText>
                                                <ThemedText className="text-sm font-bold text-slate-800">
                                                    {reservation.passengers?.length || 0} de {reservation.capacity?.passangers || 1} asientos
                                                </ThemedText>
                                            </View>
                                            <View style={{ alignItems: "flex-end" }}>
                                                <ThemedText className="text-[11px] text-slate-500">Carga Útil Total</ThemedText>
                                                <ThemedText className="text-sm font-bold text-brand-blue">
                                                    {(reservation.passengers || []).reduce((acc, p) => acc + (p.weightKg || 0) + (p.luggageKg || 0), 0)} kg
                                                </ThemedText>
                                            </View>
                                        </View>

                                        {/* Passengers Quick List */}
                                        {reservation.passengers && reservation.passengers.length > 0 ? (
                                            <View className="mb-3" style={{ gap: 6 }}>
                                                {reservation.passengers.map((p, idx) => (
                                                    <View key={p.id || idx} className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
                                                        <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
                                                            <ThemedText className="text-xs font-bold text-slate-400">{idx + 1}.</ThemedText>
                                                            <ThemedText className="text-xs font-semibold text-slate-800" numberOfLines={1}>
                                                                {p.fullName} {p.isPrimary ? "👑" : ""}
                                                            </ThemedText>
                                                        </View>
                                                        <ThemedText className="text-[11px] text-slate-500">
                                                            {p.documentType} {p.documentNumber} • {p.weightKg + (p.luggageKg || 0)}kg
                                                        </ThemedText>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : (
                                            <View className="py-2 mb-2 items-center">
                                                <ThemedText className="text-xs text-slate-500 text-center">
                                                    Aún no se ha registrado la lista de pasajeros para este vuelo.
                                                </ThemedText>
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            onPress={() => setIsManifestModalVisible(true)}
                                            className="bg-brand-blue py-2.5 px-4 rounded-xl flex-row items-center justify-center shadow-sm"
                                            style={{ gap: 6 }}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="people-outline" size={16} color="#FFFFFF" />
                                            <ThemedText className="text-white font-bold text-xs">
                                                {reservation.passengers && reservation.passengers.length > 0
                                                    ? "Gestionar / Modificar Manifiesto"
                                                    : "Cargar Manifiesto de Pasajeros"}
                                            </ThemedText>
                                            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Aircraft Card */}
                                <AircraftCard
                                    model={model}
                                    aircraftType={aircraftType}
                                    registration={registration}
                                    status={status}
                                    profilePhoto={aircraftPhoto}
                                    onStatusChange={canManageStatus || canPilotMoveStatus ? openStatusModal : undefined}
                                />

                                {/* Route Card */}
                                <RouteCard reservation={reservation} />

                                {/* Schedule Card */}
                                <ScheduleCard reservation={reservation} />

                                {/* Pronóstico del tiempo (confirmado/demorado, próximos 7 días). No muestra nada si no aplica o falla. */}
                                <FlightWeatherCard
                                    request={weatherRequest}
                                    variant={role === "CLIENT" ? "compact" : "detail"}
                                />

                                {/* Flight Card */}
                                <FlightCard
                                    reservation={reservation}
                                    distanceKm={distanceKm}
                                    flightDurationHoursOutbound={flightDurationHoursOutbound}
                                    flightDurationHoursReturn={flightDurationHoursReturn}
                                    paxCapacity={paxCapacity}
                                />

                                {/* Cruise Speed Card */}
                                <CruiseSpeedCard
                                    cruiseSpeedAircraft={cruiseSpeedAircraft}
                                    cruiseSpeedOutbound={cruiseSpeedOutbound}
                                    cruiseSpeedReturn={cruiseSpeedReturn}
                                />

                                {/* Altitude Card */}
                                <AltitudeCard
                                    serviceCeiling={serviceCeiling}
                                    altitudeOutbound={altitudeOutbound}
                                    altitudeReturn={altitudeReturn}
                                />
                            </View>
                        );
                    })()}
            </ScrollView>

            {/* Change Status Modal */}
            <FlightStatusModal
                isStatusModalVisible={isStatusModalVisible}
                setIsStatusModalVisible={setIsStatusModalVisible}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                handleUpdateStatus={handleUpdateStatus}
                isUpdatingStatus={isUpdatingStatus}
                allowedStatuses={canManageStatus ? undefined : PILOT_OPERATIONAL_STATUSES}
            />

            {/* Bancard Payment Modal */}
            <BancardPaymentModal
                visible={isPayingBancard}
                reservation={reservation}
                onClose={() => setIsPayingBancard(false)}
                onPaymentSuccess={handleBancardPaymentSuccess}
            />

            {/* Passenger Manifest Modal */}
            {reservation && (
                <PassengerManifestModal
                    visible={isManifestModalVisible}
                    onClose={() => setIsManifestModalVisible(false)}
                    reservation={reservation}
                />
            )}
        </ThemedView>
    );
}
