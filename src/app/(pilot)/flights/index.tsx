import { FlightSummaryCard } from "@/components/flight-summary-card";
import { PilotHeader } from "@/components/pilot-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { PilotFlightLeg } from "@/types/pilot";
import { airportCityName, airportShortCode } from "@/utils/airport-label";
import { getStatusBadge } from "@/utils/flight-status";
import { buildLegWeatherRequest } from "@/utils/flight-weather";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function FlightPlanScreen() {
  const { user, userData, profileData } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const isEncargado = profileData?.isEncargado === true;
  // Una sola card desplegada a la vez (null = todas colapsadas).
  const [expandedLegId, setExpandedLegId] = useState<string | null>(null);

  const {
    data: reservations = [],
    isLoading,
    refetch,
  } = usePilotReservations(user?.uid);


  // Fallback to email username if names are not loaded
  const displayName =
    userData?.firstName && userData?.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : user?.email?.split("@")[0] || "Piloto";

  // Build separate flight leg objects for outbound and return legs
  const flightLegs = useMemo(() => {
    const legs: PilotFlightLeg[] = [];

    reservations.forEach((res) => {
      // Outbound leg
      const outboundLeg: PilotFlightLeg = {
        id: `${res.id}-outbound`,
        reservationId: res.id,
        legType: "outbound",
        originIdent: res.originAirport?.ident || "",
        destinationIdent: res.destinationAirport?.ident || "",
        originIcaoCode: res.originAirport?.icao_code || "",
        destinationIcaoCode: res.destinationAirport?.icao_code || "",
        departureTime: res.schedule.outbound_flight_departure_time,
        arrivalTime: res.schedule.outbound_flight_arrival_time,
        aircraftId: res.aircraftId,
        aircraftSpecs: res.aircraftSpecs,
        originAirport: res.originAirport,
        destinationAirport: res.destinationAirport,
        paxCount: res.capacity?.passangers || res.aircraftSpecs?.basic_specs?.pax_count || 1,
        reservationDoc: res,
      };
      legs.push(outboundLeg);

      // Return leg if roundtrip
      if (res.schedule.roundtrip && res.schedule.return_flight_departure_time) {
        const returnLeg: PilotFlightLeg = {
          id: `${res.id}-return`,
          reservationId: res.id,
          legType: "return",
          originIdent: res.destinationAirport?.ident || "",
          destinationIdent: res.originAirport?.ident || "",
          originIcaoCode: res.destinationAirport?.icao_code || "",
          destinationIcaoCode: res.originAirport?.icao_code || "",
          departureTime: res.schedule.return_flight_departure_time,
          arrivalTime: res.schedule.return_flight_arrival_time,
          aircraftId: res.aircraftId,
          aircraftSpecs: res.aircraftSpecs,
          originAirport: res.destinationAirport,
          destinationAirport: res.originAirport,
          paxCount: res.capacity?.passangers || res.aircraftSpecs?.basic_specs?.pax_count || 1,
          reservationDoc: res,
        };
        legs.push(returnLeg);
      }
    });

    // Sort legs by departure time ascending (soonest first)
    legs.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());

    return legs;
  }, [reservations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleViewDetails = (leg: PilotFlightLeg) => {
    router.push({
      pathname: "/flights/flight-details",
      params: {
        reservationId: leg.reservationId,
        legType: leg.legType,
        originIdent: leg.originIdent,
        destinationIdent: leg.destinationIdent,
        originIcaoCode: leg.originIcaoCode,
        destinationIcaoCode: leg.destinationIcaoCode,
        departureTime: leg.departureTime.toISOString(),
        aircraftId: leg.aircraftId,
        paxCount: String(leg.paxCount),
      },
    });
  };

  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "Sin confirmar";
    const dateStr = date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} - ${timeStr} hs`;
  };

  const getAirportLabel = (airportObj?: any) => {
    const name = airportObj?.municipality || airportObj?.name || "";
    const code = airportObj?.icao_code ? ` (${airportObj.icao_code})` : (airportObj?.iata_code ? ` (${airportObj.iata_code})` : "");
    return `${name}${code}`;
  };

  return (
    <ThemedView className="flex-1 px-4" style={{ paddingTop: insets.top }}>
      {/* Cabecera con Saludo y Avatar */}
      <PilotHeader
        title="Panel de Piloto"
        subtitle={`Hola, ${displayName.split(" ")[0]}`}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Banner Operativo para Encargado de Aeronave */}
        {isEncargado && (
          <View style={{ marginBottom: 16, gap: 10 }}>
            {/* Primary Action: Nueva Reserva Telefónica */}
            <TouchableOpacity
              onPress={() => router.push("/(pilot)/flights/new-booking" as any)}
              style={{
                backgroundColor: "#030436",
                padding: 16,
                borderRadius: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: "#0165FF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="paper-plane" size={20} color="#030436" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "bold", color: "#FFFFFF" }}>
                    + Nueva Reserva Telefónica
                  </Text>
                  <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    Alta rápida de cliente, cotización y despacho
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#0165FF" />
            </TouchableOpacity>

            {/* Presupuestos (cotizaciones enviadas por WhatsApp) */}
            <TouchableOpacity
              onPress={() => router.push("/(pilot)/flights/quotes" as any)}
              style={{
                backgroundColor: "#EAF3FF",
                borderWidth: 1,
                borderColor: "#7AB4FF",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="document-text-outline" size={18} color="#0165FF" />
                <Text style={{ fontSize: 13, fontWeight: "bold", color: "#030436" }}>
                  Presupuestos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#0165FF" />
            </TouchableOpacity>

            {/* Secondary Action: Gestionar Reservas y Cobros */}
            <TouchableOpacity
              onPress={() => router.push("/(pilot)/flights/reservations" as any)}
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color="#030436" />
                <Text style={{ fontSize: 13, fontWeight: "bold", color: "#030436" }}>
                  Gestionar Reservas y Links de Pago
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        <View className="mb-4 flex-row justify-between items-center">
          <ThemedText type="subtitle" className="text-lg">
            Próximos Vuelos
          </ThemedText>
        </View>

        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#030436" />
            <ThemedText className="text-slate-500 text-sm mt-3">
              Cargando vuelos asignados...
            </ThemedText>
          </View>
        ) : flightLegs.length === 0 ? (
          <View className="bg-brand-white rounded-2xl p-8 border border-slate-100 items-center justify-center my-6">
            <Ionicons name="airplane-outline" size={48} color="#94A3B8" />
            <ThemedText className="font-bold text-lg text-brand-blue mt-3">
              Sin Vuelos Asignados
            </ThemedText>
            <ThemedText className="text-slate-500 text-center text-sm mt-1">
              No tienes vuelos asignados actualmente.
            </ThemedText>
          </View>
        ) : (
          // Cards colapsables: una sola desplegada a la vez
          <View className="mb-8" style={{ gap: 14 }}>
            {flightLegs.map((leg) => {
              const originLabel = getAirportLabel(leg.originAirport);
              const destLabel = getAirportLabel(leg.destinationAirport);
              const routeTitle = `${originLabel} ➔ ${destLabel}`;
              const aircraftReg = leg.aircraftSpecs?.basic_specs?.registration || "Matrícula";
              const aircraftModel = leg.aircraftSpecs?.basic_specs?.model || "Avión";
              const legBadge = leg.legType === "outbound" ? "Vuelo de Ida" : "Vuelo de Vuelta";
              const internalStatus = leg.reservationDoc?.internal_status;

              return (
                <FlightSummaryCard
                  key={leg.id}
                  expanded={expandedLegId === leg.id}
                  onToggle={() => setExpandedLegId(expandedLegId === leg.id ? null : leg.id)}
                  eyebrow={legBadge}
                  originCode={airportShortCode(leg.originAirport, leg.originIdent, "icao")}
                  originName={airportCityName(leg.originAirport)}
                  destinationCode={airportShortCode(leg.destinationAirport, leg.destinationIdent, "icao")}
                  destinationName={airportCityName(leg.destinationAirport)}
                  departureTime={leg.departureTime}
                  status={internalStatus ? getStatusBadge(internalStatus) : undefined}
                  registration={leg.aircraftSpecs?.basic_specs?.registration}
                  passengers={leg.paxCount}
                  weatherRequest={buildLegWeatherRequest({
                    internalStatus,
                    originAirport: leg.originAirport,
                    destinationAirport: leg.destinationAirport,
                    departureTime: leg.departureTime,
                    arrivalTime: leg.arrivalTime,
                  })}
                  weatherDetail
                >
                  <View style={styles.legInfoBox}>
                    <View style={styles.legInfoRow}>
                      <ThemedText style={styles.legInfoLabel}>{legBadge}</ThemedText>
                      <ThemedText style={styles.legInfoValue} numberOfLines={1}>
                        {aircraftModel ? `${aircraftModel} (${aircraftReg})` : aircraftReg}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.legRoute}>{routeTitle}</ThemedText>
                    <View style={styles.legInfoRow}>
                      <ThemedText style={styles.legInfoLabel}>Fecha y Hora</ThemedText>
                      <ThemedText style={styles.legInfoValue}>{formatDate(leg.departureTime)}</ThemedText>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleViewDetails(leg)}
                    style={styles.viewMoreButton}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.viewMoreText}>Ver más</ThemedText>
                    <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </FlightSummaryCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  legInfoBox: {
    backgroundColor: "#F5F8FD",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  legInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  legInfoLabel: {
    fontSize: 11,
    color: "#5B5D7A",
    fontFamily: "NotoSans_600SemiBold",
    textTransform: "uppercase",
  },
  legInfoValue: {
    fontSize: 12,
    color: "#030436",
    fontFamily: "NotoSans_600SemiBold",
    flexShrink: 1,
    textAlign: "right",
  },
  legRoute: {
    fontSize: 14,
    color: "#030436",
    fontFamily: "NotoSans_700Bold",
  },
  viewMoreButton: {
    backgroundColor: "#0165FF",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  viewMoreText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "NotoSans_600SemiBold",
  },
});
