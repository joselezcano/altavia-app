import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { grossFromNet, reservationNetPrice } from "@/utils/flight-pricing";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerPilots } from "@/hooks/useOwnerPilots";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { usePilotReservations } from "@/hooks/usePilotReservations";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { createPaymentLink } from "@/services/bancard";
import { Airport, ClientReservationItem } from "@/types/all-roles";
import { PilotProfile } from "@/types/pilot";
import { BaseUser } from "@/types/user";
import { generateAndShareInvoicePdf } from "@/utils/electronic-invoice";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function AssignFlightPilotsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { reservationId } = useLocalSearchParams<{
    reservationId?: string;
  }>();

  const targetReservationId = Array.isArray(reservationId) ? reservationId[0] : reservationId;

  // Single reservation fetch fallback (Crucial for Admin role or deep link)
  const { data: directRes, isLoading: isLoadingDirectRes } = useQuery<ClientReservationItem | null>({
    queryKey: ["direct-reservation-detail", targetReservationId],
    queryFn: async () => {
      if (!targetReservationId) return null;
      try {
        const ref = doc(db, "aircraft-reservation", targetReservationId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        const d = snap.data();

        let aircraftSpecs: any = undefined;
        if (d.aircraftId) {
          const aRef = doc(db, "AircraftSpecs", d.aircraftId);
          const aSnap = await getDoc(aRef);
          if (aSnap.exists()) aircraftSpecs = aSnap.data();
        }

        let originAirport: Airport | undefined = undefined;
        let destinationAirport: Airport | undefined = undefined;

        if (d.trip?.origin_airport_ident) {
          const oSnap = await getDoc(doc(db, "airports", d.trip.origin_airport_ident));
          if (oSnap.exists()) originAirport = oSnap.data() as Airport;
        }

        if (d.trip?.destination_airport_ident) {
          const dSnap = await getDoc(doc(db, "airports", d.trip.destination_airport_ident));
          if (dSnap.exists()) destinationAirport = dSnap.data() as Airport;
        }

        return {
          id: snap.id,
          ...d,
          aircraftSpecs,
          originAirport,
          destinationAirport,
        } as ClientReservationItem;
      } catch (e) {
        console.error("Error fetching direct reservation:", e);
        return null;
      }
    },
    enabled: !!targetReservationId,
  });

  // Use appropriate reservations hook depending on role
  const { data: ownerRes = [], isLoading: isLoadingOwnerRes } = useOwnerReservations(
    role === "OWNER" ? user?.uid : undefined
  );
  const { data: pilotRes = [], isLoading: isLoadingPilotRes } = usePilotReservations(
    role === "PILOT" ? user?.uid : undefined
  );
  const reservations: ClientReservationItem[] = role === "PILOT" ? pilotRes : ownerRes;
  const isLoadingReservations = role === "PILOT" ? isLoadingPilotRes : isLoadingOwnerRes;

  const reservation = directRes || reservations.find((r) => r.id === targetReservationId);
  const assignedPilotIds = reservation?.pilot_ids || [];

  const { data: exchangeRateData } = useExchangeRate();
  const currentDolar = exchangeRateData?.dolar || 7850;

  // Fetch client details from 'users'
  const { data: clientUser } = useQuery<BaseUser | null>({
    queryKey: ["client-user-info", reservation?.clientId],
    queryFn: async () => {
      if (!reservation?.clientId) return null;
      try {
        const cRef = doc(db, "users", reservation.clientId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) return cSnap.data() as BaseUser;
        return null;
      } catch (e) {
        console.error("Error fetching client user:", e);
        return null;
      }
    },
    enabled: !!reservation?.clientId,
  });

  // Fetch pilots belonging to the aircraft's owner or current owner
  const effectiveOwnerUid = reservation?.aircraftSpecs?.ownerId || user?.uid;
  const { data: pilots = [], isLoading: isLoadingPilots } = useOwnerPilots(effectiveOwnerUid);

  // Price adjustment state
  const [editedPrice, setEditedPrice] = useState<string>("");
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  useEffect(() => {
    if (reservation && reservation.price !== undefined) {
      // Se edita el precio SIN IVA; se guarda también el total con IVA.
      setEditedPrice(String(reservationNetPrice(reservation)));
    }
  }, [reservation?.price]);

  const [updatingPilotId, setUpdatingPilotId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const togglePilotAssignment = async (pilot: PilotProfile) => {
    const pilotUid = pilot.user?.uid;
    if (!pilotUid || !targetReservationId) return;

    const isAssigned = assignedPilotIds.includes(pilotUid);
    setUpdatingPilotId(pilotUid);

    try {
      const reservationRef = doc(db, "aircraft-reservation", targetReservationId);
      await updateDoc(reservationRef, {
        pilot_ids: isAssigned ? arrayRemove(pilotUid) : arrayUnion(pilotUid),
      });

      await queryClient.invalidateQueries({ queryKey: ["direct-reservation-detail", targetReservationId] });
      await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
    } catch (error) {
      console.error("Error al actualizar tripulación del vuelo:", error);
      Alert.alert("Error", "No se pudo actualizar la tripulación del vuelo.");
    } finally {
      setUpdatingPilotId(null);
    }
  };

  const handleApproveFlight = async () => {
    if (!targetReservationId) return;
    if (assignedPilotIds.length === 0) {
      Alert.alert(
        "Tripulación Requerida",
        "Debes asignar al menos un piloto antes de aprobar la reserva y solicitar el pago al cliente."
      );
      return;
    }

    const priceNum = parseFloat(editedPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Precio Inválido", "Por favor ingresa un precio válido mayor a 0.");
      return;
    }

    setIsApproving(true);
    try {
      const reservationRef = doc(db, "aircraft-reservation", targetReservationId);
      await updateDoc(reservationRef, {
        price: grossFromNet(priceNum),
        price_net_usd: priceNum,
        internal_status: "awaiting_payment",
        status_notes: "Vuelo aprobado operativamente con tripulación asignada. Pendiente de pago por el cliente.",
      });

      // Crear notificación para el cliente en Firestore
      if (reservation?.clientId) {
        try {
          const originCode = reservation.originAirport?.iata_code || reservation.trip?.origin_airport_ident || "SGAS";
          const destCode = reservation.destinationAirport?.iata_code || reservation.trip?.destination_airport_ident || "SGCO";
          await addDoc(collection(db, "notifications"), {
            userId: reservation.clientId,
            reservationId: targetReservationId,
            type: "flight_approved",
            title: "¡Vuelo Aprobado! Listo para Pago",
            message: `Tu vuelo chárter ${originCode} ➔ ${destCode} fue aprobado operativamente y tiene tripulación asignada. Completa el pago de USD $${grossFromNet(priceNum).toLocaleString("en-US")} (IVA incluido) vía Bancard vPOS.`,
            read: false,
            created_at: new Date(),
            routeText: `${originCode} ➔ ${destCode}`,
            amountUsd: grossFromNet(priceNum),
          });
        } catch (notifErr) {
          console.warn("No se pudo registrar documento en notifications:", notifErr);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["direct-reservation-detail", targetReservationId] });
      await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["client-notifications"] });

      Toast.show({
        type: "success",
        text1: "¡Vuelo Aprobado!",
        text2: "Listo para enviar el link de pago al cliente.",
      });
    } catch (error) {
      console.error("Error al aprobar vuelo:", error);
      Alert.alert("Error", "No se pudo actualizar el estado de la reserva.");
    } finally {
      setIsApproving(false);
    }
  };

  // Enviar link de pago por WhatsApp (Bancard)
  const handleSendWhatsAppPaymentLink = async () => {
    if (!reservation) return;
    setIsSendingWhatsApp(true);
    try {
      // 1. Link de pago de un solo uso (48 h); el servidor usa el precio guardado al aprobar
      const link = await createPaymentLink(reservation.id);

      const priceVal = link.amountUsd;
      const amountGs = link.amountPygEstimate;
      const originName = reservation.originAirport?.name || reservation.trip?.origin_airport_ident;
      const destName = reservation.destinationAirport?.name || reservation.trip?.destination_airport_ident;
      const clientName = clientUser?.firstName ? `${clientUser.firstName} ${clientUser.lastName}` : "Estimado/a cliente";

      // Enlace de checkout oficial de Bancard
      const paymentUrl = link.url;

      const messageText = `Hola ${clientName}! Tu vuelo chárter de ${originName} a ${destName} está confirmado por Operaciones.\n\nEl importe total es de USD $${priceVal.toLocaleString("en-US")} (aprox. ₲ ${amountGs.toLocaleString("es-PY")}).\n\nPodés abonar con tarjeta de crédito/débito a través de la pasarela segura de Bancard en el siguiente enlace:\n${paymentUrl}\n\nAtte. ALTAVIA S.A.`;

      // Formatear teléfono para WhatsApp (+595)
      const rawPhone = clientUser?.phone || "";
      let cleanPhone = rawPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "595" + cleanPhone.slice(1);
      } else if (!cleanPhone.startsWith("595") && cleanPhone.length === 9) {
        cleanPhone = "595" + cleanPhone;
      }

      // https://wa.me abre WhatsApp si está instalado (o WhatsApp Web) y no requiere declarar el esquema en iOS.
      const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
        : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      await Linking.openURL(waUrl);
    } catch (e: any) {
      console.error("Error al generar enlace de WhatsApp:", e);
      Alert.alert("Error", e?.message || "No se pudo generar el enlace de pago de Bancard.");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const renderPilotItem = ({ item }: { item: PilotProfile }) => {
    const pilotUid = item.user?.uid;
    const fullName =
      `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.trim() ||
      item.user?.email ||
      "Piloto Registrado";
    const isAssigned = pilotUid ? assignedPilotIds.includes(pilotUid) : false;
    const isUpdating = updatingPilotId === pilotUid;

    return (
      <View style={styles.pilotCard}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {/* Pilot Info */}
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.pilotNameText}>{fullName}</Text>
            <Text style={styles.pilotEmailText}>{item.user?.email}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              {item.aeronautical?.licence_type ? (
                <View style={styles.licenceBadge}>
                  <Text style={styles.licenceBadgeText}>
                    {item.aeronautical.licence_type}
                  </Text>
                </View>
              ) : null}
              {item.isEncargado ? (
                <View style={styles.encargadoBadge}>
                  <Text style={styles.encargadoBadgeText}>Encargado</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Action Checkbox */}
          <TouchableOpacity
            onPress={() => togglePilotAssignment(item)}
            disabled={isUpdating}
            style={{ padding: 8 }}
            activeOpacity={0.7}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#030436" />
            ) : (
              <View
                style={[
                  styles.checkboxBase,
                  isAssigned && styles.checkboxAssigned,
                ]}
              >
                {isAssigned && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const isLoading = isLoadingPilots || isLoadingReservations || isLoadingDirectRes;
  const displayModel = reservation?.aircraftSpecs?.basic_specs?.model || "Aeronave";
  const displayRegistration = reservation?.aircraftSpecs?.basic_specs?.registration || "";
  const originIdent = reservation?.originAirport?.iata_code || reservation?.trip?.origin_airport_ident || "SGAS";
  const destIdent = reservation?.destinationAirport?.iata_code || reservation?.trip?.destination_airport_ident || "SGCO";

  return (
    <ThemedView className="flex-1 px-4 pt-2" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Tripulación y tarifa" subtitle="Asignar piloto y aprobar" withInset={false} />

      {/* Target Flight Card */}
      <View style={styles.flightSummaryCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.flightSummaryEyebrow}>Vuelo seleccionado:</Text>
            <Text style={styles.flightSummaryTitle}>{displayModel}</Text>
          </View>
          {displayRegistration ? (
            <View style={styles.registrationBadge}>
              <Text style={styles.registrationText}>{displayRegistration}</Text>
            </View>
          ) : null}
        </View>

        {/* Route Row */}
        <View style={styles.routeRow}>
          <Text style={styles.routeAirportCode}>{originIdent}</Text>
          <MaterialCommunityIcons name="airplane" size={16} color="#0165FF" />
          <Text style={styles.routeAirportCode}>{destIdent}</Text>
          <View style={{ flex: 1 }} />
          <View style={styles.crewCountBadge}>
            <Text style={styles.crewCountText}>{assignedPilotIds.length} tripulante(s)</Text>
          </View>
        </View>

        {/* Client preview row */}
        {clientUser && (
          <View style={styles.clientPreviewRow}>
            <Ionicons name="person-circle-outline" size={16} color="#CBD5E1" />
            <Text style={styles.clientPreviewText} numberOfLines={1}>
              Cliente: {clientUser.firstName} {clientUser.lastName} ({clientUser.phone || clientUser.email})
            </Text>
          </View>
        )}
      </View>

      {/* PRICE ADJUSTMENT CARD */}
      <View style={styles.priceCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="cash-outline" size={18} color="#0165FF" />
            <Text style={styles.priceCardLabel}>Precio del Vuelo (USD)</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsEditingPrice(!isEditingPrice)}
            style={styles.editPriceButton}
          >
            <Ionicons name={isEditingPrice ? "checkmark" : "pencil"} size={14} color="#030436" />
            <Text style={styles.editPriceText}>{isEditingPrice ? "Listo" : "Modificar"}</Text>
          </TouchableOpacity>
        </View>

        {isEditingPrice ? (
          <View style={styles.priceInputRow}>
            <Text style={styles.priceCurrencySign}>$</Text>
            <TextInput
              value={editedPrice}
              onChangeText={setEditedPrice}
              keyboardType="numeric"
              placeholder="0"
              style={styles.priceInputField}
            />
            <Text style={styles.priceCurrencyTag}>USD</Text>
          </View>
        ) : (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.priceValueDisplay}>
              USD ${parseFloat(editedPrice || "0").toLocaleString("en-US")} + IVA
            </Text>
            <Text style={styles.pricePygDisplay}>
              Total a cobrar USD ${grossFromNet(parseFloat(editedPrice) || 0).toLocaleString("en-US")} · aprox. ₲ {Math.round(grossFromNet(parseFloat(editedPrice) || 0) * currentDolar).toLocaleString("es-PY")} (T.C. {currentDolar.toLocaleString("es-PY")})
            </Text>
          </View>
        )}
      </View>

      {/* Pilots Section Title */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 4 }}>
        <Text style={styles.sectionTitle}>Pilotos Disponibles</Text>
        <Text style={styles.sectionSubtitle}>Selecciona la tripulación</Text>
      </View>

      {/* Pilots List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#030436" />
          <Text style={{ color: "#64748B", marginTop: 8 }}>Cargando información...</Text>
        </View>
      ) : pilots.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <Ionicons name="people-outline" size={40} color="#94A3B8" />
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#334155", marginTop: 10 }}>
            Sin pilotos vinculados
          </Text>
          <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 4 }}>
            No se encontraron pilotos en la flota para asignar a esta aeronave.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pilots}
          renderItem={renderPilotItem}
          keyExtractor={(item) => item.user?.uid || item.basic?.id_number || Math.random().toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {/* Bottom Actions Bar */}
      <View style={styles.bottomBarContainer}>
        {/* Status Banners & Specific CTAs */}
        {reservation?.internal_status === "awaiting_payment" ? (
          <View style={{ gap: 8, marginBottom: 8 }}>
            <View style={styles.awaitingPaymentNotice}>
              <Ionicons name="information-circle" size={18} color="#1e40af" />
              <Text style={styles.awaitingPaymentText}>
                Vuelo aprobado. Pendiente de que el cliente realice el pago.
              </Text>
            </View>

            {/* CTA 1: Enviar link de pago por WhatsApp */}
            <TouchableOpacity
              onPress={handleSendWhatsAppPaymentLink}
              disabled={isSendingWhatsApp}
              style={styles.whatsappButton}
              activeOpacity={0.8}
            >
              {isSendingWhatsApp ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                  <Text style={styles.whatsappButtonText}>Enviar Link de Pago por WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : reservation?.internal_status === "confirmed" ? (
          <View style={{ gap: 8, marginBottom: 8 }}>
            <View style={styles.confirmedNotice}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmedTitle}>Pago Confirmado • Bancard vPOS</Text>
                {reservation.invoice_number && (
                  <Text style={styles.confirmedSub}>
                    Factura Electrónica: {reservation.invoice_number}
                  </Text>
                )}
              </View>
            </View>

            {/* CTA: Ver y Compartir Factura */}
            <TouchableOpacity
              onPress={() => generateAndShareInvoicePdf(reservation, clientUser?.email || undefined)}
              style={styles.invoiceButton}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.invoiceButtonText}>Ver / Enviar Factura por WhatsApp (PDF)</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Primary Approve Button (when pending) */}
        {(!reservation || reservation.internal_status === "pending_approval" || reservation.internal_status === "pending") && (
          <TouchableOpacity
            onPress={handleApproveFlight}
            disabled={isApproving}
            style={[
              styles.approveButton,
              assignedPilotIds.length === 0 && styles.approveButtonDisabled,
            ]}
            activeOpacity={0.8}
          >
            {isApproving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={assignedPilotIds.length === 0 ? "#94A3B8" : "#FFFFFF"}
                />
                <Text
                  style={[
                    styles.approveButtonText,
                    assignedPilotIds.length === 0 && styles.approveButtonTextDisabled,
                  ]}
                >
                  Aprobar Vuelo y Notificar Tarifa
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: "NotoSans_600SemiBold",
    color: "#030436",
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  flightSummaryCard: {
    backgroundColor: "#030436",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  flightSummaryEyebrow: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "NotoSans_500Medium",
  },
  flightSummaryTitle: {
    fontSize: 17,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
    marginTop: 2,
  },
  registrationBadge: {
    backgroundColor: "#0165FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  registrationText: {
    fontSize: 11,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  routeAirportCode: {
    fontSize: 14,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
  crewCountBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  crewCountText: {
    fontSize: 12,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
  clientPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  clientPreviewText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#CBD5E1",
    flex: 1,
  },
  priceCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  priceCardLabel: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  editPriceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editPriceText: {
    fontSize: 11,
    fontFamily: "NotoSans_600SemiBold",
    color: "#030436",
  },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#0165FF",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  priceCurrencySign: {
    fontSize: 18,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    marginRight: 4,
  },
  priceInputField: {
    flex: 1,
    fontSize: 18,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    paddingVertical: 6,
  },
  priceCurrencyTag: {
    fontSize: 12,
    fontFamily: "NotoSans_700Bold",
    color: "#94A3B8",
  },
  priceValueDisplay: {
    fontSize: 20,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  pricePygDisplay: {
    fontSize: 11,
    color: "#059669",
    fontFamily: "NotoSans_600SemiBold",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  sectionSubtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#64748B",
  },
  pilotCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  pilotNameText: {
    fontSize: 15,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  pilotEmailText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  licenceBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  licenceBadgeText: {
    fontSize: 11,
    fontFamily: "NotoSans_600SemiBold",
    color: "#475569",
  },
  encargadoBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  encargadoBadgeText: {
    fontSize: 11,
    fontFamily: "NotoSans_700Bold",
    color: "#92400E",
  },
  checkboxBase: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxAssigned: {
    backgroundColor: "#030436",
    borderColor: "#030436",
  },
  bottomBarContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
    paddingBottom: 24,
  },
  awaitingPaymentNotice: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  awaitingPaymentText: {
    fontSize: 12,
    color: "#1E40AF",
    fontFamily: "NotoSans_600SemiBold",
    flex: 1,
  },
  whatsappButton: {
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  whatsappButtonText: {
    fontSize: 14,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
  confirmedNotice: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmedTitle: {
    fontSize: 12,
    fontFamily: "NotoSans_700Bold",
    color: "#065F46",
  },
  confirmedSub: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#047857",
  },
  invoiceButton: {
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  invoiceButtonText: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
  approveButton: {
    backgroundColor: "#0165FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  approveButtonDisabled: {
    backgroundColor: "#E2E8F0",
  },
  approveButtonText: {
    fontSize: 14,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
  approveButtonTextDisabled: {
    color: "#94A3B8",
  },
});
