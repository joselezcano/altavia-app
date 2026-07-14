import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

const CURRENT_CONTRACT_VERSION = "1.0";

export default function TermsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasCheckedDisclaimer, setHasCheckedDisclaimer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detectar si el usuario llegó al final del ScrollView
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 50; // Tolerancia de 50px
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // 1. Obtener IP pública del usuario
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const ipAddress = ipData.ip;

      // 2. Crear el registro inmutable (Log Legal)
      await addDoc(collection(db, "legal_logs"), {
        userId: user.uid,
        email: user.email,
        timestamp: serverTimestamp(),
        ipAddress: ipAddress,
        deviceBrand: Device.brand || "Unknown",
        deviceModelName: Device.modelName || "Unknown",
        osName: Device.osName || Platform.OS,
        osVersion: Device.osVersion || Platform.Version,
        contractVersion: CURRENT_CONTRACT_VERSION,
        documentType: "TERMINOS_Y_CONDICIONES_CLIENTE",
        acceptedDisclaimer: true,
      });

      // 3. Actualizar el perfil del usuario para habilitar su acceso a la app
      await updateDoc(doc(db, "users", user.uid), {
        acceptedTermsVersion: CURRENT_CONTRACT_VERSION,
        updatedAt: serverTimestamp(),
      });

      // 4. Redirigir al inicio del cliente
      router.replace("/(client)");
    } catch (error) {
      console.error("Error al registrar aceptación legal:", error);
      Alert.alert(
        "Error de conexión",
        "No pudimos registrar tu aceptación. Verifica tu conexión a internet e intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView className="flex-1 pt-12">
      <View className="px-6 pb-4 border-b border-slate-200">
        <ThemedText type="title" className="text-2xl">
          Acuerdos Legales
        </ThemedText>
        <ThemedText type="caption">
          Desliza hasta el final para continuar
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-4"
        onScroll={handleScroll}
        scrollEventThrottle={16} // Frecuencia de actualización del evento scroll
      >
        <ThemedText className="mb-4 text-justify">
          TÉRMINOS Y CONDICIONES DE USO - ALTAVIA S.A.
        </ThemedText>
        <ThemedText className="mb-4 text-justify">
          Al utilizar esta plataforma, usted declara comprender que ALTAVIA
          actúa exclusivamente como un intermediario tecnológico entre el
          usuario y los operadores aéreos o propietarios de aeronaves.
        </ThemedText>

        {/* Aquí va el texto largo completo (Placeholder para simular altura) */}
        <View className="h-[1200px]">
          <ThemedText className="text-slate-400 mt-10 text-center">
            [Contenido extenso del contrato legal provisto por los abogados.
            Debe ocupar suficiente espacio para forzar el scroll.]
          </ThemedText>
        </View>

        <ThemedText className="mb-8 font-bold text-center">
          FIN DEL DOCUMENTO
        </ThemedText>
      </ScrollView>

      {/* Footer Fijo con Controles de Aceptación */}
      <View className="p-6 bg-brand-light border-t border-slate-200">
        <TouchableOpacity
          className="flex-row items-center mb-6"
          onPress={() => setHasCheckedDisclaimer(!hasCheckedDisclaimer)}
          disabled={!hasScrolledToBottom} // Opcional: Impedir marcar el check si no ha scrolleado
        >
          <View
            className={`w-6 h-6 rounded border items-center justify-center mr-3 ${hasCheckedDisclaimer ? "bg-brand-blue border-brand-blue" : "border-slate-400 bg-white"}`}
          >
            {hasCheckedDisclaimer && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>
          <ThemedText
            className={`flex-1 ${!hasScrolledToBottom ? "opacity-50" : ""}`}
          >
            Confirmo que leí y acepto los Términos, entiendo que la plataforma
            es un intermediario tecnológico y no una aerolínea.
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          className={`rounded-xl py-4 items-center shadow-sm ${!hasScrolledToBottom || !hasCheckedDisclaimer ? "bg-slate-300" : "bg-brand-blue active:bg-brand-blue/90"}`}
          onPress={handleAccept}
          disabled={
            !hasScrolledToBottom || !hasCheckedDisclaimer || isSubmitting
          }
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText className="text-white font-bold text-lg">
              ACEPTO
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}
