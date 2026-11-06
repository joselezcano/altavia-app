import { fetchPaidReservationFields } from "@/utils/paid-reservation";
import { BancardPaymentModal } from "@/components/bancard-modal";
import { ScreenContainer } from "@/components/screen-container";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { ClientReservationItem } from "@/types/all-roles";
import { generateAndShareInvoicePdf } from "@/utils/electronic-invoice";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function ClientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: reservations = [] } = useClientReservations(user?.uid);
  const [payingReservation, setPayingReservation] = useState<ClientReservationItem | null>(null);

  // Vuelos aprobados por el propietario pendientes de pago por Bancard
  const pendingPaymentFlights = reservations.filter(
    (r) => r.internal_status === "awaiting_payment"
  );
  const activePendingFlight = pendingPaymentFlights.length > 0 ? pendingPaymentFlights[0] : null;

  const firstName = user?.email?.split("@")[0] || "Pasajero";

  const handleBancardPaymentSuccess = async (txData: {
    transactionId: string;
    authorizationCode: string;
    cardBrand?: string;
    cardLast4?: string;
  }) => {
    if (!payingReservation) return;

    try {
      // El servidor (bancardGetConfirmation) ya registró el pago, la factura y la notificación.
      const paid = await fetchPaidReservationFields(payingReservation.id);

      await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["client-notifications"] });

      const updatedResItem: ClientReservationItem = {
          ...payingReservation,
          ...paid,
      };

      setPayingReservation(null);

      // Lanzar vista previa de la factura electrónica PDF
      setTimeout(async () => {
        await generateAndShareInvoicePdf(updatedResItem, user?.email || undefined);
      }, 500);

      Toast.show({
        type: "success",
        text1: "¡Pago Aprobado con Éxito!",
        text2: `Factura Electrónica Nº ${paid.invoice_number ?? ""} emitida.`,
      });
    } catch (error) {
      console.error("Error al registrar pago Bancard en Firestore:", error);
      Alert.alert("Error", "No se pudo actualizar el estado del pago.");
    }
  };

  return (
    <ThemedView className="flex-1 bg-brand-light">
      <ScreenContainer maxWidth={1100}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          bounces={false}
        >
        {/* HERO SECTION / BANNER */}
        <View
          className="bg-brand-blue rounded-b-[40px] px-6 shadow-md overflow-hidden relative"
          style={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
        >
          {/* Decoración de fondo */}
          <View className="absolute -right-20 top-0 opacity-10">
            <Ionicons name="airplane" size={240} color="#FFFFFF" />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-1">
              <ThemedText type="title" className="text-white font-extrabold mb-1">
                Hola, {firstName} 👋
              </ThemedText>
              <ThemedText className="text-white text-base font-medium">
                Bienvenido a AltaGo
              </ThemedText>
            </View>
            <UserAvatar size={44} bgClassName="bg-slate-200" textClassName="text-brand-blue" />
          </View>

          <View className="mt-1">
            <ThemedText className="text-slate-300 text-xs max-w-[85%] leading-relaxed mb-5">
              Experimente el estándar más alto en aviación privada ejecutiva chárter.
            </ThemedText>

            <TouchableOpacity
              onPress={() => router.push("/(client)/book")}
              className="bg-brand-gold py-2.5 px-5 rounded-full self-start flex-row items-center"
              activeOpacity={0.8}
            >
              <ThemedText className="text-brand-blue font-bold mr-2 text-sm">
                Reservar un vuelo
              </ThemedText>
              <Ionicons name="arrow-forward" size={16} color="#030436" />
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTENIDO PRINCIPAL */}
        <View className="px-5 mt-4">
          {/* BANNER DE ALERTA: VUELO APROBADO LISTO PARA PAGO */}
          {activePendingFlight && (
            <View
              className="bg-white rounded-3xl p-5 mb-5 border-2 border-brand-gold"
              style={{
                shadowColor: "#0165FF",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Ionicons name="notifications" size={16} color="#0165FF" />
                  <ThemedText className="text-brand-blue font-extrabold text-xs uppercase tracking-wider">
                    ¡Vuelo Aprobado!
                  </ThemedText>
                </View>
                <View className="bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <ThemedText className="text-[10px] font-extrabold text-amber-800">
                    PAGO PENDIENTE
                  </ThemedText>
                </View>
              </View>

              <ThemedText className="text-brand-blue font-bold text-lg mb-0.5">
                {activePendingFlight.originAirport?.iata_code || "SGAS"} ➔{" "}
                {activePendingFlight.destinationAirport?.iata_code || "SGCO"}
              </ThemedText>

              <ThemedText className="text-slate-500 text-xs leading-4 mb-3">
                Operaciones confirmó tu aeronave y tripulación. Realiza el pago seguro vía Bancard vPOS para emitir tus billetes.
              </ThemedText>

              <View
                className="flex-row items-center justify-between pt-3 border-t border-slate-100"
              >
                <View>
                  <ThemedText className="text-[10px] font-bold text-slate-400 uppercase">
                    Monto Total
                  </ThemedText>
                  <ThemedText className="text-brand-blue font-extrabold text-base">
                    USD ${activePendingFlight.price.toLocaleString("en-US")}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  onPress={() => setPayingReservation(activePendingFlight)}
                  className="bg-brand-gold py-2.5 px-4 rounded-xl flex-row items-center justify-center"
                  style={{
                    gap: 6,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="credit-card-check-outline" size={16} color="#030436" />
                  <ThemedText className="text-brand-blue font-bold text-xs">
                    Pagar con Bancard
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={14} color="#030436" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* QUICK ACTION: MIS VUELOS */}
          <TouchableOpacity
            onPress={() => router.push("/(client)/flights")}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-row items-center justify-between mb-4"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center">
                <Ionicons name="ticket" size={22} color="#030436" />
              </View>
              <View>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <ThemedText className="font-bold text-brand-blue text-base">Mis Vuelos</ThemedText>
                  {pendingPaymentFlights.length > 0 && (
                    <View className="bg-brand-gold px-1.5 py-0.2 rounded-full">
                      <ThemedText className="text-white text-[10px] font-bold">
                        {pendingPaymentFlights.length}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText className="text-slate-500 text-xs mt-0.5">
                  Gestione sus reservas e historial de vuelos
                </ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          {/* ACCIONES SECUNDARIAS */}
          <View className="flex-row justify-between mb-6" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push("/(client)/profile")}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-1 items-center"
              activeOpacity={0.8}
            >
              <View className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center mb-2">
                <Ionicons name="person" size={20} color="#030436" />
              </View>
              <ThemedText className="font-semibold text-brand-blue text-sm">Mi Perfil</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-1 items-center"
              onPress={() => router.push("/(client)/flights")}
              activeOpacity={0.8}
            >
              <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mb-2">
                <Ionicons name="card-outline" size={20} color="#0165FF" />
              </View>
              <ThemedText className="font-semibold text-brand-blue text-sm">Facturación</ThemedText>
            </TouchableOpacity>
          </View>

          {/* DESTINOS DESTACADOS */}
          <ThemedText className="font-bold text-brand-blue text-lg mb-3">
            Destinos Destacados
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
            <View className="w-64 bg-white rounded-2xl p-2 mr-4 shadow-sm border border-slate-100">
              <View className="w-full h-32 rounded-xl mb-3 overflow-hidden">
                <Image
                  source={require("../../../assets/images/Chapa-PY-WRC-2026PNG.webp")}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
              <ThemedText className="font-bold text-brand-blue">WRC Paraguay 2026</ThemedText>
              <ThemedText className="text-xs text-slate-500 mt-1">
                Vuelos nacionales para el{" "}
                <ThemedText className="text-brand-gold font-bold text-xs">Rally Mundial</ThemedText>
              </ThemedText>
            </View>
            <View className="w-64 bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
              <View className="w-full h-32 rounded-xl mb-3 overflow-hidden">
                <Image
                  source={require("../../../assets/images/punta-del-este-visit-casapueblo-hero-1920x890.avif")}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
              <ThemedText className="font-bold text-brand-blue">Punta del Este</ThemedText>
              <ThemedText className="text-xs text-slate-500 mt-1">
                Tus vacaciones{" "}
                <ThemedText className="text-brand-gold font-bold text-xs">más cerca de vos</ThemedText>
              </ThemedText>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </ScreenContainer>

      {/* Modal Bancard vPOS */}
      <BancardPaymentModal
        visible={!!payingReservation}
        reservation={payingReservation}
        onClose={() => setPayingReservation(null)}
        onPaymentSuccess={handleBancardPaymentSuccess}
      />
    </ThemedView>
  );
}
