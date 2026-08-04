import { LoadingCard } from "@/components/loading-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { useAuth } from "@/hooks/useAuth";
import { useFlightPlanByReservation } from "@/hooks/useFlightPlanByReservation";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { useReservationPilots } from "@/hooks/useReservationPilots";
import { ClientReservationItem } from "@/types/all-roles";
import { getStatusBadge } from "@/utils/flight-status";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


const getAirportLabel = (airportIdent: string, reservation: ClientReservationItem) => {
  return reservation.originAirport?.ident === airportIdent ? reservation.originAirport?.name : reservation.destinationAirport?.name;
};


export default function PilotFlightDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    reservationId?: string;
    legType?: string;
    originIdent?: string;
    destinationIdent?: string;
    originIcaoCode?: string;
    destinationIcaoCode?: string;
    departureTime?: string;
    aircraftId?: string;
    paxCount?: string;
  }>();

  const { data: reservations = [], isLoading } = usePilotReservations(user?.uid);

  const reservation = useMemo(() => {
    if (!params.reservationId || !reservations.length) return null;
    return reservations.find((r) => r.id === params.reservationId) || null;
  }, [params.reservationId, reservations]);

  const targetAircraftId = params.aircraftId || reservation?.aircraftId;
  const { data: aircraft, isLoading: isLoadingAircraft } = useAircraftDetails(targetAircraftId);
  const { data: assignedPilots = [], isLoading: isLoadingPilots } = useReservationPilots(reservation?.pilot_ids);

  const targetReservationId = params.reservationId || reservation?.id;
  const { data: existingFlightPlan } = useFlightPlanByReservation(
    targetReservationId,
    params.originIdent,
    params.destinationIdent
  );

  const formatFlightTime = (hours: number) => {
    if (!hours || isNaN(hours) || hours <= 0) return "N/A";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  };

  const handleCreateFlightPlan = () => {
    if (!reservation && !params.reservationId) return;

    if (existingFlightPlan) {
      router.push({
        pathname: "./view-flight-plan",
        params: {
          flightPlanId: existingFlightPlan.id,
          aircraftModel: aircraft?.basic_specs.model,
        },
      });
    } else {
      router.push({
        pathname: "/flights/create-flight-plan",
        params: {
          reservationId: targetReservationId,
          legType: params.legType || "outbound",
          originIdent: params.originIdent || "",
          destinationIdent: params.destinationIdent || "",
          originIcaoCode: params.originIcaoCode || "",
          destinationIcaoCode: params.destinationIcaoCode || "",
          departureTime:
            params.departureTime ||
            reservation?.schedule?.outbound_flight_departure_time?.toISOString() ||
            new Date().toISOString(),
          aircraftId: targetAircraftId || "",
          paxCount: params.paxCount || String(reservation?.capacity?.passangers || 1),
        },
      });
    }
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
              router.replace("/(pilot)/flights");
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
          {/* Plan de Vuelo Button */}
          <TouchableOpacity
            onPress={handleCreateFlightPlan}
            className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
              Plan de Vuelo
            </ThemedText>
          </TouchableOpacity>

          {/* Aeronave Button */}
          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: "./aircraft-details",
                params: { id: targetAircraftId },
              });
            }}
            className="bg-brand-blue py-3 px-4 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="airplane-outline" size={18} color="#FFFFFF" />
            <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
              Aeronave
            </ThemedText>
          </TouchableOpacity>

          {/* Clima Button (No Action) */}
          <TouchableOpacity
            onPress={() => { }}
            className="bg-brand-blue py-3 px-5 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="partly-sunny-outline" size={18} color="#FFFFFF" />
            <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
              Clima
            </ThemedText>
          </TouchableOpacity>

          {/* Tracking Button */}
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/flights/flight-tracker",
                params: { fa_flight_id: reservation.fa_flight_id ?? "" },
              })
            }
            className="bg-brand-blue py-3 px-4 rounded-xl items-center justify-center gap-1 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={18} color="#FFFFFF" />
            <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
              Tracking
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

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
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace("/(pilot)/flights");
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
            const cruiseSpeed = existingFlightPlan?.flight_plan.route.cruising_speed_knots ? existingFlightPlan?.flight_plan.route.cruising_speed_knots : reservation.aircraftSpecs?.operating_specs?.cruise_speed_knots;
            const serviceCeilingLabel = existingFlightPlan?.flight_plan.route.cruising_altitude_feet ? "Altitud de vuelo" : "Techo de servicio";
            const serviceCeiling = existingFlightPlan?.flight_plan.route.cruising_altitude_feet ? existingFlightPlan?.flight_plan.route.cruising_altitude_feet : reservation.aircraftSpecs?.operating_specs?.service_ceiling_feet;
            const paxCapacity = reservation.aircraftSpecs?.basic_specs?.pax_count;
            const originAirportLabel = params.originIdent ? getAirportLabel(params.originIdent, reservation) : "";
            const destinationAirportLabel = params.destinationIdent ? getAirportLabel(params.destinationIdent, reservation) : "";

            // Flight duration computation
            let outboundMs = 0;
            if (existingFlightPlan?.flight_plan.departure.datetime_utc && existingFlightPlan.flight_plan.arrival.datetime_utc) {
              outboundMs = new Date(existingFlightPlan.flight_plan.arrival.datetime_utc).getTime() - new Date(existingFlightPlan.flight_plan.departure.datetime_utc).getTime();
            } else {
              outboundMs = reservation.schedule.outbound_flight_arrival_time.getTime() - reservation.schedule.outbound_flight_departure_time.getTime();
            }
            const flightDurationHours = outboundMs > 0
              ? outboundMs / (3600 * 1000)
              : (reservation.distance_nm && cruiseSpeed ? reservation.distance_nm / cruiseSpeed : 0);

            const flight_departure_time = existingFlightPlan?.flight_plan.departure.datetime_utc ? new Date(existingFlightPlan.flight_plan.departure.datetime_utc) : (reservation.originAirport?.ident === params.originIdent ? reservation.schedule.outbound_flight_departure_time : reservation.schedule.return_flight_departure_time);
            const flight_arrival_time = existingFlightPlan?.flight_plan.arrival.datetime_utc ? new Date(existingFlightPlan.flight_plan.arrival.datetime_utc) : (reservation.originAirport?.ident === params.originIdent ? reservation.schedule.outbound_flight_arrival_time : reservation.schedule.return_flight_arrival_time);

            return (
              <View className="gap-4 mb-10">
                {/* Aircraft Header Card (Without Cambiar Estado button) */}
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

                    {/* Status Indicator Badge Only */}
                    <View className="items-end">
                      <View className={`${status.bg} border ${status.border} px-2.5 py-1 rounded-full flex-row items-center gap-1`}>
                        <Ionicons name={status.icon as any} size={12} color={status.iconColor} />
                        <ThemedText className={`text-xs font-bold ${status.text}`}>
                          {status.label}
                        </ThemedText>
                      </View>
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
                            {originAirportLabel}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Connector line & icon */}
                      <View className="flex-row items-center gap-2 pl-0.5 my-0.5">
                        <View className="w-0.5 h-6 bg-slate-300 ml-0.5" />
                        <View className="flex-row items-center gap-1.5 ml-3">
                          <MaterialCommunityIcons name={reservation.originAirport?.ident === params.originIdent ? "airplane-takeoff" : "airplane-landing"} size={14} color="#C5A059" />
                          <ThemedText className="text-xs font-medium text-brand-gold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{reservation.originAirport?.ident === params.originIdent ? "Ida" : "Vuelta"}</ThemedText>
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
                            {destinationAirportLabel}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Schedule Card */}
                <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                  <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-3">
                    Itinerario
                  </ThemedText>

                  <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
                    <View>
                      <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                        {reservation.originAirport?.ident === params.originIdent ? "Vuelo de Ida" : "Vuelo de Vuelta"}
                      </ThemedText>
                      <View className="gap-1 pl-2 border-l-2 border-brand-gold/40">
                        <View className="flex-row items-center justify-between">
                          <ThemedText className="text-xs text-slate-500 font-medium">Salida:</ThemedText>
                          <ThemedText className="text-xs font-bold text-slate-800">
                            {flight_departure_time
                              ? `${flight_departure_time.toLocaleString("es-ES", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })} hs`
                              : "N/A"}
                          </ThemedText>
                        </View>
                        <View className="flex-row items-center justify-between mt-0.5">
                          <ThemedText className="text-xs text-slate-500 font-medium">Llegada estimada:</ThemedText>
                          <ThemedText className="text-xs font-bold text-slate-800">
                            {flight_arrival_time
                              ? `${flight_arrival_time.toLocaleString("es-ES", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })} hs`
                              : "N/A"}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Card: Pilotos */}
                <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                  <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-3">
                    Pilotos
                  </ThemedText>

                  {isLoadingPilots ? (
                    <View className="py-4 items-center justify-center">
                      <ActivityIndicator size="small" color="#0f1e3d" />
                    </View>
                  ) : !assignedPilots || assignedPilots.length === 0 ? (
                    <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 items-center justify-center">
                      <ThemedText className="text-xs text-slate-500 font-medium text-center">
                        Sin pilotos asignados
                      </ThemedText>
                    </View>
                  ) : (
                    <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
                      {assignedPilots.map((pilot, index) => {
                        const firstName = pilot.basic?.id_first_name || pilot.user?.firstName || "";
                        const lastName = pilot.basic?.id_last_name || pilot.user?.lastName || "";
                        const licenceType = pilot.aeronautical?.licence_type || "Sin tipo de licencia";

                        return (
                          <View key={pilot.user?.uid || index}>
                            {index > 0 && <View className="h-px bg-slate-200 my-2" />}
                            <View className="flex-row items-center justify-between">
                              <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                                <MaterialCommunityIcons name="account-tie-hat" size={18} color="#0f1e3d" />
                              </View>
                              <View className="flex-col items-start gap-1 flex-1 mx-3">
                                <ThemedText className="text-xs font-bold text-slate-800 flex-1" numberOfLines={1}>
                                  {firstName}
                                </ThemedText>
                                <ThemedText className="text-xs font-bold text-slate-800 flex-1" numberOfLines={1}>
                                  {lastName}
                                </ThemedText>
                              </View>
                              <View className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                <ThemedText className="text-xs font-semibold text-slate-700">
                                  {licenceType}
                                </ThemedText>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
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
                        {serviceCeilingLabel}
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
    </ThemedView>
  );
}
