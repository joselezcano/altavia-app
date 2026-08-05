import { LoadingCard } from "@/components/loading-card";
import { OwnerHeader } from "@/components/owner-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserModal } from "@/components/UserModal";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerAircrafts } from "@/hooks/useOwnerAircrafts";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { getStatusBadge } from "@/utils/flight-status";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function OwnerFlightsScreen() {
  const { user, role } = useAuth();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Filter states
  const [selectedAircraftId, setSelectedAircraftId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Fetch Owner's aircrafts
  const {
    data: aircrafts = [],
    isLoading: isLoadingAircrafts,
  } = useOwnerAircrafts(user?.uid);

  // Fetch all reservations
  const {
    data: reservations = [],
    isLoading: isLoadingReservations,
    isRefetching,
    refetch,
  } = useOwnerReservations(user?.uid);

  const [modalVisible, setModalVisible] = useState(false);

  const isLoading = isLoadingAircrafts || isLoadingReservations;

  // Filter reservations by selected aircraft and status
  const filteredReservations = reservations.filter((flight) => {
    const matchesAircraft =
      selectedAircraftId === "all" || flight.aircraftId === selectedAircraftId;
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "in_progress"
        ? ["delayed", "in_flight", "no_show"].includes(flight.internal_status)
        : flight.internal_status === selectedStatus);
    return matchesAircraft && matchesStatus;
  });

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  const STATUS_OPTIONS = [
    { id: "all", label: "Todos los Estados" },
    { id: "pending", label: "Pendientes" },
    { id: "confirmed", label: "Confirmados" },
    { id: "in_progress", label: "En Progreso" },
    { id: "completed", label: "Completados" },
    { id: "canceled", label: "Cancelados" },
  ];

  return (
    <ThemedView className="flex-1 px-4" style={{ paddingTop: insets.top }}>
      {/* Top Header */}
      <OwnerHeader
        title="Historial de Reservas"
        subtitle="Vuelos de mi Flota"
        onMenuPress={() => navigation.openDrawer()}
        onActionButtonPress={() => setModalVisible(true)}
        userInitial={userInitial}
      />

      {/* Filters Section */}
      <View className="mb-4 gap-3">
        {/* Aircraft Filter */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
            <TouchableOpacity
              onPress={() => setSelectedAircraftId("all")}
              className={`px-4 py-2 rounded-full mr-2 border ${selectedAircraftId === "all"
                ? "bg-brand-blue border-brand-blue"
                : "bg-white border-slate-200"
                }`}
            >
              <ThemedText
                className={`text-xs font-semibold ${selectedAircraftId === "all" ? "text-white" : "text-slate-600"
                  }`}
              >
                Todas las Aeronaves
              </ThemedText>
            </TouchableOpacity>

            {aircrafts.map((ac) => (
              <TouchableOpacity
                key={ac.id}
                onPress={() => setSelectedAircraftId(ac.id)}
                className={`px-4 py-2 rounded-full mr-2 border ${selectedAircraftId === ac.id
                  ? "bg-brand-blue border-brand-blue"
                  : "bg-white border-slate-200"
                  }`}
              >
                <ThemedText
                  className={`text-xs font-semibold ${selectedAircraftId === ac.id ? "text-white" : "text-slate-600"
                    }`}
                >
                  {ac.basic_specs?.registration} ({ac.basic_specs?.type})
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Status Filter */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status.id}
                onPress={() => setSelectedStatus(status.id)}
                className={`px-4 py-2 rounded-full mr-2 border ${selectedStatus === status.id
                  ? "bg-brand-gold border-brand-gold"
                  : "bg-white border-slate-200"
                  }`}
              >
                <ThemedText
                  className={`text-xs font-semibold ${selectedStatus === status.id ? "text-white" : "text-slate-600"
                    }`}
                >
                  {status.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0f1e3d" />
        }
      >
        {isLoading
          ? <LoadingCard message="Cargando las reservas de su flota..." />
          : reservations.length === 0 ? (
            <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
              <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 border border-slate-200">
                <Ionicons name="airplane-outline" size={32} color="#94a3b8" />
              </View>
              <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                No hay vuelos reservados
              </ThemedText>
            </View>
          ) : filteredReservations.length === 0 ? (
            <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
              <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 border border-slate-200">
                <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
              </View>
              <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                Sin resultados
              </ThemedText>
              <ThemedText className="text-slate-400 mt-2 text-center text-xs font-medium">
                No hay vuelos que coincidan con los filtros seleccionados.
              </ThemedText>
            </View>
          ) : (
            <View className="gap-4 mb-10">
              {filteredReservations.map((item) => {
                const status = getStatusBadge(item.internal_status);
                const model = item.aircraftSpecs?.basic_specs?.model || "Aeronave";
                const registration = item.aircraftSpecs?.basic_specs?.registration || "N/A";
                const distanceKm = item.distance_nm ? (item.distance_nm * 1.852).toFixed(0) : undefined;
                const hasBothIata = Boolean(
                  item.originAirport?.iata_code?.trim() && item.destinationAirport?.iata_code?.trim()
                );
                const aircraftPaxCapacity = item.aircraftSpecs?.basic_specs?.pax_count;

                return (
                  <View
                    key={item.id}
                    className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm"
                  >
                    {/* Card Header: Aircraft info & status badge */}
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 mr-2">
                        <ThemedText type="subtitle" className="text-brand-blue font-bold text-sm">
                          {model}
                        </ThemedText>
                        <ThemedText className="text-xs text-slate-500 font-bold mt-0.5">
                          {registration}
                        </ThemedText>
                      </View>

                      <View className={`${status.bg} border ${status.border} px-2.5 py-1 rounded-full flex-row items-center gap-1`}>
                        <Ionicons name={status.icon as any} size={12} color={status.iconColor} />
                        <ThemedText className={`text-xs font-bold ${status.text}`}>
                          {status.label}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Route Card */}
                    <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-3">
                      {hasBothIata ? (
                        <View className="flex-row justify-between items-center mb-3">
                          <View className="flex-1">
                            <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                              Origen
                            </ThemedText>
                            <ThemedText className="text-lg font-bold text-brand-blue">
                              {item.originAirport!.iata_code}
                            </ThemedText>
                          </View>

                          <View className="items-center px-2">
                            <MaterialCommunityIcons name="airplane-takeoff" size={18} color="#C5A059" />
                            <View className="w-12 h-0.5 bg-slate-300 my-1" />
                            {item.schedule.roundtrip && (
                              <ThemedText className="text-xs font-medium text-brand-gold">
                                Ida y Vuelta
                              </ThemedText>
                            )}
                          </View>

                          <View className="flex-1 items-end">
                            <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                              Destino
                            </ThemedText>
                            <ThemedText className="text-lg font-bold text-brand-blue">
                              {item.destinationAirport!.iata_code}
                            </ThemedText>
                          </View>
                        </View>
                      ) : (
                        <View className="gap-3 mb-3">
                          {/* Origen Row */}
                          <View className="flex-row items-center gap-2">
                            <View className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                            <View className="flex-1">
                              <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                                Origen
                              </ThemedText>
                              <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                                {item.originAirport?.name || item.trip.origin_airport_ident}
                              </ThemedText>
                            </View>
                          </View>

                          {/* Connector line & icon */}
                          <View className="flex-row items-center gap-2 pl-0.5 my-0.5">
                            <View className="w-0.5 h-6 bg-slate-300 ml-0.5" />
                            <View className="flex-row items-center gap-1.5 ml-3">
                              <MaterialCommunityIcons name="airplane-takeoff" size={14} color="#C5A059" />
                              {item.schedule.roundtrip && (
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
                                {item.destinationAirport?.name || item.trip.destination_airport_ident}
                              </ThemedText>
                            </View>
                          </View>
                        </View>
                      )}

                      <View className="h-px bg-slate-200/60 my-2" />

                      {/* Schedule dates list */}
                      <View className="gap-1.5">
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
                            <View className="h-px bg-slate-200/40 my-1" />
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
                    <View className="flex-row justify-between items-center pt-1 px-1">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="people-outline" size={16} color="#0f1e3d" />
                        <ThemedText className="text-xs font-semibold text-slate-700">
                          {item.capacity.passangers} pasajero(s)
                        </ThemedText>
                      </View>

                      <View className="flex-row items-center gap-1.5">
                        <MaterialCommunityIcons name="seat-passenger" size={16} color="#0f1e3d" />
                        <ThemedText className="text-xs font-semibold text-slate-700">
                          {aircraftPaxCapacity !== undefined ? `${aircraftPaxCapacity} asientos` : "N/A"}
                        </ThemedText>
                      </View>

                      {distanceKm ? (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="navigate-outline" size={16} color="#0f1e3d" />
                          <ThemedText className="text-xs font-semibold text-slate-700">
                            {distanceKm} km
                          </ThemedText>
                        </View>
                      ) : (
                        <View />
                      )}
                    </View>

                    {/* Detalles Button */}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/flights/flight-details", params: { reservationId: item.id } })}
                      className="mt-4 shadow-sm bg-brand-blue py-3 px-4 rounded-xl flex-row items-center justify-center gap-1.5"
                      activeOpacity={0.8}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
                      <ThemedText className="text-xs font-bold text-white">Más Información</ThemedText>
                      <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
      </ScrollView>

      {/* Profile Bottom Sheet Modal */}
      <UserModal modalVisible={modalVisible} setModalVisible={setModalVisible} user={user} role={role} userInitial={userInitial} />
    </ThemedView>
  );
}