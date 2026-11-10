import { ThemedText } from "@/components/themed-text";
import { grossFromNet } from "@/utils/flight-pricing";
import { FlightQuote } from "@/types/pricing";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { AircraftSpecsDoc } from "@/hooks/useAvailableAircrafts";
import { AircraftAvailability, AircraftReservation } from "@/types/all-roles";
import { FlightSearchForm } from "@/types/client";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    estimatedPrice?: string;
    quoteJson?: string;
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
  const parsedPrice = params.estimatedPrice ? Number(JSON.parse(params.estimatedPrice)) : 0;
  const estimatedPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;
  // Desglose de la cotización por hora (horas facturables y pernoctes) armada en el buscador.
  const quote: FlightQuote | null = useMemo(() => {
    try {
      return params.quoteJson ? (JSON.parse(String(params.quoteJson)) as FlightQuote) : null;
    } catch {
      return null;
    }
  }, [params.quoteJson]);

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

      // Pre-flight collision validation: revisamos los bloqueos de vuelo ("flight") de la aeronave
      // en aircraft-availability. No se leen reservas ajenas (las reglas de Firestore lo impiden).
      const checkAvailQuery = query(
        collection(db, "aircraft-availability"),
        where("aircraftId", "==", aircraft.id),
        where("reason", "==", "flight")
      );
      const flightBlocksSnap = await getDocs(checkAvailQuery);
      let isAlreadyBooked = false;

      const toDate = (v: any): Date | null => {
        if (!v) return null;
        const dt = v?.toDate ? v.toDate() : new Date(v);
        return isNaN(dt.getTime()) ? null : dt;
      };

      for (const docSnap of flightBlocksSnap.docs) {
        const d = docSnap.data();
        const existOutStart = toDate(d.start_timestamp);
        const existOutEnd = toDate(d.end_timestamp);

        if (existOutStart && existOutEnd) {
          if (outboundStart.getTime() < existOutEnd.getTime() && outboundEnd.getTime() > existOutStart.getTime()) {
            isAlreadyBooked = true;
            break;
          }
        }
      }

      if (isAlreadyBooked) {
        Alert.alert(
          "Horario no disponible",
          "Esta aeronave ya cuenta con una reserva para ese horario. Por favor selecciona otra aeronave o modifica la fecha de tu vuelo."
        );
        queryClient.invalidateQueries({ queryKey: ["available-aircrafts"] });
        setIsSubmitting(false);
        return;
      }

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
        fa_flight_id: null,
        clientId: user?.uid || "",
        // estimatedPrice es sin IVA: la reserva guarda el total con IVA (lo que cobra Bancard).
        price: grossFromNet(estimatedPrice || 0),
        price_net_usd: estimatedPrice || 0,
        estimated_price: estimatedPrice || 0,
        currency: "USD",
        distance_nm: distanceNm,
        cruise_speed_knots: typeof cruiseSpeed === "number" ? cruiseSpeed : 120,
        ...(quote
          ? {
              billable_hours: quote.billableHours,
              price_per_hour_usd: quote.pricePerHourUsd,
              overnight_nights: quote.nights,
              overnight_fee_usd: quote.overnightFeeUsd,
              hangar_per_night_usd: quote.hangarPerNightUsd,
            }
          : {}),
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
        internal_status: "pending_approval",
        status_notes: "Reserva solicitada por el cliente. Pendiente de aprobación operativa y asignación de tripulación.",
        pilot_ids: [],
        created_at: new Date(),
      };

      await addDoc(collection(db, "aircraft-reservation"), reservationData);

      queryClient.invalidateQueries({ queryKey: ["available-aircrafts"] });
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
          <Ionicons name="arrow-back" size={20} color="#030436" />
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
              <Ionicons name="airplane" size={24} color="#030436" />
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

        {/* Pricing Summary Card */}
        <View className="bg-brand-blue rounded-3xl p-5 mb-4 border border-brand-blue/30 shadow-sm">
          <View className="flex-row items-center justify-between mb-2">
            <View>
              <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[10px]">
                Cotización de Vuelo
              </ThemedText>
              <ThemedText className="text-white text-lg font-bold">
                {estimatedPrice !== null ? `USD $${estimatedPrice.toLocaleString("en-US")}` : "Cotización a Confirmar"}
              </ThemedText>
            </View>
            <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
              <MaterialCommunityIcons name="currency-usd" size={24} color="#0165FF" />
            </View>
          </View>

          <View className="h-px bg-white/10 my-3" />

          <View className="flex-row justify-between items-center">
            <ThemedText className="text-slate-300 text-xs">Modalidad:</ThemedText>
            <ThemedText className="text-white text-xs font-bold">
              {searchForm?.schedule?.roundtrip ? "Ida y Vuelta" : "Solo Ida"}
            </ThemedText>
          </View>

          <View className="flex-row justify-between items-center mt-1.5">
            <ThemedText className="text-slate-300 text-xs">Distancia total:</ThemedText>
            <ThemedText className="text-white text-xs font-bold">
              {(distanceNm * (searchForm?.schedule?.roundtrip ? 2 : 1)).toFixed(0)} NM ({((distanceKm || 0) * (searchForm?.schedule?.roundtrip ? 2 : 1)).toFixed(0)} km)
            </ThemedText>
          </View>

          <ThemedText className="text-[11px] text-slate-400 mt-3 italic">
            * El valor final se confirmará tras la aprobación del propietario o encargado del avión.
          </ThemedText>
        </View>

        {/* Reserve Button below the card */}
        <TouchableOpacity
          onPress={handleReserve}
          disabled={isSubmitting || !!createdReservation}
          className={`py-4 rounded-xl items-center justify-center shadow-md flex-row gap-2 mb-10 ${
            isSubmitting || !!createdReservation ? "bg-slate-300" : "bg-brand-gold"
          }`}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
              <ThemedText className="text-white font-bold text-base">
                {createdReservation ? "Vuelo Reservado" : "Reservar"}
              </ThemedText>
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
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={modalStyles.iconCircle}>
              <Ionicons name="checkmark-sharp" size={36} color="#059669" />
            </View>

            <Text style={modalStyles.title}>
              ¡Reserva Confirmada!
            </Text>
            <Text style={modalStyles.subtitle}>
              Tu solicitud de vuelo ha sido registrada exitosamente en nuestro sistema.
            </Text>

            {/* Flight Details Card */}
            {createdReservation && (
              <View style={modalStyles.detailsContainer}>
                <View style={modalStyles.detailRow}>
                  <Text style={modalStyles.label}>Aeronave:</Text>
                  <Text style={modalStyles.boldValue}>
                    {model} ({registration})
                  </Text>
                </View>

                <View style={modalStyles.detailRow}>
                  <Text style={modalStyles.label}>Ruta:</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={modalStyles.value}>
                      {createdReservation.trip.origin_airport_ident}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color="#030436" />
                    <Text style={modalStyles.value}>
                      {createdReservation.trip.destination_airport_ident}
                    </Text>
                  </View>
                </View>

                <View style={modalStyles.detailRow}>
                  <Text style={modalStyles.label}>Pasajeros:</Text>
                  <Text style={modalStyles.value}>
                    {createdReservation.capacity.passangers}
                  </Text>
                </View>

                <View style={modalStyles.divider} />

                <View style={modalStyles.detailRow}>
                  <Text style={modalStyles.label}>Ida:</Text>
                  <Text style={modalStyles.value}>
                    {createdReservation.schedule.outbound_flight_departure_time.toLocaleString("es-ES", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Text>
                </View>

                {createdReservation.schedule.roundtrip && createdReservation.schedule.return_flight_departure_time && (
                  <View style={modalStyles.detailRow}>
                    <Text style={modalStyles.label}>Vuelta:</Text>
                    <Text style={modalStyles.value}>
                      {createdReservation.schedule.return_flight_departure_time.toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </Text>
                  </View>
                )}

                <View style={[modalStyles.detailRow, { marginTop: 4 }]}>
                  <Text style={modalStyles.label}>Estado:</Text>
                  <View style={modalStyles.statusBadge}>
                    <Text style={modalStyles.statusBadgeText}>
                      {createdReservation.client_status} / {createdReservation.internal_status}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                setShowConfirmation(false);
                router.replace("/(client)/flights");
              }}
              style={modalStyles.actionButton}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#FFFFFF" />
              <Text style={modalStyles.actionButtonText}>Ir a Mis Vuelos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  title: {
    color: "#030436",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  detailsContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: "#64748B",
    fontSize: 12,
  },
  value: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "bold",
  },
  boldValue: {
    color: "#030436",
    fontSize: 14,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(226, 232, 240, 0.8)",
    marginVertical: 4,
  },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#92400E",
    textTransform: "uppercase",
  },
  actionButton: {
    backgroundColor: "#030436",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
