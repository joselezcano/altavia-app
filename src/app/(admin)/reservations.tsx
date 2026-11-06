import { PassengerManifestModal } from "@/components/passenger-manifest-modal";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { createPaymentLink, USD_TO_PYG_RATE } from "@/services/bancard";
import { Airport, ClientReservationItem } from "@/types/all-roles";
import { AircraftSpecs } from "@/types/owner";
import { BaseUser } from "@/types/user";
import { generateAndShareInvoicePdf } from "@/utils/electronic-invoice";
import { getStatusBadge } from "@/utils/flight-status";
import { isReservationPaid } from "@/utils/paid-reservation";
import { canManageReservationAircraft, NON_EDITABLE_STATUSES } from "@/utils/reservation-permissions";
import { roleFlightRoute, toHref } from "@/utils/role-routes";
import { useDeleteReservation } from "@/hooks/useReservationEditing";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function AdminReservationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, role, profileData } = useAuth();
  const deleteReservation = useDeleteReservation();

  // Rutas del grupo del rol activo (esta pantalla se re-exporta en (pilot)/flights para la encargada).
  const newBookingRoute = roleFlightRoute(role, "new-booking");

  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sharingResId, setSharingResId] = useState<string | null>(null);
  const [selectedResForManifest, setSelectedResForManifest] = useState<ClientReservationItem | null>(null);
  const [isManifestVisible, setIsManifestVisible] = useState(false);

  // Fetch all reservations from 'aircraft-reservation'
  const {
    data: reservations = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ClientReservationItem[]>({
    queryKey: ["admin-all-reservations"],
    queryFn: async () => {
      try {
        const snap = await getDocs(collection(db, "aircraft-reservation"));
        const airportCache = new Map<string, Airport | null>();
        const aircraftCache = new Map<string, AircraftSpecs | null>();

        const fetchAirport = async (ident?: string): Promise<Airport | undefined> => {
          if (!ident) return undefined;
          if (airportCache.has(ident)) return airportCache.get(ident) || undefined;
          try {
            const docSnap = await getDoc(doc(db, "airports", ident));
            if (docSnap.exists()) {
              const data = docSnap.data() as Airport;
              airportCache.set(ident, data);
              return data;
            }
            const q = query(collection(db, "airports"), where("ident", "==", ident), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const data = qSnap.docs[0].data() as Airport;
              airportCache.set(ident, data);
              return data;
            }
          } catch (e) {
            console.error("Error airport fetch:", e);
          }
          airportCache.set(ident, null);
          return undefined;
        };

        const fetchAircraft = async (aircraftId?: string): Promise<AircraftSpecs | undefined> => {
          if (!aircraftId) return undefined;
          if (aircraftCache.has(aircraftId)) return aircraftCache.get(aircraftId) || undefined;
          try {
            const aSnap = await getDoc(doc(db, "AircraftSpecs", aircraftId));
            if (aSnap.exists()) {
              const data = aSnap.data() as AircraftSpecs;
              aircraftCache.set(aircraftId, data);
              return data;
            }
          } catch (e) {
            console.error("Error aircraft fetch:", e);
          }
          aircraftCache.set(aircraftId, null);
          return undefined;
        };

        const list: ClientReservationItem[] = [];

        for (const docSnap of snap.docs) {
          const d = docSnap.data();

          const outboundDeparture = d.schedule?.outbound_flight_departure_time?.toDate
            ? d.schedule.outbound_flight_departure_time.toDate()
            : d.schedule?.outbound_flight_departure_time
              ? new Date(d.schedule.outbound_flight_departure_time)
              : new Date();

          const outboundArrival = d.schedule?.outbound_flight_arrival_time?.toDate
            ? d.schedule.outbound_flight_arrival_time.toDate()
            : d.schedule?.outbound_flight_arrival_time
              ? new Date(d.schedule.outbound_flight_arrival_time)
              : new Date();

          const returnDeparture = d.schedule?.return_flight_departure_time?.toDate
            ? d.schedule.return_flight_departure_time.toDate()
            : d.schedule?.return_flight_departure_time
              ? new Date(d.schedule.return_flight_departure_time)
              : null;

          const returnArrival = d.schedule?.return_flight_arrival_time?.toDate
            ? d.schedule.return_flight_arrival_time.toDate()
            : d.schedule?.return_flight_arrival_time
              ? new Date(d.schedule.return_flight_arrival_time)
              : null;

          const originAirport = await fetchAirport(d.trip?.origin_airport_ident);
          const destinationAirport = await fetchAirport(d.trip?.destination_airport_ident);
          const aircraftSpecs = await fetchAircraft(d.aircraftId);

          list.push({
            id: docSnap.id,
            aircraftId: d.aircraftId,
            fa_flight_id: d.fa_flight_id,
            clientId: d.clientId,
            price: d.price ?? 0,
            distance_nm: d.distance_nm ?? 0,
            cruise_speed_knots: d.cruise_speed_knots ?? 120,
            trip: d.trip,
            schedule: {
              roundtrip: !!d.schedule?.roundtrip,
              outbound_flight_departure_time: outboundDeparture,
              outbound_flight_arrival_time: outboundArrival,
              return_flight_departure_time: returnDeparture,
              return_flight_arrival_time: returnArrival,
            },
            capacity: d.capacity || { passangers: 1 },
            passengers: d.passengers || [],
            event_ids: d.event_ids || [],
            client_status: d.client_status || "unpaid",
            internal_status: d.internal_status || "pending",
            status_notes: d.status_notes || "",
            pilot_ids: d.pilot_ids || [],
            created_at: d.created_at?.toDate ? d.created_at.toDate() : (d.created_at ? new Date(d.created_at) : undefined),
            paid_at: d.paid_at?.toDate ? d.paid_at.toDate() : (d.paid_at ? new Date(d.paid_at) : undefined),
            payment_method: d.payment_method,
            payment_transaction_id: d.payment_transaction_id,
            invoice_number: d.invoice_number,
            invoice_timbrado: d.invoice_timbrado,
            invoice_cdc: d.invoice_cdc,
            originAirport,
            destinationAirport,
            aircraftSpecs,
          });
        }

        // Ordenar por fecha de salida descendente (más recientes primero)
        list.sort(
          (a, b) =>
            b.schedule.outbound_flight_departure_time.getTime() -
            a.schedule.outbound_flight_departure_time.getTime()
        );

        return list;
      } catch (error) {
        console.error("Error al obtener todas las reservas para admin:", error);
        throw error;
      }
    },
  });

  // Filter options
  const STATUS_FILTERS = [
    { id: "all", label: "Todas" },
    { id: "pending_approval", label: "Por Aprobar" },
    { id: "awaiting_payment", label: "Esperando Pago" },
    { id: "confirmed", label: "Confirmadas / Pagadas" },
    { id: "in_flight", label: "En Vuelo" },
    { id: "completed", label: "Completadas" },
  ];

  const filteredReservations = useMemo(() => {
    if (selectedStatus === "all") return reservations;
    if (selectedStatus === "pending_approval") {
      return reservations.filter((r) =>
        ["pending", "pending_approval"].includes(r.internal_status)
      );
    }
    return reservations.filter((r) => r.internal_status === selectedStatus);
  }, [reservations, selectedStatus]);

  // Enviar link de pago por WhatsApp
  const handleSendPaymentLinkWhatsApp = async (item: ClientReservationItem) => {
    setSharingResId(item.id);
    try {
      let clientPhone = "";
      let clientName = "Estimado/a cliente";

      if (item.clientId) {
        try {
          const userSnap = await getDoc(doc(db, "users", item.clientId));
          if (userSnap.exists()) {
            const u = userSnap.data() as BaseUser;
            clientPhone = u.phone || "";
            clientName = `${u.firstName} ${u.lastName}`.trim();
          }
        } catch (_) {}
      }

      // 1. Iniciar compra en Bancard
      // Link de pago de un solo uso (48 h) a la página pública con el iframe de Bancard.
      const link = await createPaymentLink(item.id);
      const amountGs = link.amountPygEstimate;
      const originName = item.originAirport?.name || item.trip.origin_airport_ident;
      const destName = item.destinationAirport?.name || item.trip.destination_airport_ident;

      const paymentUrl = link.url;

      const messageText = `Hola ${clientName}! Tu vuelo chárter de ${originName} a ${destName} está listo para confirmarse.\n\nImporte: USD $${item.price.toLocaleString("en-US")} (aprox. ₲ ${amountGs.toLocaleString("es-PY")}).\n\nPodés abonar con tarjeta de crédito/débito en la pasarela segura de Bancard aquí:\n${paymentUrl}\n\nAtte. ALTAVIA S.A.`;

      let cleanPhone = clientPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "595" + cleanPhone.slice(1);
      } else if (!cleanPhone.startsWith("595") && cleanPhone.length === 9) {
        cleanPhone = "595" + cleanPhone;
      }

      const whatsappDeepLink = cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`
        : `whatsapp://send?text=${encodeURIComponent(messageText)}`;

      const canOpen = await Linking.canOpenURL(whatsappDeepLink);
      if (canOpen) {
        await Linking.openURL(whatsappDeepLink);
      } else {
        await Linking.openURL(
          `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "No se pudo generar el enlace de Bancard.");
    } finally {
      setSharingResId(null);
    }
  };

  // Eliminar una reserva SIN pagar (primero sus bloqueos de calendario, después la reserva).
  const handleDeleteReservation = (item: ClientReservationItem) => {
    Alert.alert(
      "Eliminar reserva",
      "Se va a eliminar la reserva y se liberarán sus horarios en el calendario de la aeronave. Esta acción no se puede deshacer.",
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReservation.mutateAsync(item);
              Toast.show({ type: "success", text1: "Reserva eliminada" });
              refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "No se pudo eliminar la reserva.");
            }
          },
        },
      ]
    );
  };

  const renderReservationCard = ({ item }: { item: ClientReservationItem }) => {
    const badge = getStatusBadge(item.internal_status);
    const assignPilotsRoute = roleFlightRoute(role, "assign-pilots", { reservationId: item.id });
    const flightDetailsRoute = roleFlightRoute(role, "flight-details", { reservationId: item.id });
    const editReservationRoute = roleFlightRoute(role, "edit-reservation", { reservationId: item.id });
    const canManageItem = canManageReservationAircraft({
      role,
      uid: user?.uid,
      profileData,
      aircraftId: item.aircraftId,
      aircraftOwnerId: item.aircraftSpecs?.ownerId,
    });
    const isPaidItem = isReservationPaid(item);
    const originLabel = item.originAirport?.iata_code || item.trip.origin_airport_ident;
    const destLabel = item.destinationAirport?.iata_code || item.trip.destination_airport_ident;
    const model = item.aircraftSpecs?.basic_specs?.model || "Aeronave";
    const reg = item.aircraftSpecs?.basic_specs?.registration || "";
    const isSharing = sharingResId === item.id;

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.aircraftText}>
              {model} {reg ? `(${reg})` : ""}
            </Text>
            <Text style={styles.dateText}>
              {item.schedule.outbound_flight_departure_time.toLocaleString("es-ES", {
                dateStyle: "medium",
                timeStyle: "short",
              })} hs
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.backgroundColor, borderColor: badge.borderColor }]}>
            <Ionicons name={badge.icon as any} size={12} color={badge.iconColor} />
            <Text style={[styles.statusBadgeText, { color: badge.textColor }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Route Row */}
        <View style={styles.routeRow}>
          <View style={styles.airportBox}>
            <Text style={styles.airportCode}>{originLabel}</Text>
            <Text style={styles.airportCity} numberOfLines={1}>
              {item.originAirport?.municipality || item.originAirport?.name || "Origen"}
            </Text>
          </View>

          <View style={styles.routeMiddle}>
            <MaterialCommunityIcons name="airplane-takeoff" size={18} color="#0165FF" />
            <View style={styles.routeLine} />
            {item.schedule.roundtrip && (
              <Text style={styles.roundtripTag}>Ida y Vuelta</Text>
            )}
          </View>

          <View style={[styles.airportBox, { alignItems: "flex-end" }]}>
            <Text style={styles.airportCode}>{destLabel}</Text>
            <Text style={styles.airportCity} numberOfLines={1}>
              {item.destinationAirport?.municipality || item.destinationAirport?.name || "Destino"}
            </Text>
          </View>
        </View>

        {/* Price & Details Bar */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Precio del Vuelo</Text>
            <Text style={styles.priceValue}>USD ${item.price.toLocaleString("en-US")}</Text>
            <Text style={styles.pricePyg}>
              ₲ {Math.round(item.price * USD_TO_PYG_RATE).toLocaleString("es-PY")}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.paxCountText}>
              <Ionicons name="people-outline" size={14} color="#030436" /> {item.capacity.passangers} pasajero(s)
            </Text>
            <Text style={styles.crewCountText}>
              <MaterialCommunityIcons name="account-tie-hat" size={14} color="#030436" /> {item.pilot_ids.length} piloto(s)
            </Text>
          </View>
        </View>

        {/* Passenger Manifest summary banner */}
        <View style={styles.manifestSummaryBox}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
            <Ionicons
              name={item.passengers && item.passengers.length > 0 ? "checkmark-circle" : "alert-circle-outline"}
              size={16}
              color={item.passengers && item.passengers.length > 0 ? "#059669" : "#0165FF"}
            />
            <Text style={styles.manifestSummaryText} numberOfLines={1}>
              {item.passengers && item.passengers.length > 0
                ? `Manifiesto: ${item.passengers.length}/${item.capacity.passangers} pax (${item.passengers.reduce((s, p) => s + (p.weightKg || 0) + (p.luggageKg || 0), 0)} kg)`
                : `Manifiesto DINAC pendiente (${item.capacity.passangers} cupos)`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedResForManifest(item);
              setIsManifestVisible(true);
            }}
            style={styles.manifestActionBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.manifestActionBtnText}>
              {item.passengers && item.passengers.length > 0 ? "Ver / Editar" : "Cargar Pax"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Invoices details if confirmed */}
        {item.internal_status === "confirmed" && item.invoice_number && (
          <View style={styles.invoiceInfoBox}>
            <Ionicons name="receipt-outline" size={16} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceNumText}>Factura Electrónica: {item.invoice_number}</Text>
              {item.invoice_timbrado && (
                <Text style={styles.invoiceTimbradoText}>Timbrado: {item.invoice_timbrado}</Text>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons based on status */}
        <View style={{ marginTop: 12, gap: 8 }}>
          {/* Action 1: Assign pilots / Approve (when pending) */}
          {(item.internal_status === "pending_approval" || item.internal_status === "pending") && assignPilotsRoute && (
            <TouchableOpacity
              onPress={() => router.push(toHref(assignPilotsRoute))}
              style={styles.approveButton}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="account-tie-hat" size={18} color="#FFFFFF" />
              <Text style={styles.approveButtonText}>Asignar Tripulación y Aprobar</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Action 2: Send Payment Link WhatsApp (when awaiting_payment) */}
          {item.internal_status === "awaiting_payment" && (
            <>
              <TouchableOpacity
                onPress={() => handleSendPaymentLinkWhatsApp(item)}
                disabled={isSharing}
                style={styles.whatsappButton}
                activeOpacity={0.8}
              >
                {isSharing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={styles.whatsappButtonText}>Enviar Link de Pago por WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>

              {assignPilotsRoute && (
                <TouchableOpacity
                  onPress={() => router.push(toHref(assignPilotsRoute))}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Editar Tripulación o Tarifa</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Action 3: View & Share Invoice (when confirmed) */}
          {item.internal_status === "confirmed" && (
            <TouchableOpacity
              onPress={() => generateAndShareInvoicePdf(item)}
              style={styles.invoiceShareButton}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.invoiceShareButtonText}>Ver / Enviar Factura por WhatsApp (PDF)</Text>
            </TouchableOpacity>
          )}

          {/* Action: Flight Plan FPL DINAC button (el admin no tiene la ruta create-flight-plan) */}
          {roleFlightRoute(role, "create-flight-plan") && (
          <TouchableOpacity
            onPress={() => {
              const originIdent = item.trip?.origin_airport_ident || "";
              const destIdent = item.trip?.destination_airport_ident || "";
              const originIcao = item.originAirport?.icao_code || originIdent;
              const destIcao = item.destinationAirport?.icao_code || destIdent;
              const depTime = item.schedule?.outbound_flight_departure_time
                ? (item.schedule.outbound_flight_departure_time instanceof Date
                    ? item.schedule.outbound_flight_departure_time.toISOString()
                    : new Date(item.schedule.outbound_flight_departure_time).toISOString())
                : new Date().toISOString();
              const paxCount = item.passengers && item.passengers.length > 0
                ? String(item.passengers.length)
                : String(item.capacity?.passangers || 1);

              const fplRoute = roleFlightRoute(role, "create-flight-plan", {
                reservationId: item.id,
                legType: "outbound",
                originIdent,
                destinationIdent: destIdent,
                originIcaoCode: originIcao,
                destinationIcaoCode: destIcao,
                departureTime: depTime,
                aircraftId: item.aircraftId || "",
                paxCount,
              });
              if (fplRoute) router.push(toHref(fplRoute));
            }}
            style={styles.fplButton}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={16} color="#030436" />
            <Text style={styles.fplButtonText}>Plan de Vuelo FPL (DINAC)</Text>
            <Ionicons name="arrow-forward" size={14} color="#030436" />
          </TouchableOpacity>
          )}

          {/* Editar / Eliminar (quien gestiona la aeronave). Eliminar solo si no está pagada. */}
          {canManageItem && (editReservationRoute || !isPaidItem) && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {editReservationRoute && !NON_EDITABLE_STATUSES.includes(item.internal_status) && (
                <TouchableOpacity
                  onPress={() => router.push(toHref(editReservationRoute))}
                  style={styles.actionOutlineButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={16} color="#030436" />
                  <Text style={styles.detailsButtonText}>{isPaidItem ? "Reprogramar" : "Editar Reserva"}</Text>
                </TouchableOpacity>
              )}
              {!isPaidItem && (
                <TouchableOpacity
                  onPress={() => handleDeleteReservation(item)}
                  disabled={deleteReservation.isPending}
                  style={[styles.actionOutlineButton, styles.deleteButton]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                  <Text style={[styles.detailsButtonText, { color: "#B91C1C" }]}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Link to Details */}
          {flightDetailsRoute && (
          <TouchableOpacity
            onPress={() => router.push(toHref(flightDetailsRoute))}
            style={styles.detailsButton}
          >
            <Ionicons name="information-circle-outline" size={16} color="#030436" />
            <Text style={styles.detailsButtonText}>Más Información del Vuelo</Text>
            <Ionicons name="chevron-forward" size={14} color="#030436" />
          </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Control Operativo</Text>
          <Text style={styles.headerTitle}>Reservas y Cobros</Text>
        </View>

        <TouchableOpacity
          onPress={() => newBookingRoute && router.push(toHref(newBookingRoute))}
          style={styles.newBookingHeaderButton}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newBookingHeaderText}>Nueva Reserva</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Status Filter Bar */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {STATUS_FILTERS.map((f) => {
            const isSelected = selectedStatus === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setSelectedStatus(f.id)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Reservations List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#030436" />
          <Text style={{ color: "#64748B", marginTop: 8 }}>Cargando reservas...</Text>
        </View>
      ) : filteredReservations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Sin reservas registradas</Text>
          <Text style={styles.emptySub}>
            No hay vuelos que coincidan con el filtro seleccionado.
          </Text>
          <TouchableOpacity
            onPress={() => newBookingRoute && router.push(toHref(newBookingRoute))}
            style={styles.emptyAction}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.emptyActionText}>Crear Nueva Reserva Telefónica</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReservations}
          renderItem={renderReservationCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#030436"
            />
          }
        />
      )}

      {/* Passenger Manifest Modal */}
      {selectedResForManifest && (
        <PassengerManifestModal
          visible={isManifestVisible}
          onClose={() => setIsManifestVisible(false)}
          reservation={selectedResForManifest}
          onSaved={() => refetch()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerEyebrow: {
    fontSize: 11,
    color: "#0165FF",
    fontWeight: "bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#030436",
    marginTop: 2,
  },
  newBookingHeaderButton: {
    backgroundColor: "#030436",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBookingHeaderText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#030436",
    borderColor: "#030436",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  aircraftText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#030436",
  },
  dateText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  airportBox: {
    flex: 1,
  },
  airportCode: {
    fontSize: 16,
    fontWeight: "800",
    color: "#030436",
  },
  airportCity: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  routeMiddle: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  routeLine: {
    width: 40,
    height: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 4,
  },
  roundtripTag: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0165FF",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  priceLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#030436",
  },
  pricePyg: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  paxCountText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  crewCountText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
    marginTop: 2,
  },
  invoiceInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
  },
  invoiceNumText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#065F46",
  },
  invoiceTimbradoText: {
    fontSize: 10,
    color: "#047857",
  },
  approveButton: {
    backgroundColor: "#0165FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  whatsappButton: {
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  whatsappButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  invoiceShareButton: {
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 11,
  },
  invoiceShareButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  detailsButtonText: {
    fontSize: 12,
    color: "#030436",
    fontWeight: "600",
  },
  actionOutlineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  deleteButton: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#030436",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  emptyAction: {
    backgroundColor: "#030436",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  manifestSummaryBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  manifestSummaryText: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "600",
    flex: 1,
  },
  manifestActionBtn: {
    backgroundColor: "#030436",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8,
  },
  manifestActionBtnText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  fplButton: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  fplButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#030436",
    marginHorizontal: 6,
  },
});
