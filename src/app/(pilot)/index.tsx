import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { useAuth } from "@/hooks/useAuth";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { PilotFlightLeg } from "@/types/pilot";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

export default function FlightPlanScreen() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

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
        originIdent: res.originAirport?.icao_code || "",
        destinationIdent: res.destinationAirport?.icao_code || "",
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
          originIdent: res.destinationAirport?.icao_code || "",
          destinationIdent: res.originAirport?.icao_code || "",
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
      pathname: "/flight-details",
      params: {
        reservationId: leg.reservationId,
        legType: leg.legType,
        originIdent: leg.originIdent,
        destinationIdent: leg.destinationIdent,
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
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Cabecera con Saludo y Avatar */}
      <View className="flex-row justify-between items-center mb-6 mt-2">
        <View>
          <ThemedText
            type="caption"
            className="uppercase font-bold text-brand-gold tracking-widest text-xs"
          >
            Panel de Piloto
          </ThemedText>
          <ThemedText type="title" className="text-2xl font-bold mt-0.5">
            Hola, {displayName.split(" ")[0]}
          </ThemedText>
        </View>

        <UserAvatar size={44} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="mb-4 flex-row justify-between items-center">
          <ThemedText type="subtitle" className="text-lg">
            Próximos Vuelos
          </ThemedText>
        </View>

        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#0f1e3d" />
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
          // Next flight card
          <View className="space-y-4 mb-8">
            {flightLegs.map((leg) => {
              const originLabel = getAirportLabel(leg.originAirport);
              const destLabel = getAirportLabel(leg.destinationAirport);
              const routeTitle = `${originLabel} ➔ ${destLabel}`;
              const aircraftReg = leg.aircraftSpecs?.basic_specs?.registration || "Matrícula";
              const aircraftModel = leg.aircraftSpecs?.basic_specs?.model || "Avión";
              const legBadge = leg.legType === "outbound" ? "Vuelo de Ida" : "Vuelo de Vuelta";

              return (
                <View
                  key={leg.id}
                  className="bg-brand-blue rounded-2xl p-5 mb-4 shadow-md relative overflow-hidden"
                >
                  {/* Fondo decorativo sutil */}
                  <View className="absolute right-[-20px] bottom-[-15px] opacity-10">
                    <Ionicons name="airplane" size={150} color="#FFFFFF" />
                  </View>

                  <View className="flex-row justify-between items-center mb-1">
                    <ThemedText className="text-slate-300 uppercase font-semibold text-xs tracking-wider">
                      {legBadge}
                    </ThemedText>
                    {aircraftModel ? (
                      <ThemedText className="text-slate-300 text-xs font-medium">
                        {aircraftModel} ({aircraftReg})
                      </ThemedText>
                    ) : (
                      <ThemedText className="text-slate-300 text-xs font-medium">
                        {aircraftReg}
                      </ThemedText>
                    )}
                  </View>

                  <ThemedText className="text-white font-bold text-lg mb-4">
                    {routeTitle}
                  </ThemedText>

                  <View className="flex-row justify-between items-center border-t border-white/10 pt-3">
                    <View>
                      <ThemedText className="text-slate-300 text-xs">Fecha y Hora</ThemedText>
                      <ThemedText className="text-white text-sm font-semibold mt-0.5">
                        {formatDate(leg.departureTime)}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleViewDetails(leg)}
                      className="bg-brand-gold px-4 py-2.5 rounded-xl flex-row items-center gap-1 shadow-sm"
                    >
                      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                      <ThemedText className="text-white font-semibold text-sm">
                        Ver más
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
