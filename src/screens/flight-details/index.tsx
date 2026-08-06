import { LoadingCard } from "@/components/loading-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { useFlightPlanByReservation } from "@/hooks/useFlightPlanByReservation";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { AircraftCard } from "@/screens/flight-details/components/aircraft-card";
import { AltitudeCard } from "@/screens/flight-details/components/altitude-card";
import { CruiseSpeedCard } from "@/screens/flight-details/components/cruise-speed-card";
import { FlightCard } from "@/screens/flight-details/components/flight-card";
import { FlightStatusModal } from "@/screens/flight-details/components/modal";
import { OwnerToolBar } from "@/screens/flight-details/components/owner-tool-bar";
import { PilotToolBar } from "@/screens/flight-details/components/pilot-tool-bar";
import { RouteCard } from "@/screens/flight-details/components/route-card";
import { ScheduleCard } from "@/screens/flight-details/components/schedule-card";
import { getFlightData, getStatusBadge } from "@/utils/flight-status";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
    Alert,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


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

    const {
        data: reservations = [],
        isLoading: isLoadingReservation,
    } = role === "CLIENT" ? useClientReservations(user?.uid) : (role === "PILOT" ? usePilotReservations(user?.uid) : useOwnerReservations(user?.uid));

    const reservation = useMemo(() => {
        if (!params.reservationId || !reservations.length) return null;
        return reservations.find((r) => r.id === params.reservationId) || null;
    }, [params.reservationId, reservations]);

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

    const isLoading = isLoadingReservation || isLoadingOutboundFlightPlan || isLoadingReturnFlightPlan || isLoadingAircraft;

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

        const currentFlightPlan = params.legType === "outbound" ? outboundFlightPlan : returnFlightPlan;

        if (currentFlightPlan) {
            router.push({
                pathname: "./view-flight-plan",
                params: {
                    flightPlanId: currentFlightPlan.id,
                    aircraftModel: aircraft?.basic_specs.model,
                },
            });
        } else {
            router.push({
                pathname: "/flights/create-flight-plan",
                params: {
                    reservationId: reservation.id,
                    legType: params.legType || "outbound",
                    originIdent: params.originIdent || "",
                    destinationIdent: params.destinationIdent || "",
                    originIcaoCode: params.originIcaoCode || "",
                    destinationIcaoCode: params.destinationIcaoCode || "",
                    departureTime:
                        params.departureTime || new Date().toISOString(),
                    aircraftId: reservation.aircraftId || "",
                    paxCount: params.paxCount || String(reservation?.capacity?.passangers || 1),
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
                    <Ionicons name="arrow-back" size={20} color="#0f1e3d" />
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
                                {/* Owner Tool Bar */}
                                {reservation && role === "OWNER" &&
                                    <OwnerToolBar
                                        reservation={reservation}
                                        outboundFlightPlanId={outboundFlightPlan?.id}
                                        returnFlightPlanId={returnFlightPlan?.id}
                                        aircraftModel={aircraft?.basic_specs.model}
                                    />
                                }

                                {/* Aircraft Card */}
                                <AircraftCard
                                    model={model}
                                    aircraftType={aircraftType}
                                    registration={registration}
                                    status={status}
                                    profilePhoto={aircraftPhoto}
                                    onStatusChange={role === "OWNER" || (role === "PILOT" && profileData?.isEncargado) ? openStatusModal : undefined}
                                />

                                {/* Route Card */}
                                <RouteCard reservation={reservation} />

                                {/* Schedule Card */}
                                <ScheduleCard reservation={reservation} />

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
            />
        </ThemedView>
    );
}
