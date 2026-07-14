import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, TouchableOpacity, View } from "react-native";

import SignOutButton from "@/components/sign-out-button"; // Importando tu botón
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase"; // Ruta actualizada
import { useAuth } from "@/hooks/useAuth";

const CURRENT_CONTRACT_VERSION = "1.0";

export default function ClientDashboard() {
  const { user, role } = useAuth();
  const router = useRouter();

  const [isCheckingTerms, setIsCheckingTerms] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const verifyLegalStatus = async () => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.acceptedTermsVersion !== CURRENT_CONTRACT_VERSION) {
            router.replace("/(client)/terms");
            return;
          }
        }
      } catch (error) {
        console.error("Error verificando estado legal:", error);
      } finally {
        setIsCheckingTerms(false);
      }
    };

    verifyLegalStatus();
  }, [user]);

  if (isCheckingTerms) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0f1e3d" />
      </ThemedView>
    );
  }

  // Obtener la inicial del correo para el Avatar
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Cabecera con Saludo y Avatar */}
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <ThemedText
            type="caption"
            className="uppercase font-bold text-brand-gold tracking-widest"
          >
            Bienvenido
          </ThemedText>
          <ThemedText type="title" className="mt-1">
            {user?.email?.split("@")[0] || "Pasajero"}
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="w-12 h-12 rounded-full bg-brand-blue items-center justify-center shadow-sm"
        >
          <ThemedText className="text-white font-bold text-lg">
            {userInitial}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Tarjeta Central */}
      <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-200 items-center justify-center h-48">
        <ThemedText type="subtitle" className="mb-2">
          ¿A dónde volamos hoy?
        </ThemedText>
        <ThemedText type="caption" className="text-center">
          El motor de búsqueda y cotización se integrará aquí en la Fase 3 del
          proyecto.
        </ThemedText>
      </View>

      {/* Bottom Modal de Perfil */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {/* Fondo oscuro semitransparente que cierra el modal al tocarlo */}
        <TouchableOpacity
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {/* Contenedor del Bottom Sheet */}
          <View
            className="mt-auto bg-brand-white rounded-t-3xl pt-2 pb-10 px-6 shadow-lg"
            // Evita que tocar dentro del modal lo cierre
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Pequeña barra indicadora de arrastre visual */}
            <View className="w-12 h-1.5 bg-slate-300 rounded-full self-center mb-6" />

            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-brand-blue items-center justify-center shadow-sm mb-4">
                <ThemedText className="text-white font-bold text-3xl">
                  {userInitial}
                </ThemedText>
              </View>

              <ThemedText type="subtitle" className="text-center mb-1">
                Mi Cuenta
              </ThemedText>
              <ThemedText type="caption" className="text-center mb-4">
                {user?.email}
              </ThemedText>

              {/* Badges de Información */}
              <View className="flex-row space-x-2 mb-6">
                <View className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <ThemedText
                    type="caption"
                    className="font-bold text-brand-blue"
                  >
                    ROL: {role}
                  </ThemedText>
                </View>
                <View className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <ThemedText
                    type="caption"
                    className="font-bold text-brand-gold"
                  >
                    VERIFICADO
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Botón de Cerrar Sesión */}
            <SignOutButton />
          </View>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}
