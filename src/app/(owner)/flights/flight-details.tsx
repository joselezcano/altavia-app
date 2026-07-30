import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { getStatusBadge, INTERNAL_STATUS_DEFINITIONS } from "@/utils/flight-status";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function FlightDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();

  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const {
    data: reservations = [],
    isLoading,
  } = useOwnerReservations(user?.uid);

  const reservation = useMemo(() => {
    if (!reservationId || !reservations.length) return null;
    return reservations.find((r) => r.id === reservationId) || null;
  }, [reservationId, reservations]);

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

      await queryClient.invalidateQueries({
        queryKey: ["owner-reservations", user?.uid],
      });

      setIsStatusModalVisible(false);
    } catch (error) {
      console.error("Error al actualizar el estado del vuelo:", error);
      Alert.alert("Error", "No se pudo actualizar el estado del vuelo. Intente nuevamente.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatFlightTime = (hours: number) => {
    if (!hours || isNaN(hours) || hours <= 0) return "N/A";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(owner)/flights");
            }
          }}
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

      {/* Tool Bar Row */}
      {reservation && (
        <View className="flex-row items-center gap-2 mb-4">
          {/* Tripulación Button */}
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/flights/assign-pilots",
                params: {
                  reservationId: reservation.id,
                },
              })
            }
            className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="account-tie-hat" size={20} color="#FFFFFF" />
            <ThemedText className="text-[9.5px] font-bold text-white text-center" numberOfLines={1}>
              Tripulación{reservation.pilot_ids && reservation.pilot_ids.length > 0 ? ` (${reservation.pilot_ids.length})` : ""}
            </ThemedText>
          </TouchableOpacity>

          {/* Plan de Vuelo Button (Dummy) */}
          <TouchableOpacity
            onPress={() => { }}
            className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <ThemedText className="text-[9.5px] font-bold text-white text-center" numberOfLines={1}>
              Plan de Vuelo
            </ThemedText>
          </TouchableOpacity>

          {/* Tracking de Vuelo Button */}
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/flights/flight-tracker",
                params: { fa_flight_id: reservation.fa_flight_id ?? "" },
              })
            }
            className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={20} color="#FFFFFF" />
            <ThemedText className="text-[9.5px] font-bold text-white text-center" numberOfLines={1}>
              Tracking
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {isLoading ? (
          <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
            <ActivityIndicator size="large" color="#0f1e3d" />
            <ThemedText className="text-slate-500 font-medium mt-3 text-center text-sm">
              Cargando información del vuelo...
            </ThemedText>
          </View>
        ) : !reservation ? (
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
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(owner)/flights");
                }
              }}
              className="bg-brand-blue px-5 py-3 rounded-xl flex-row items-center gap-2 shadow-md"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
              <ThemedText className="text-sm font-bold text-white">Volver a Mis Vuelos</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (() => {
          const status = getStatusBadge(reservation.internal_status);
          const model = reservation.aircraftSpecs?.basic_specs?.model || "Aeronave";
          const registration = reservation.aircraftSpecs?.basic_specs?.registration || "N/A";
          const aircraftType = reservation.aircraftSpecs?.basic_specs?.type || "N/A";
          const distanceKm = reservation.distance_nm ? (reservation.distance_nm * 1.852).toFixed(0) : null;
          const cruiseSpeed = reservation.aircraftSpecs?.operating_specs?.cruise_speed_knots || reservation.cruise_speed_knots;
          const serviceCeiling = reservation.aircraftSpecs?.operating_specs?.service_ceiling_feet;
          const paxCapacity = reservation.aircraftSpecs?.basic_specs?.pax_count;

          // Flight duration computation
          const outboundMs = reservation.schedule.outbound_flight_arrival_time.getTime() - reservation.schedule.outbound_flight_departure_time.getTime();
          const flightDurationHours = outboundMs > 0
            ? outboundMs / (3600 * 1000)
            : (reservation.distance_nm && cruiseSpeed ? reservation.distance_nm / cruiseSpeed : 0);

          return (
            <View className="gap-4 mb-10">
              {/* Aircraft Header Card */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 mr-2">
                    <ThemedText type="subtitle" className="text-brand-blue font-bold text-base">
                      {model}
                    </ThemedText>
                    <View className="flex-row items-center gap-3 mt-1">
                      <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        <ThemedText className="text-xs font-bold text-slate-700">
                          {aircraftType}
                        </ThemedText>
                      </View>
                      <ThemedText className="text-xs text-slate-500 font-bold">
                        {registration}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Status Indicator & Separate Edit Button Below */}
                  <View className="items-end gap-3">
                    <View className={`${status.bg} border ${status.border} px-2.5 py-1 rounded-full flex-row items-center gap-1`}>
                      <Ionicons name={status.icon as any} size={12} color={status.iconColor} />
                      <ThemedText className={`text-xs font-bold ${status.text}`}>
                        {status.label}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      onPress={openStatusModal}
                      className="bg-brand-blue/10 border border-brand-blue/20 px-2.5 py-1 rounded-lg flex-row items-center gap-1"
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pencil" size={11} color="#0f1e3d" />
                      <ThemedText className="text-xs font-bold text-brand-blue">
                        Cambiar estado
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Route Card */}
                <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mt-1">
                  <View className="gap-3">
                    {/* Origen Row */}
                    <View className="flex-row items-center gap-2">
                      <View className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                      <View className="flex-1">
                        <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                          Origen
                        </ThemedText>
                        <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                          {reservation.originAirport?.name || reservation.trip.origin_airport_ident}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Connector line & icon */}
                    <View className="flex-row items-center gap-2 pl-0.5 my-0.5">
                      <View className="w-0.5 h-6 bg-slate-300 ml-0.5" />
                      <View className="flex-row items-center gap-1.5 ml-3">
                        <MaterialCommunityIcons name="airplane-takeoff" size={14} color="#C5A059" />
                        {reservation.schedule.roundtrip && (
                          <ThemedText className="text-xs font-medium text-brand-gold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Ida y Vuelta
                          </ThemedText>
                        )}
                      </View>
                    </View>

                    {/* Destino Row */}
                    <View className="flex-row items-center gap-2">
                      <View className="w-2.5 h-2.5 rounded-full bg-brand-blue" />
                      <View className="flex-1">
                        <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                          Destino
                        </ThemedText>
                        <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                          {reservation.destinationAirport?.name || reservation.trip.destination_airport_ident}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Schedule Card (Departure and Arrival times below) */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-3">
                  Itinerario
                </ThemedText>

                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
                  {/* Outbound Section */}
                  <View>
                    <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                      Vuelo de Ida
                    </ThemedText>
                    <View className="gap-1 pl-2 border-l-2 border-brand-gold/40">
                      <View className="flex-row items-center justify-between">
                        <ThemedText className="text-xs text-slate-500 font-medium">Salida:</ThemedText>
                        <ThemedText className="text-xs font-bold text-slate-800">
                          {reservation.schedule.outbound_flight_departure_time.toLocaleString("es-ES", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })} hs
                        </ThemedText>
                      </View>
                      <View className="flex-row items-center justify-between mt-0.5">
                        <ThemedText className="text-xs text-slate-500 font-medium">Llegada estimada:</ThemedText>
                        <ThemedText className="text-xs font-bold text-slate-800">
                          {reservation.schedule.outbound_flight_arrival_time.toLocaleString("es-ES", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })} hs
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {/* Return Section if Roundtrip */}
                  {reservation.schedule.roundtrip && (
                    <>
                      <View className="h-px bg-slate-200 my-1" />
                      <View>
                        <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                          Vuelo de Vuelta
                        </ThemedText>
                        <View className="gap-1 pl-2 border-l-2 border-brand-gold/40">
                          <View className="flex-row items-center justify-between">
                            <ThemedText className="text-xs text-slate-500 font-medium">Salida:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                              {reservation.schedule.return_flight_departure_time
                                ? `${reservation.schedule.return_flight_departure_time.toLocaleString("es-ES", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })} hs`
                                : "N/A"}
                            </ThemedText>
                          </View>
                          <View className="flex-row items-center justify-between mt-0.5">
                            <ThemedText className="text-xs text-slate-500 font-medium">Llegada estimada:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                              {reservation.schedule.return_flight_arrival_time
                                ? `${reservation.schedule.return_flight_arrival_time.toLocaleString("es-ES", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })} hs`
                                : "N/A"}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Extended Specifications List Rows */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm gap-3">
                <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                  Vuelo y Aeronave
                </ThemedText>

                {/* Pasajeros solicitados */}
                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                      <Ionicons name="people-outline" size={18} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                      Pasajeros solicitados
                    </ThemedText>
                  </View>
                  <ThemedText className="text-xs font-bold text-slate-900">
                    {reservation.capacity.passangers} pasajero(s)
                  </ThemedText>
                </View>

                {/* Capacidad de asientos */}
                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                      <MaterialCommunityIcons name="seat-passenger" size={18} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                      Capacidad de asientos
                    </ThemedText>
                  </View>
                  <ThemedText className="text-xs font-bold text-slate-900">
                    {paxCapacity !== undefined ? `${paxCapacity} asientos` : "N/A"}
                  </ThemedText>
                </View>

                {/* Distancia del viaje */}
                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                      <Ionicons name="navigate-outline" size={18} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                      Distancia del viaje
                    </ThemedText>
                  </View>
                  <ThemedText className="text-xs font-bold text-slate-900">
                    {distanceKm ? `${distanceKm} km` : "N/A"}
                  </ThemedText>
                </View>

                {/* Tiempo de vuelo */}
                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                      <Ionicons name="time-outline" size={18} color="#0f1e3d" />
                    </View>
                    <View>
                      <ThemedText className="text-xs font-medium text-slate-600">
                        Tiempo de vuelo
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText className="text-xs font-bold text-slate-900">
                    {formatFlightTime(flightDurationHours)}
                  </ThemedText>
                </View>

                {/* Velocidad de crucero */}
                <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                      <MaterialCommunityIcons name="speedometer" size={18} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                      Velocidad de crucero
                    </ThemedText>
                  </View>
                  <ThemedText className="text-xs font-bold text-slate-900">
                    {cruiseSpeed ? `${cruiseSpeed} nudos` : "N/A"}
                  </ThemedText>
                </View>

                {/* Techo de servicio */}
                <View className="flex-row items-center justify-between py-2">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                      <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                      Techo de servicio
                    </ThemedText>
                  </View>
                  <ThemedText className="text-xs font-bold text-slate-900">
                    {serviceCeiling ? `${serviceCeiling.toLocaleString("es-ES")} pies` : "N/A"}
                  </ThemedText>
                </View>
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {/* Change Status Modal */}
      <Modal
        visible={isStatusModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsStatusModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%] border-t border-slate-200">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <View>
                <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[10px]">
                  Gestión de Operación
                </ThemedText>
                <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                  Cambiar Estado del Vuelo
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => setIsStatusModalVisible(false)}
                className="p-1.5 rounded-full bg-slate-100"
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              <View className="gap-3 py-1">
                {INTERNAL_STATUS_DEFINITIONS.map((def) => {
                  const badge = getStatusBadge(def.id);
                  const isSelected = selectedStatus === def.id;

                  return (
                    <TouchableOpacity
                      key={def.id}
                      onPress={() => setSelectedStatus(def.id)}
                      activeOpacity={0.8}
                      className={`p-4 rounded-2xl border ${isSelected
                        ? "border-brand-blue bg-blue-50/50"
                        : "border-slate-200 bg-white"
                        }`}
                    >
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className={`${badge.bg} border ${badge.border} px-2.5 py-1 rounded-full flex-row items-center gap-1.5`}>
                          <Ionicons name={badge.icon as any} size={12} color={badge.iconColor} />
                          <ThemedText className={`text-xs font-bold ${badge.text}`}>
                            {def.label}
                          </ThemedText>
                        </View>
                        <View
                          className={`w-5 h-5 rounded-full border items-center justify-center ${isSelected
                            ? "border-brand-blue bg-brand-blue"
                            : "border-slate-300 bg-white"
                            }`}
                        >
                          {isSelected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                        </View>
                      </View>

                      <ThemedText className="text-xs text-slate-500 font-medium leading-5 mt-1">
                        {def.hint}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View className="flex-row items-center gap-3 pt-2">
              <TouchableOpacity
                onPress={() => setIsStatusModalVisible(false)}
                className="flex-1 py-3.5 rounded-xl border border-slate-300 items-center justify-center bg-white"
                activeOpacity={0.8}
                disabled={isUpdatingStatus}
              >
                <ThemedText className="text-xs font-bold text-slate-700">Cancelar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUpdateStatus}
                className="flex-1 py-3.5 rounded-xl bg-brand-blue items-center justify-center shadow-sm flex-row gap-2"
                activeOpacity={0.8}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText className="text-xs font-bold text-white">Guardar Estado</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
