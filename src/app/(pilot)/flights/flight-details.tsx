import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { useAuth } from "@/hooks/useAuth";
import { useFlightPlanByReservation } from "@/hooks/useFlightPlanByReservation";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { useReservationPilots } from "@/hooks/useReservationPilots";
import { getStatusBadge } from "@/utils/flight-status";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// OACI / Spec Translations & Descriptions for Aircraft Details Modal

const FLIGHT_RULES_MAP: Record<string, string> = {
  IFR: "IFR (Reglas de Vuelo por Instrumentos)",
  VFR: "VFR (Reglas de Vuelo Visual)",
  Y: "Y (IFR primero, luego VFR)",
  Z: "Z (VFR primero, luego IFR)",
};

const WAKE_TURBULENCE_MAP: Record<string, string> = {
  L: "L (Ligera - ≤ 7,000 kg)",
  M: "M (Media - 7,000 a 136,000 kg)",
  H: "H (Pesada - ≥ 136,000 kg)",
  J: "J (Super - Airbus A380-800)",
};

const TRANSPONDER_MAP: Record<string, string> = {
  A: "Modo A (sin altitud)",
  C: "Modo A/C (con altitud de presión)",
  S: "Modo S (altitud e identificación)",
  E: "Modo S con Extended Squitter (ADS-B Out)",
  H: "Modo S con Enhanced Surveillance",
  L: "Modo S con Enhanced Surveillance & Extended Squitter (ADS-B Out)",
  I: "Modo S con ACID (sin altitud de presión)",
  P: "Modo S con altitud de presión (sin ACID)",
  X: "Modo S sin ACID ni altitud de presión",
};

const EQUIPMENT_MAP: Record<string, string> = {
  D: "DME instalado",
  F: "ADF instalado",
  G: "GNSS instalado",
  I: "ILS instalado",
  O: "VOR / Örn instalado",
  P: "TACAN instalado",
  R: "Radioaltímetro instalado",
  S: "Transponder Modo S instalado",
  T: "Transponder Modo A/C instalado",
  U: "SSR Transponder Modo S instalado",
  X: "Transponder Modo X instalado",
  Z: "Sin ADS-B Out",
};

const RADIO_EQUIPMENT_MAP: Record<string, string> = {
  N: "Nil (Ningún equipo)",
  S: "Estándar (VHF, VOR e ILS)",
  V: "VHF RTF (Voz VHF estándar)",
  Y: "VHF espaciado 8.33 kHz (Obligatorio en Europa)",
  H: "HF RTF (Voz HF para rutas de larga distancia)",
  U: "UHF RTF (Frecuencia militar UHF)",
  Z: "Otro equipo (Ver detalles en Item 18)",
  J1: "CPDLC ATN VDL Modo 2",
  J2: "CPDLC FANS 1/A HFDL",
  J3: "CPDLC FANS 1/A VDL Modo A",
  J4: "CPDLC FANS 1/A VDL Modo 2",
  J5: "CPDLC FANS 1/A SATCOM (Inmarsat)",
  J6: "CPDLC FANS 1/A SATCOM (MTSAT)",
  J7: "CPDLC FANS 1/A SATCOM (Iridium)",
  M1: "ATC Satvoice via Inmarsat",
  M2: "ATC Satvoice via MTSAT",
  M3: "ATC Satvoice via Iridium",
};

const SURVIVAL_EQUIPMENT_MAP: Record<string, string> = {
  P: "Polar (Clima ártico/nieve)",
  D: "Desert (Desierto y alta temperatura)",
  M: "Maritime (Marítimo y mar abierto)",
  J: "Jungle (Selva y vegetación densa)",
};

const LIFE_JACKETS_MAP: Record<string, string> = {
  L: "Luz de localización (Light)",
  F: "Fluoresceína (Marcador de color)",
  U: "Radio baliza UHF",
  V: "Radio transmisor VHF",
};

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex-row justify-between py-2.5 border-b border-slate-100 items-start">
      <ThemedText type="caption" className="text-slate-500 font-medium mr-4">
        {label}
      </ThemedText>
      <ThemedText className="font-semibold text-slate-700 text-right flex-1">
        {value}
      </ThemedText>
    </View>
  );
};

const BadgesList = ({
  label,
  items,
  map,
}: {
  label: string;
  items: string[] | string | undefined | null;
  map: Record<string, string>;
}) => {
  const list = Array.isArray(items)
    ? items
    : typeof items === "string" && items.trim() !== ""
      ? items.split(/[\s,]+/).filter(Boolean)
      : [];

  const hasItems = list.length > 0;
  return (
    <View className="py-2.5 border-b border-slate-100">
      <ThemedText type="caption" className="text-slate-500 font-medium mb-1.5">
        {label}
      </ThemedText>
      {hasItems ? (
        <View className="flex-row flex-wrap gap-1.5 mt-0.5">
          {list.map((item, idx) => (
            <View
              key={`${item}-${idx}`}
              className="bg-slate-100 border border-slate-200/65 px-2.5 py-1 rounded-md"
            >
              <ThemedText className="text-xs font-semibold text-slate-700">
                {item} - {map[item] || item}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : (
        <ThemedText className="font-semibold text-slate-400 italic">
          Ninguno
        </ThemedText>
      )}
    </View>
  );
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
    departureTime?: string;
    aircraftId?: string;
    paxCount?: string;
  }>();

  const [isAircraftModalVisible, setIsAircraftModalVisible] = useState(false);

  const { data: reservations = [], isLoading } = usePilotReservations(user?.uid);

  const reservation = useMemo(() => {
    if (!params.reservationId || !reservations.length) return null;
    return reservations.find((r) => r.id === params.reservationId) || null;
  }, [params.reservationId, reservations]);

  const targetAircraftId = params.aircraftId || reservation?.aircraftId;
  const { data: aircraft, isLoading: isLoadingAircraft } = useAircraftDetails(targetAircraftId);
  const { data: assignedPilots = [], isLoading: isLoadingPilots } = useReservationPilots(reservation?.pilot_ids);

  const targetReservationId = params.reservationId || reservation?.id;
  const { data: existingFlightPlan } = useFlightPlanByReservation(targetReservationId);

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
        pathname: "/flights/view-flight-plan",
        params: {
          flightPlanId: existingFlightPlan.id,
          reservationId: targetReservationId,
          aircraftModel: aircraft?.basic_specs.model,
        },
      });
    } else {
      router.push({
        pathname: "/flights/create-flight-plan",
        params: {
          reservationId: targetReservationId,
          legType: params.legType || "outbound",
          originIdent:
            params.originIdent ||
            reservation?.originAirport?.icao_code ||
            reservation?.trip?.origin_airport_ident ||
            "",
          destinationIdent:
            params.destinationIdent ||
            reservation?.destinationAirport?.icao_code ||
            reservation?.trip?.destination_airport_ident ||
            "",
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

  const formatValue = (val: string | number | undefined | null) => {
    return val !== undefined && val !== null ? String(val) : "";
  };

  const formatUnit = (val: number | undefined | null, unit: string) => {
    return val !== undefined && val !== null ? `${val} ${unit}` : "";
  };

  const formatBoolean = (val: boolean | undefined | null) => {
    if (val === true) return "Sí";
    if (val === false) return "No";
    return "";
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
            onPress={() => setIsAircraftModalVisible(true)}
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

              {/* Schedule Card (Departure and Arrival times) */}
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
                      const name = `${firstName} ${lastName}`.trim() || "Piloto";
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

      {/* Aircraft Details Modal */}
      <Modal
        visible={isAircraftModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsAircraftModalVisible(false)}
      >
        <ThemedView className="flex-1 px-4 pt-2" style={{ paddingTop: insets.top }}>
          {/* Modal Header */}
          <View className="flex-row items-center justify-between mb-4 mt-2 border-b border-slate-100 pb-3">
            <TouchableOpacity
              onPress={() => setIsAircraftModalVisible(false)}
              className="flex-row items-center p-1"
            >
              <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
              <ThemedText className="font-semibold text-brand-blue ml-1">
                Cerrar
              </ThemedText>
            </TouchableOpacity>
            <ThemedText className="font-bold text-brand-blue text-lg">
              Detalle de Aeronave
            </ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {isLoadingAircraft ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#0f1e3d" />
                <ThemedText className="text-slate-500 text-sm mt-3">
                  Cargando especificaciones de la aeronave...
                </ThemedText>
              </View>
            ) : !aircraft ? (
              <View className="py-12 items-center justify-center">
                <Ionicons name="airplane-outline" size={48} color="#94A3B8" />
                <ThemedText className="font-bold text-lg text-brand-blue mt-3">
                  Aeronave no encontrada
                </ThemedText>
                <ThemedText className="text-slate-500 text-center text-sm mt-1">
                  No fue posible recuperar los datos técnicos de esta aeronave.
                </ThemedText>
              </View>
            ) : (() => {
              const { basic_specs, technical_specs, operating_specs, emergency, notes } = aircraft;

              return (
                <View className="gap-4 mb-8">
                  {/* Title Section Card */}
                  <View className="bg-brand-blue rounded-3xl p-5 flex-row justify-between items-center">
                    <View className="flex-1">
                      <View className="mb-2">
                        <ThemedText className="font-bold text-xl text-white">
                          {basic_specs.model}
                        </ThemedText>
                      </View>
                      <View className="self-start bg-brand-gold px-4 py-1.5 rounded-full">
                        <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                          {basic_specs.registration}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {/* 1. Basic Specs Card */}
                  <ThemedView variant="card" className="p-5 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="information-circle" size={20} color="#0f1e3d" />
                      <ThemedText type="subtitle" className="font-bold text-brand-blue">
                        Especificaciones Básicas
                      </ThemedText>
                    </View>
                    <DetailRow label="Modelo" value={formatValue(basic_specs.model)} />
                    <DetailRow label="Tipo (ICAO)" value={formatValue(basic_specs.type)} />
                    <DetailRow label="Matrícula" value={formatValue(basic_specs.registration)} />
                    <DetailRow
                      label="Aeropuerto Base / Origen"
                      value={
                        aircraft.base_airport
                          ? `${aircraft.base_airport.name} (${aircraft.base_airport.iata_code ||
                          aircraft.base_airport.icao_code ||
                          aircraft.base_airport.ident
                          })`
                          : "Sin especificar"
                      }
                    />
                    <DetailRow
                      label="Capacidad POB (Pax + Tripulación)"
                      value={formatUnit(basic_specs.pax_count, "personas")}
                    />
                  </ThemedView>

                  {/* 2. Technical Specs Card */}
                  <ThemedView variant="card" className="p-5 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="settings" size={20} color="#0f1e3d" />
                      <ThemedText type="subtitle" className="font-bold text-brand-blue">
                        Especificaciones Técnicas
                      </ThemedText>
                    </View>
                    <DetailRow
                      label="Reglas de Vuelo"
                      value={
                        technical_specs.flight_rules
                          ? FLIGHT_RULES_MAP[technical_specs.flight_rules] || technical_specs.flight_rules
                          : ""
                      }
                    />
                    <DetailRow
                      label="Estela Turbulenta"
                      value={
                        technical_specs.wake_turbulence_category
                          ? WAKE_TURBULENCE_MAP[technical_specs.wake_turbulence_category] || technical_specs.wake_turbulence_category
                          : ""
                      }
                    />
                    <DetailRow
                      label="Capacidad Combustible Usable"
                      value={formatUnit(technical_specs.fuel_capacity_gallons, "Galones")}
                    />
                    <DetailRow
                      label="Transpondedor"
                      value={
                        technical_specs.transponder
                          ? TRANSPONDER_MAP[technical_specs.transponder] || technical_specs.transponder
                          : ""
                      }
                    />
                    <BadgesList
                      label="Equipamiento OACI"
                      items={technical_specs.equipment}
                      map={EQUIPMENT_MAP}
                    />
                  </ThemedView>

                  {/* 3. Operating/Performance Specs Card */}
                  <ThemedView variant="card" className="p-5 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="speedometer" size={20} color="#0f1e3d" />
                      <ThemedText type="subtitle" className="font-bold text-brand-blue">
                        Rendimiento y Operación
                      </ThemedText>
                    </View>
                    <DetailRow
                      label="Velocidad de Crucero"
                      value={formatUnit(operating_specs.cruise_speed_knots, "Nudos (TAS)")}
                    />
                    <DetailRow
                      label="Consumo de Combustible"
                      value={formatUnit(operating_specs.fuel_burn_rate_gph, "GPH (Galones por Hora)")}
                    />
                    <DetailRow
                      label="Techo de Servicio"
                      value={formatUnit(operating_specs.service_ceiling_feet, "Pies (Altitud Máxima)")}
                    />
                    <DetailRow
                      label="Peso Máximo de Despegue (MTOW)"
                      value={formatUnit(operating_specs.max_takeoff_weight_lbs, "Libras")}
                    />
                    <DetailRow
                      label="Carrera de Despegue Requerida"
                      value={formatUnit(operating_specs.takeoff_distance_feet, "Pies")}
                    />
                    <DetailRow
                      label="Distancia de Aterrizaje Requerida"
                      value={formatUnit(operating_specs.landing_distance_feet, "Pies")}
                    />
                    <DetailRow
                      label="Régimen de Ascenso"
                      value={formatUnit(operating_specs.rate_of_climb_fpm, "FPM (Pies por Minuto)")}
                    />
                  </ThemedView>

                  {/* 4. Emergency Card */}
                  <ThemedView variant="card" className="p-5 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="medical" size={20} color="#0f1e3d" />
                      <ThemedText type="subtitle" className="font-bold text-brand-blue">
                        Seguridad y Emergencia
                      </ThemedText>
                    </View>

                    <BadgesList
                      label="Equipamiento de Radio"
                      items={emergency.radio_equipment}
                      map={RADIO_EQUIPMENT_MAP}
                    />
                    <BadgesList
                      label="Equipamiento de Supervivencia"
                      items={emergency.survival_equipment}
                      map={SURVIVAL_EQUIPMENT_MAP}
                    />
                    <BadgesList
                      label="Chalecos Salvavidas"
                      items={emergency.life_jacket_equipment}
                      map={LIFE_JACKETS_MAP}
                    />

                    <View className="mt-4 pt-3 border-t border-slate-100">
                      <ThemedText type="caption" className="font-bold text-brand-blue mb-2.5">
                        Balsas Salvavidas (Dinghies)
                      </ThemedText>
                      <DetailRow
                        label="Lleva Balsas"
                        value={formatBoolean(emergency.dinghies_capacity.carried)}
                      />
                      {emergency.dinghies_capacity.carried && (
                        <>
                          <DetailRow
                            label="Cantidad de Balsas"
                            value={formatValue(emergency.dinghies_capacity.number)}
                          />
                          <DetailRow
                            label="Capacidad Total"
                            value={formatUnit(
                              emergency.dinghies_capacity.total_capacity,
                              "personas"
                            )}
                          />
                          <DetailRow
                            label="Tienen Cubierta"
                            value={formatBoolean(emergency.dinghies_capacity.covered)}
                          />
                          <DetailRow
                            label="Color de las Balsas"
                            value={formatValue(emergency.dinghies_capacity.color)}
                          />
                        </>
                      )}
                    </View>
                  </ThemedView>

                  {/* 5. Notes/Observations Card */}
                  <ThemedView variant="card" className="p-5 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="document-text" size={20} color="#0f1e3d" />
                      <ThemedText type="subtitle" className="font-bold text-brand-blue">
                        Observaciones y Notas
                      </ThemedText>
                    </View>
                    {notes ? (
                      <ThemedText className="text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                        &quot;{notes}&quot;
                      </ThemedText>
                    ) : (
                      <ThemedText className="text-slate-400 italic text-center py-2">
                        Sin observaciones registradas.
                      </ThemedText>
                    )}
                  </ThemedView>
                </View>
              );
            })()}
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}
