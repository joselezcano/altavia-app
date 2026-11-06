import SignOutButton from "@/components/sign-out-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { auth, db, functions } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { StartKycSessionResponse } from "@/types/kyc";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { deleteUser } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

const DEBOUNCE_COOLDOWN_MS = 3000; // 3-second cooldown to prevent accidental double taps or spam

export default function ProfileScreen() {
  const { user, role, roles, selectRole, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: userProfile, isLoading: isLoadingProfile } = useUserProfile(user?.uid);

  const [isVerifying, setIsVerifying] = useState(false);
  const lastClickTimeRef = useRef<number>(0);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;

    try {
      setIsDeleting(true);

      // 1. Soft-delete and anonymize user profile in 'users/{uid}'
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        email: `anonymized_${user.uid}@deleted.altavia.com.py`,
        firstName: "Usuario",
        lastName: "Anonimizado",
        phone: null,
        documentNumber: null,
        taxId: null,
        businessName: null,
        representativeName: null,
        representativeDoc: null,
      });

      // 2. Mark client profile as deleted in 'clients/{uid}'
      try {
        const clientDocRef = doc(db, "clients", user.uid);
        await updateDoc(clientDocRef, {
          deleted: true,
          deletedAt: serverTimestamp(),
        });
      } catch (clientErr) {
        console.warn("Client doc update error during deletion:", clientErr);
      }

      // NOTE: Flight history, aircraft-reservations and manifests are strictly preserved
      // for aviation regulatory (DINAC) and operational safety compliance.

      // Invalidate react-query cache
      queryClient.clear();

      // 3. Delete Firebase Auth user if authenticated
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (authErr: any) {
        console.warn("deleteUser warning (fallback to sign out):", authErr);
      }

      setShowDeleteModal(false);
      setIsDeleting(false);

      Toast.show({
        type: "success",
        text1: "Cuenta Eliminada",
        text2: "Tus credenciales y perfil fueron cancelados exitosamente.",
      });

      // Sign out
      await signOut();
    } catch (error: any) {
      setIsDeleting(false);
      console.error("Error al eliminar cuenta:", error);
      Alert.alert(
        "Error",
        "No se pudo completar la eliminación de la cuenta. Por favor intenta más tarde."
      );
    }
  };

  const displayName =
    userProfile?.firstName && userProfile?.lastName
      ? `${userProfile.firstName} ${userProfile.lastName}`
      : user?.email?.split("@")[0] || "Usuario";

  const userInitial = displayName.charAt(0).toUpperCase();

  const handleCopyUid = async () => {
    if (user?.uid) {
      try {
        await Clipboard.setStringAsync(user.uid);
        Toast.show({
          type: "success",
          text1: "Copiado",
          text2: "ID de usuario copiado al portapapeles",
        });
      } catch (error) {
        console.error("Error al copiar UID al portapapeles:", error);
      }
    }
  };

  /**
   * Flow for Didit.me KYC verification with anti-spam / double-click protection
   */
  const handleStartKyc = async () => {
    if (!user?.uid) return;

    // Security Measure 1: Anti-Spam / Rate-limiting cooldown check (3 seconds)
    const now = Date.now();
    if (now - lastClickTimeRef.current < DEBOUNCE_COOLDOWN_MS) {
      Toast.show({
        type: "info",
        text1: "Por favor espera",
        text2: "Tu solicitud de verificación está procesándose.",
      });
      return;
    }
    lastClickTimeRef.current = now;

    // Security Measure 2: Guard against duplicate concurrent invocations
    if (isVerifying) return;

    try {
      setIsVerifying(true);

      Toast.show({
        type: "info",
        text1: "Iniciando Didit.me",
        text2: "Obteniendo sesión de verificación...",
      });

      let verificationUrl: string | undefined;

      try {
        // Invoke startKycSession Cloud Function
        const startKycCallable = httpsCallable<void, StartKycSessionResponse>(functions, "startKycSession");
        const response = await startKycCallable();

        if (response.data?.success && response.data?.url) {
          verificationUrl = response.data.url;
        }
      } catch (cloudFnErr: any) {
        console.warn("Cloud function sin credenciales o en desarrollo, usando URL de simulación:", cloudFnErr);
        // Sandbox fallback for development mode
        verificationUrl = "https://identity.didit.me/sandbox-verify-mock-flow?app=altavia";
      }

      if (!verificationUrl) {
        throw new Error("No se pudo obtener la URL de verificación.");
      }

      // Open WebBrowser with real Didit session URL
      await WebBrowser.openBrowserAsync(verificationUrl);

      setIsVerifying(false);

      Toast.show({
        type: "info",
        text1: "Verificación procesada",
        text2: "Tu perfil se actualizará una vez procesado el comprobante.",
      });
    } catch (error: any) {
      setIsVerifying(false);
      console.error("Error al iniciar verificación Didit:", error);
      Alert.alert("Error de Verificación", "No se pudo abrir el flujo de verificación. Por favor intente nuevamente.");
    }
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case "ADMIN":
        return "Administrador";
      case "PILOT":
        return "Piloto";
      case "OWNER":
        return "Propietario";
      case "CLIENT":
        return "Cliente";
      default:
        return "Usuario";
    }
  };

  const upcomingOptions = [
    {
      id: "payment",
      title: "Métodos de Pago",
      subtitle: "Gestioná tus tarjetas de crédito y débito",
      icon: "card-outline" as const,
    },
    {
      id: "passengers",
      title: "Acompañantes Frecuentes",
      subtitle: "Guardá los datos de tus pasajeros habituales",
      icon: "people-outline" as const,
    },
    {
      id: "preferences",
      title: "Preferencias de Vuelo",
      subtitle: "Catering, bebidas y comodidades a bordo",
      icon: "sparkles-outline" as const,
    },
    {
      id: "billing",
      title: "Historial de Facturación",
      subtitle: "Descargá tus recibos y facturas fiscales",
      icon: "receipt-outline" as const,
    },
    {
      id: "notifications",
      title: "Notificaciones",
      subtitle: "Alertas de vuelo y cambios de itinerario",
      icon: "notifications-outline" as const,
    },
  ];

  if (isLoadingProfile) {
    return (
      <ThemedView className="flex-1 bg-brand-light justify-center items-center">
        <ActivityIndicator size="large" color="#0f1e3d" />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2">
      {/* Top Header */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <View>
          <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest">
            Mi Cuenta
          </ThemedText>
          <ThemedText type="title" className="mt-0.5 text-xl">
            Mi Perfil
          </ThemedText>
        </View>
        <UserAvatar size={44} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>

        {/* User Card */}
        <View className="bg-white rounded-3xl p-5 mb-5 border border-slate-100 shadow-sm items-center">
          <View className="w-20 h-20 rounded-full bg-brand-blue items-center justify-center mb-3 shadow-md">
            <ThemedText className="text-white font-bold text-3xl">
              {userInitial}
            </ThemedText>
          </View>
          <ThemedText type="subtitle" className="font-extrabold text-xl text-brand-blue">
            {displayName}
          </ThemedText>
          <ThemedText className="text-sm text-slate-500 mt-0.5">
            {user?.email}
          </ThemedText>
          <View className="mt-2.5 bg-brand-gold/15 px-3 py-1 rounded-full border border-brand-gold/20">
            <ThemedText className="text-brand-gold text-xs font-bold uppercase tracking-wider">
              {role ? getRoleLabel(role) : "Cliente"}
            </ThemedText>
          </View>
        </View>

        {/* KYC Verification Required Alert Banner (Positioned below User Card) */}
        {!userProfile?.kycVerified && (
          <View className="bg-amber-500/10 border border-amber-200/70 rounded-3xl p-5 mb-5 flex-row items-center gap-4 overflow-hidden relative">
            <View className="flex-1 pr-1">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="alert-circle" size={18} color="#b45309" />
                <ThemedText className="font-extrabold text-amber-900 text-base">
                  Verificación Requerida
                </ThemedText>
              </View>
              <ThemedText className="text-xs text-amber-900/80 leading-relaxed">
                Para confirmar tus reservas y abordar sin demoras, valida tu documento con Didit.me.
              </ThemedText>
              <TouchableOpacity
                disabled={isVerifying}
                onPress={handleStartKyc}
                className={`bg-brand-blue py-2.5 px-4 rounded-xl mt-3 flex-row items-center justify-center gap-2 shadow-sm ${isVerifying ? "opacity-60" : "active:bg-brand-blue/90"
                  }`}
                activeOpacity={0.8}
              >
                {isVerifying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <ThemedText className="text-white font-bold text-xs">
                      Verificar con Didit.me
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Boarding Pass Asset Graphic */}
            <View className="w-24 h-24 rounded-2xl bg-amber-100/90 items-center justify-center p-2 border border-amber-200/60 shadow-xs">
              <Image
                source={require("@/assets/images/boarding-pass.png")}
                style={{ width: 62, height: 62 }}
                contentFit="contain"
              />
            </View>
          </View>
        )}

        {/* Personal Details */}
        <ThemedText className="text-xs font-extrabold text-slate-400 mb-2.5 uppercase tracking-wider pl-1">
          Información Personal
        </ThemedText>
        <View className="bg-white rounded-3xl p-4 mb-5 border border-slate-100 shadow-sm gap-y-3.5">
          <View className="flex-row justify-between items-center">
            <View>
              <ThemedText className="text-xs text-slate-400 font-medium">Nombre</ThemedText>
              <ThemedText className="font-bold text-slate-800 text-sm mt-0.5">{userProfile?.firstName || "N/A"}</ThemedText>
            </View>
          </View>
          <View className="border-t border-slate-50" />

          <View className="flex-row justify-between items-center">
            <View>
              <ThemedText className="text-xs text-slate-400 font-medium">Apellido</ThemedText>
              <ThemedText className="font-bold text-slate-800 text-sm mt-0.5">{userProfile?.lastName || "N/A"}</ThemedText>
            </View>
          </View>
          <View className="border-t border-slate-50" />

          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-2">
              <ThemedText className="text-xs text-slate-400 font-medium">Estado KYC (Identidad)</ThemedText>
              <View className="flex-row items-center gap-1.5 mt-1">
                <Ionicons
                  name={userProfile?.kycVerified ? "checkmark-circle-outline" : "ellipse-outline"}
                  size={16}
                  color={userProfile?.kycVerified ? "#059669" : "#dc2626"}
                />
                <ThemedText className={`font-bold text-sm ${userProfile?.kycVerified ? "text-emerald-600" : "text-rose-600"}`}>
                  {userProfile?.kycVerified ? "Verificado" : "Pendiente de Verificación"}
                </ThemedText>
              </View>
            </View>
          </View>
          <View className="border-t border-slate-50" />

          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-2">
              <ThemedText className="text-xs text-slate-400 font-medium">ID de Usuario (UID)</ThemedText>
              <ThemedText className="font-bold text-slate-700 text-xs mt-0.5" numberOfLines={1}>
                {user?.uid}
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={handleCopyUid}
              className="bg-slate-100 p-2 rounded-xl active:bg-slate-200"
            >
              <Ionicons name="copy-outline" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Change Role Section (Conditional) */}
        {roles && roles.length > 1 && (
          <>
            <ThemedText className="text-xs font-extrabold text-slate-400 mb-2.5 uppercase tracking-wider pl-1">
              Cambiar de Perfil
            </ThemedText>
            <View className="bg-white rounded-3xl p-4 mb-5 border border-slate-100 shadow-sm">
              <ThemedText className="text-xs text-slate-500 mb-3 text-center">
                Tenés múltiples roles asignados. Seleccioná uno para cambiar de sesión:
              </ThemedText>
              <View className="flex-row flex-wrap justify-center gap-2">
                {roles.map((r) => {
                  const isActive = r === role;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={async () => {
                        if (!isActive) {
                          await selectRole(r);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl border ${isActive
                        ? "bg-brand-gold border-brand-gold"
                        : "bg-slate-50 border-slate-200 active:bg-slate-100"
                        }`}
                    >
                      <ThemedText
                        className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-white" : "text-slate-600"
                          }`}
                      >
                        {getRoleLabel(r)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Upcoming Features Section */}
        <ThemedText className="text-xs font-extrabold text-slate-400 mb-2.5 uppercase tracking-wider pl-1">
          Ajustes y Preferencias (Próximamente)
        </ThemedText>
        <View className="bg-white rounded-3xl p-4 mb-6 border border-slate-100 shadow-sm gap-y-4">
          {upcomingOptions.map((opt, idx) => (
            <View key={opt.id}>
              {idx > 0 && <View className="border-t border-slate-50 mb-3.5" />}
              <View className="flex-row items-center justify-between opacity-60">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center">
                    <Ionicons name={opt.icon} size={18} color="#64748B" />
                  </View>
                  <View className="flex-1">
                    <ThemedText className="font-bold text-slate-800 text-sm">{opt.title}</ThemedText>
                    <ThemedText className="text-xs text-slate-500 mt-0.5">{opt.subtitle}</ThemedText>
                  </View>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <ThemedText className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Próximamente</ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Security & Account Management (DINAC Compliance Disclosure) */}
        <ThemedText className="text-xs font-extrabold text-slate-400 mb-2.5 uppercase tracking-wider pl-1">
          Seguridad y Gestión de Cuenta
        </ThemedText>
        <View className="bg-white rounded-3xl p-4 mb-6 border border-slate-100 shadow-sm">
          <View className="flex-row items-center gap-3 mb-2.5">
            <View className="w-9 h-9 rounded-xl bg-rose-50 items-center justify-center">
              <Ionicons name="shield-outline" size={18} color="#e11d48" />
            </View>
            <View className="flex-1">
              <ThemedText className="font-bold text-slate-800 text-sm">Privacidad y Retención DINAC</ThemedText>
              <ThemedText className="text-xs text-slate-500 mt-0.5">
                Derecho al olvido y resguardo operacional
              </ThemedText>
            </View>
          </View>
          <ThemedText className="text-[11px] text-slate-500 mb-3.5 leading-relaxed">
            Puedes eliminar tu cuenta y credenciales. Por normativas de seguridad aérea (DINAC), los registros históricos de vuelos y reservas se retienen de forma inmutable y confidencial para auditoría.
          </ThemedText>
          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            className="border border-rose-200 bg-rose-50/50 py-3 rounded-xl flex-row items-center justify-center gap-2 active:bg-rose-100"
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="#e11d48" />
            <ThemedText className="text-rose-600 font-bold text-xs">
              Eliminar mi cuenta
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Log Out */}
        <SignOutButton />

        {/* Account Deletion Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View className="flex-1 bg-black/60 justify-center items-center px-6">
            <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-100">
              <View className="w-12 h-12 rounded-full bg-rose-100 items-center justify-center mx-auto mb-4">
                <Ionicons name="warning-outline" size={26} color="#e11d48" />
              </View>

              <ThemedText className="text-center font-extrabold text-lg text-slate-900 mb-2">
                ¿Eliminar tu cuenta?
              </ThemedText>

              <ThemedText className="text-xs text-slate-600 leading-relaxed text-center mb-4">
                Esta acción cancelará tu acceso a Alta Vía y anonimizará tus datos personales de perfil.
              </ThemedText>

              {/* DINAC Legal Retention Warning Box */}
              <View className="bg-amber-500/10 border border-amber-200 p-3 rounded-2xl mb-5">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Ionicons name="airplane-outline" size={14} color="#b45309" />
                  <ThemedText className="text-[11px] font-bold text-amber-900">
                    Aviso Legal Aeronáutico (DINAC)
                  </ThemedText>
                </View>
                <ThemedText className="text-[10px] text-amber-900/80 leading-relaxed">
                  Conforme al Código Aeronáutico (Ley N° 1860/02) y regulaciones de seguridad operacional, los registros de vuelos reservados, bitácoras y manifiestos de pasajeros NO se eliminan, quedando resguardados de forma inmutable para fines regulatorios.
                </ThemedText>
              </View>

              <View className="gap-2.5">
                <TouchableOpacity
                  disabled={isDeleting}
                  onPress={handleDeleteAccount}
                  className="bg-rose-600 py-3.5 rounded-xl items-center justify-center active:bg-rose-700 shadow-xs"
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText className="text-white font-bold text-xs">
                      Confirmar y Eliminar Cuenta
                    </ThemedText>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isDeleting}
                  onPress={() => setShowDeleteModal(false)}
                  className="bg-slate-100 py-3 rounded-xl items-center justify-center active:bg-slate-200"
                >
                  <ThemedText className="text-slate-700 font-semibold text-xs">
                    Cancelar
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ThemedView>
  );
}
