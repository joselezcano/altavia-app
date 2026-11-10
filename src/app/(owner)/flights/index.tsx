import { FlightSummaryCard } from "@/components/flight-summary-card";
import { LoadingCard } from "@/components/loading-card";
import { OwnerHeader } from "@/components/owner-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserModal } from "@/components/UserModal";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerAircrafts } from "@/hooks/useOwnerAircrafts";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { airportCityName, airportShortCode } from "@/utils/airport-label";
import { getStatusBadge } from "@/utils/flight-status";
import { buildReservationWeatherRequest } from "@/utils/flight-weather";
import { roleFlightRoute, toHref } from "@/utils/role-routes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  // Una sola card desplegada a la vez (null = todas colapsadas).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isLoading = isLoadingAircrafts || isLoadingReservations;

  // Filter reservations by selected aircraft and status
  const filteredReservations = reservations.filter((flight) => {
    const matchesAircraft =
      selectedAircraftId === "all" || flight.aircraftId === selectedAircraftId;
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "pending"
        ? ["pending", "pending_approval"].includes(flight.internal_status)
        : selectedStatus === "in_progress"
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

      {/* Nueva reserva telefónica (alta rápida de cliente, cotización y despacho) y presupuestos */}
      <View style={styles.bookingActionsRow}>
        <TouchableOpacity
          onPress={() => {
            const route = roleFlightRoute(role, "new-booking");
            if (route) router.push(toHref(route));
          }}
          style={[styles.newBookingButton, styles.newBookingButtonInRow]}
          activeOpacity={0.8}
        >
          <View style={styles.newBookingIcon}>
            <Ionicons name="paper-plane" size={18} color="#030436" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newBookingTitle}>+ Nueva Reserva</Text>
            <Text style={styles.newBookingSubtitle}>Alta rápida de cliente, cotización y despacho</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#0165FF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const route = roleFlightRoute(role, "quotes");
            if (route) router.push(toHref(route));
          }}
          style={styles.quotesButton}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={20} color="#0165FF" />
          <Text style={styles.quotesButtonText}>Presupuestos</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      <View className="mb-4" style={{ gap: 12 }}>
        {/* Aircraft Filter */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
            <TouchableOpacity
              onPress={() => setSelectedAircraftId("all")}
              className="px-4 py-2 rounded-full mr-2 border"
              style={{
                backgroundColor: selectedAircraftId === "all" ? "#030436" : "#FFFFFF",
                borderColor: selectedAircraftId === "all" ? "#030436" : "#E2E8F0",
              }}
            >
              <ThemedText
                className="text-xs font-semibold"
                style={{ color: selectedAircraftId === "all" ? "#FFFFFF" : "#475569" }}
              >
                Todas las Aeronaves
              </ThemedText>
            </TouchableOpacity>

            {aircrafts.map((ac) => {
              const isSelected = selectedAircraftId === ac.id;
              return (
                <TouchableOpacity
                  key={ac.id}
                  onPress={() => setSelectedAircraftId(ac.id)}
                  className="px-4 py-2 rounded-full mr-2 border"
                  style={{
                    backgroundColor: isSelected ? "#030436" : "#FFFFFF",
                    borderColor: isSelected ? "#030436" : "#E2E8F0",
                  }}
                >
                  <ThemedText
                    className="text-xs font-semibold"
                    style={{ color: isSelected ? "#FFFFFF" : "#475569" }}
                  >
                    {ac.basic_specs?.registration} ({ac.basic_specs?.type})
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Status Filter */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
            {STATUS_OPTIONS.map((status) => {
              const isSelected = selectedStatus === status.id;
              return (
                <TouchableOpacity
                  key={status.id}
                  onPress={() => setSelectedStatus(status.id)}
                  className="px-4 py-2 rounded-full mr-2 border"
                  style={{
                    backgroundColor: isSelected ? "#0165FF" : "#FFFFFF",
                    borderColor: isSelected ? "#0165FF" : "#E2E8F0",
                  }}
                >
                  <ThemedText
                    className="text-xs font-semibold"
                    style={{ color: isSelected ? "#FFFFFF" : "#475569" }}
                  >
                    {status.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#030436" />
        }
      >
        {isLoading
          ? <LoadingCard message="Cargando las reservas de su flota..." />
          : reservations.length === 0 ? (
            <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6">
              <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 border border-slate-200">
                <Ionicons name="airplane-outline" size={32} color="#94a3b8" />
              </View>
              <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                No hay vuelos reservados
              </ThemedText>
            </View>
          ) : filteredReservations.length === 0 ? (
            <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6">
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
            <View className="mb-10" style={{ gap: 16 }}>
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
                  <FlightSummaryCard
                    key={item.id}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
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
                    weatherDetail
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

                    {/* Action Buttons */}
                    {(item.internal_status === "pending_approval" || item.internal_status === "pending") && (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(owner)/flights/assign-pilots", params: { reservationId: item.id } })}
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
                        <MaterialCommunityIcons name="account-tie-hat" size={18} color="#FFFFFF" />
                        <ThemedText className="text-xs font-bold text-white">Asignar Tripulación y Aprobar</ThemedText>
                        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}

                    {/* Detalles Button */}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/flights/flight-details", params: { reservationId: item.id } })}
                      className="bg-brand-blue py-3 px-4 rounded-xl flex-row items-center justify-center"
                      style={{ gap: 6 }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
                      <ThemedText className="text-xs font-bold text-white">Más Información</ThemedText>
                      <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </FlightSummaryCard>
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

const styles = StyleSheet.create({
  bookingActionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 12,
  },
  newBookingButtonInRow: {
    flex: 1,
    marginBottom: 0,
  },
  quotesButton: {
    width: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#7AB4FF",
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  quotesButtonText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#030436",
    textAlign: "center",
  },
  newBookingButton: {
    backgroundColor: "#030436",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  newBookingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#0165FF",
    alignItems: "center",
    justifyContent: "center",
  },
  newBookingTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  newBookingSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
});
