import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { AircraftSpecsDoc } from "@/hooks/useAvailableAircrafts";
import { AircraftAvailability, AircraftReservation } from "@/types/all-roles";
import { FlightSearchForm } from "@/types/client";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

function formatInTimezone(date: Date, timeZone?: string) {
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    if (timeZone) {
      options.timeZone = timeZone;
    }
    const formatter = new Intl.DateTimeFormat("en-CA", options);
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "00";
    return {
      selected_date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
      time: `${getPart("hour")}:${getPart("minute")}`,
    };
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return {
      selected_date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }
}

export default function AircraftDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<AircraftReservation | null>(null);

  const params = useLocalSearchParams<{
    aircraftJson?: string;
    searchData?: string;
    flightDurationHours?: string;
    distanceNm?: string;
    model?: string;
    registration?: string;
    pax_count?: string;
    type?: string;
    cruise_speed_knots?: string;
    service_ceiling_feet?: string;
    base_airport_name?: string;
    base_airport_ident?: string;
  }>();

  let aircraft: AircraftSpecsDoc | null = null;
  if (params.aircraftJson) {
    try {
      aircraft = JSON.parse(params.aircraftJson);
    } catch {
      aircraft = null;
    }
  }

  let searchForm: FlightSearchForm | null = null;
  if (params.searchData) {
    try {
      searchForm = JSON.parse(params.searchData);
    } catch {
      searchForm = null;
    }
  }

  const model = aircraft?.basic_specs?.model || params.model || "Aeronave";
  const registration = aircraft?.basic_specs?.registration || params.registration || "N/A";
  const paxCount = aircraft?.basic_specs?.pax_count ?? (params.pax_count ? Number(params.pax_count) : "N/A");
  const type = aircraft?.basic_specs?.type || params.type || "N/A";
  const cruiseSpeed = aircraft?.operating_specs?.cruise_speed_knots ?? (params.cruise_speed_knots ? Number(params.cruise_speed_knots) : 120);
  const serviceCeiling = aircraft?.operating_specs?.service_ceiling_feet ?? (params.service_ceiling_feet ? Number(params.service_ceiling_feet) : "N/A");
  const flightDurationHours = params.flightDurationHours ? Number(params.flightDurationHours) : undefined;
  const distanceNm = params.distanceNm ? Number(params.distanceNm) : 0;
  const distanceKm = distanceNm ? distanceNm * 1.852 : undefined;

  const handleReserve = async () => {
    if (!aircraft || !searchForm || !searchForm.schedule?.outbound_flight_datetime_utc) {
      Toast.show({
        type: "error",
        text1: "Error de Reserva",
        text2: "No se encontraron los datos necesarios de la búsqueda o la aeronave.",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const originIdent = searchForm.trip.origin_airport_ident;
      const originTimezone = searchForm.trip.origin_timezone || searchForm.trip.origin_airport?.timezone;
      const destinationIdent = searchForm.trip.destination_airport_ident;
      const destinationTimezone = searchForm.trip.destination_timezone || searchForm.trip.destination_airport?.timezone;

      const durationHours = flightDurationHours || (distanceNm > 0 && typeof cruiseSpeed === "number" ? distanceNm / cruiseSpeed : 1);
      const durationMs = durationHours * 3600 * 1000;

      // Outbound flight dates
      const outboundStart = new Date(searchForm.schedule.outbound_flight_datetime_utc);
      const outboundEnd = new Date(outboundStart.getTime() + durationMs);

      const outboundStartLocal = formatInTimezone(outboundStart, originTimezone);
      const outboundEndLocal = formatInTimezone(outboundEnd, originTimezone);

      // Create outbound availability event
      const outboundEvent: AircraftAvailability = {
        aircraftId: aircraft.id,
        selected_date: outboundStartLocal.selected_date,
        start_time: outboundStartLocal.time,
        end_time: outboundEndLocal.time,
        start_timestamp: outboundStart,
        end_timestamp: outboundEnd,
        all_day: false,
        recurrence: {
          period: "none",
          interval: 1,
          days_of_week: [],
          ends: {
            type: "never",
            date: null,
            occurrences: 0,
          },
        },
        reason: "flight",
        notes: `Vuelo de ${originIdent} a ${destinationIdent}`,
      };

      const eventIds: string[] = [];

      const outboundDocRef = await addDoc(collection(db, "aircraft-availability"), outboundEvent);
      eventIds.push(outboundDocRef.id);

      // Return flight if roundtrip
      let returnStart: Date | null = null;
      let returnEnd: Date | null = null;

      if (searchForm.schedule.roundtrip && searchForm.schedule.return_flight_datetime_utc) {
        returnStart = new Date(searchForm.schedule.return_flight_datetime_utc);
        returnEnd = new Date(returnStart.getTime() + durationMs);

        const returnStartLocal = formatInTimezone(returnStart, destinationTimezone);
        const returnEndLocal = formatInTimezone(returnEnd, destinationTimezone);

        const returnEvent: AircraftAvailability = {
          aircraftId: aircraft.id,
          selected_date: returnStartLocal.selected_date,
          start_time: returnStartLocal.time,
          end_time: returnEndLocal.time,
          start_timestamp: returnStart,
          end_timestamp: returnEnd,
          all_day: false,
          recurrence: {
            period: "none",
            interval: 1,
            days_of_week: [],
            ends: {
              type: "never",
              date: null,
              occurrences: 0,
            },
          },
          reason: "flight",
          notes: `Vuelo de retorno de ${destinationIdent} a ${originIdent}`,
        };

        const returnDocRef = await addDoc(collection(db, "aircraft-availability"), returnEvent);
        eventIds.push(returnDocRef.id);
      }

      // Create AircraftReservation instance
      const reservationData: AircraftReservation = {
        aircraftId: aircraft.id,
        clientId: user?.uid || "",
        price: 0,
        distance_nm: distanceNm,
        cruise_speed_knots: typeof cruiseSpeed === "number" ? cruiseSpeed : 120,
        trip: {
          origin_airport_ident: originIdent,
          origin_timezone: originTimezone || "",
          destination_airport_ident: destinationIdent,
          destination_timezone: destinationTimezone || "",
        },
        schedule: {
          roundtrip: !!searchForm.schedule.roundtrip,
          outbound_flight_departure_time: outboundStart,
          outbound_flight_arrival_time: outboundEnd,
          return_flight_departure_time: returnStart,
          return_flight_arrival_time: returnEnd,
        },
        capacity: {
          passangers: searchForm.capacity?.passangers || 1,
        },
        event_ids: eventIds,
        client_status: "unpaid",
        internal_status: "pending",
        status_notes: "",
        pilot_ids: [],
        created_at: new Date(),
      };

      await addDoc(collection(db, "aircraft-reservation"), reservationData);

      queryClient.invalidateQueries({ queryKey: ["aircraft-availability"] });
      queryClient.invalidateQueries({ queryKey: ["client-reservations"] });

      setCreatedReservation(reservationData);
      setShowConfirmation(true);

      Toast.show({
        type: "success",
        text1: "¡Reserva Registrada!",
        text2: `Vuelo reservado en la aeronave ${model} (${registration})`,
      });
    } catch (error) {
      console.error("Error al crear la reserva:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Ocurrió un error al procesar la reserva. Por favor reintenta.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2">
      {/* Header with Back Button */}
      <View className="flex-row items-center justify-between mb-6 mt-2">
        <TouchableOpacity
          onPress={() => {
            if (params.searchData) {
              router.push({
                pathname: "/(client)/search-results",
                params: {
                  searchData: params.searchData,
                },
              });
            } else {
              router.back();
            }
          }}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#0f1e3d" />
        </TouchableOpacity>
        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
          Datos de la Aeronave
        </ThemedText>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Card containing aircraft model and registration */}
        <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 rounded-xl bg-brand-blue/10 items-center justify-center">
              <Ionicons name="airplane" size={24} color="#0f1e3d" />
            </View>
            <View className="flex-1">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-xl">
                {model}
              </ThemedText>
              <View className="bg-slate-100 self-start px-2.5 py-1 rounded-md mt-1 border border-slate-200">
                <ThemedText className="text-xs font-bold text-slate-700">
                  Matrícula: {registration}
                </ThemedText>
              </View>
            </View>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          {/* Specs breakdown grid */}
          <View className="gap-3">
            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Capacidad de Pasajeros:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{paxCount}</ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Tiempo de vuelo:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">
                {flightDurationHours && flightDurationHours < 1
                  ? `${Math.round(flightDurationHours * 60)} minutos`
                  : `${flightDurationHours?.toFixed(1)} horas`}
              </ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Distancia:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{distanceKm?.toFixed(0)} km</ThemedText>
            </View>

            <View className="h-px bg-slate-100 my-4" />

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Tipo de Aeronave:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{type}</ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Velocidad de Crucero:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{cruiseSpeed} nudos</ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Techo de Servicio:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{serviceCeiling} pies</ThemedText>
            </View>
          </View>
        </View>

        {/* Reserve Button below the card */}
        <TouchableOpacity
          onPress={handleReserve}
          disabled={isSubmitting}
          className="bg-brand-gold py-4 rounded-xl items-center justify-center shadow-md flex-row gap-2 mb-10"
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
              <ThemedText className="text-white font-bold text-base">Reservar</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Confirmation Screen Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showConfirmation}
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl items-center">
            <View className="w-16 h-16 rounded-full bg-emerald-100 items-center justify-center mb-4 border border-emerald-200">
              <Ionicons name="checkmark-sharp" size={36} color="#059669" />
            </View>

            <ThemedText type="subtitle" className="text-brand-blue font-bold text-xl text-center mb-1">
              ¡Reserva Confirmada!
            </ThemedText>
            <ThemedText className="text-slate-500 text-xs text-center mb-5 font-medium">
              Tu solicitud de vuelo ha sido registrada exitosamente en nuestro sistema.
            </ThemedText>

            {/* Flight Details Card */}
            {createdReservation && (
              <View className="bg-slate-50 rounded-2xl p-4 w-full border border-slate-200 mb-6 gap-2">
                <View className="flex-row items-center justify-between">
                  <ThemedText className="text-slate-500 text-xs">Aeronave:</ThemedText>
                  <ThemedText className="font-bold text-brand-blue text-sm">
                    {model} ({registration})
                  </ThemedText>
                </View>

                <View className="flex-row items-center justify-between">
                  <ThemedText className="text-slate-500 text-xs">Ruta:</ThemedText>
                  <View className="flex-row items-center gap-1">
                    <ThemedText className="font-bold text-slate-800 text-xs">
                      {createdReservation.trip.origin_airport_ident}
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={12} color="#0f1e3d" />
                    <ThemedText className="font-bold text-slate-800 text-xs">
                      {createdReservation.trip.destination_airport_ident}
                    </ThemedText>
                  </View>
                </View>

                <View className="flex-row items-center justify-between">
                  <ThemedText className="text-slate-500 text-xs">Pasajeros:</ThemedText>
                  <ThemedText className="font-bold text-slate-800 text-xs">
                    {createdReservation.capacity.passangers}
                  </ThemedText>
                </View>

                <View className="h-px bg-slate-200/80 my-1" />

                <View className="flex-row items-center justify-between">
                  <ThemedText className="text-slate-500 text-xs">Ida:</ThemedText>
                  <ThemedText className="font-bold text-slate-700 text-xs">
                    {createdReservation.schedule.outbound_flight_departure_time.toLocaleString("es-ES", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </ThemedText>
                </View>

                {createdReservation.schedule.roundtrip && createdReservation.schedule.return_flight_departure_time && (
                  <View className="flex-row items-center justify-between">
                    <ThemedText className="text-slate-500 text-xs">Vuelta:</ThemedText>
                    <ThemedText className="font-bold text-slate-700 text-xs">
                      {createdReservation.schedule.return_flight_departure_time.toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </ThemedText>
                  </View>
                )}

                <View className="flex-row items-center justify-between mt-1">
                  <ThemedText className="text-slate-500 text-xs">Estado:</ThemedText>
                  <View className="bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    <ThemedText className="text-[10px] font-bold text-amber-800 uppercase">
                      {createdReservation.client_status} / {createdReservation.internal_status}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                setShowConfirmation(false);
                router.replace("/(client)/flights");
              }}
              className="bg-brand-blue py-3.5 px-6 rounded-xl w-full items-center justify-center shadow-sm flex-row gap-2"
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#FFFFFF" />
              <ThemedText className="text-white font-bold text-sm">Ir a Mis Vuelos</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
