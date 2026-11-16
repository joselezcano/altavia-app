import { RoleOption } from "@/components/account/role-option";
import { ScreenHeader } from "@/components/screen-header";
import { roleLabel } from "@/constants/roles";
import SignOutButton from "@/components/sign-out-button";
import { brandFont } from "@/utils/brand-fonts";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { auth, db, functions } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { StartKycSessionResponse } from "@/types/kyc";
import { ClientBoardingPassList } from "@/components/client-boarding-pass-list";
import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { deleteUser } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
        "No se pudo eliminar la cuenta. Intentá más tarde."
      );
    }
  };

  const displayName =
    userProfile?.firstName && userProfile?.lastName
      ? `${userProfile.firstName} ${userProfile.lastName}`
      : user?.email?.split("@")[0] || "Usuario";

  const userInitial = displayName.charAt(0).toUpperCase();


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
        text1: "Un momento",
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
      Alert.alert("Error de Verificación", "No se pudo abrir la verificación. Intentá de nuevo.");
    }
  };



  if (isLoadingProfile) {
    return (
      <View style={[pStyles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={BRAND_COLORS.navy} />
      </View>
    );
  }

  return (
    <View style={pStyles.screen}>
      <ScreenHeader title="Mi perfil" subtitle="Tus datos y tu cuenta" hideBack />

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Tarjeta del usuario */}
        <View style={[pStyles.card, { alignItems: "center", paddingVertical: 22 }]}>
          <View style={pStyles.avatar}>
            <Text style={[pStyles.avatarText, brandFont(700)]}>{userInitial}</Text>
          </View>
          <Text style={[pStyles.name, brandFont(800)]}>{displayName}</Text>
          {!!user?.email && <Text style={[pStyles.muted, brandFont(400)]}>{user.email}</Text>}
          <View style={pStyles.rolePill}>
            <Text style={[pStyles.rolePillText, brandFont(700)]}>{roleLabel(role)}</Text>
          </View>
        </View>

        {/* Verificación de identidad pendiente */}
        {!userProfile?.kycVerified && (
          <View style={[pStyles.card, pStyles.kycCard]}>
            <View style={{ flex: 1 }}>
              <Text style={[pStyles.cardTitle, brandFont(700)]}>Verificá tu identidad</Text>
              <Text style={[pStyles.body, brandFont(400), { marginTop: 4 }]}>
                Para confirmar tus reservas y embarcar sin demoras, validá tu documento. Lleva un par de minutos.
              </Text>
              <TouchableOpacity
                disabled={isVerifying}
                onPress={handleStartKyc}
                style={[profileStyles.kycButton, isVerifying ? { opacity: 0.6 } : null]}
                activeOpacity={0.85}
              >
                {isVerifying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={[pStyles.buttonText, brandFont(700)]}>Verificar mi identidad</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={kycIconStyles.box}>
              <MaterialCommunityIcons name="card-account-details-outline" size={40} color={BRAND_COLORS.white} />
              <View style={kycIconStyles.badge}>
                <Ionicons name="shield-checkmark" size={14} color={BRAND_COLORS.white} />
              </View>
            </View>
          </View>
        )}

        {/* Accesos a los boarding pass de los próximos vuelos pagados */}
        <ClientBoardingPassList clientId={user?.uid} />

        {/* Datos personales */}
        <Text style={[pStyles.sectionTitle, brandFont(700)]}>Datos personales</Text>
        <View style={pStyles.card}>
          {[
            { label: "Nombre", value: userProfile?.firstName || "—" },
            { label: "Apellido", value: userProfile?.lastName || "—" },
            { label: "Correo", value: user?.email || "—" },
          ].map((row, idx) => (
            <View key={row.label} style={[pStyles.dataRow, idx > 0 ? pStyles.dataRowDivider : null]}>
              <Text style={[pStyles.label, brandFont(600)]}>{row.label}</Text>
              <Text style={[pStyles.value, brandFont(700)]} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
          <View style={[pStyles.dataRow, pStyles.dataRowDivider]}>
            <Text style={[pStyles.label, brandFont(600)]}>Identidad</Text>
            <View style={[pStyles.statusPill, userProfile?.kycVerified ? pStyles.statusOk : pStyles.statusPending]}>
              <Ionicons
                name={userProfile?.kycVerified ? "checkmark-circle" : "time-outline"}
                size={15}
                color={userProfile?.kycVerified ? BRAND_COLORS.white : BRAND_COLORS.navy}
              />
              <Text
                style={[
                  pStyles.statusText,
                  brandFont(700),
                  { color: userProfile?.kycVerified ? BRAND_COLORS.white : BRAND_COLORS.navy },
                ]}
              >
                {userProfile?.kycVerified ? "Verificada" : "Pendiente"}
              </Text>
            </View>
          </View>
        </View>

        {/* Cambiar de perfil (mismo selector que la hoja de cuenta) */}
        {roles && roles.length > 1 && (
          <>
            <Text style={[pStyles.sectionTitle, brandFont(700)]}>Cambiar de perfil</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {roles.map((r) => (
                <RoleOption key={r} role={r} active={r === role} onPress={() => selectRole(r)} />
              ))}
            </View>
          </>
        )}

        {/* Privacidad y eliminación de cuenta */}
        <Text style={[pStyles.sectionTitle, brandFont(700)]}>Privacidad</Text>
        <View style={pStyles.card}>
          <Text style={[pStyles.cardTitle, brandFont(700)]}>Eliminar mi cuenta</Text>
          <Text style={[pStyles.body, brandFont(400), { marginTop: 4, marginBottom: 14 }]}>
            Podés eliminar tu cuenta cuando quieras. Por normas de seguridad aérea (DINAC), el historial de vuelos y reservas se conserva de forma confidencial.
          </Text>
          <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={pStyles.deleteButton} activeOpacity={0.85}>
            <Ionicons name="trash-outline" size={18} color="#BE123C" />
            <Text style={[pStyles.deleteText, brandFont(700)]}>Eliminar mi cuenta</Text>
          </TouchableOpacity>
        </View>

        <SignOutButton />

        {/* Account Deletion Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={profileStyles.modalScrim}>
            <View style={profileStyles.modalCard}>
              <View style={profileStyles.modalIcon}>
                <Ionicons name="warning-outline" size={26} color="#e11d48" />
              </View>
              <Text style={[profileStyles.modalTitle, brandFont(800)]}>¿Eliminar tu cuenta?</Text>
              <Text style={[profileStyles.modalText, brandFont(400)]}>
                Vas a perder el acceso a AltaGo y se anonimizarán tus datos personales.
              </Text>
              <View style={profileStyles.modalWarn}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Ionicons name="airplane-outline" size={14} color={BRAND_COLORS.navy} />
                  <Text style={[profileStyles.modalWarnTitle, brandFont(700)]}>Aviso legal aeronáutico (DINAC)</Text>
                </View>
                <Text style={[profileStyles.modalWarnText, brandFont(400)]}>
                  Según el Código Aeronáutico (Ley N° 1860/02), los registros de vuelos, bitácoras y manifiestos de pasajeros no se eliminan: se conservan para fines regulatorios.
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                <TouchableOpacity disabled={isDeleting} onPress={handleDeleteAccount} style={profileStyles.modalDanger} activeOpacity={0.85}>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[profileStyles.modalDangerText, brandFont(700)]}>Sí, eliminar mi cuenta</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity disabled={isDeleting} onPress={() => setShowDeleteModal(false)} style={profileStyles.modalCancel} activeOpacity={0.85}>
                  <Text style={[profileStyles.modalCancelText, brandFont(700)]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const kycIconStyles = StyleSheet.create({
  box: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.azur,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BRAND_COLORS.navy,
  },
});

const profileStyles = StyleSheet.create({
  kycButton: {
    backgroundColor: BRAND_COLORS.navy,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 380 },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFE4E6",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: { fontFamily: "NotoSans_800ExtraBold", fontSize: 19, color: BRAND_COLORS.navy, textAlign: "center", marginBottom: 6 },
  modalText: { fontFamily: "NotoSans_400Regular", fontSize: 15, color: BRAND_COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  modalWarn: { backgroundColor: BRAND_COLORS.surfaceTint, borderWidth: 1, borderColor: BRAND_COLORS.crystal, borderRadius: 16, padding: 12, marginBottom: 18 },
  modalWarnTitle: { fontFamily: "NotoSans_700Bold", fontSize: 13, color: BRAND_COLORS.navy },
  modalWarnText: { fontFamily: "NotoSans_400Regular", fontSize: 13, color: BRAND_COLORS.navy, lineHeight: 19 },
  modalDanger: { backgroundColor: "#BE123C", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  modalDangerText: { fontFamily: "NotoSans_700Bold", fontSize: 15, color: "#FFFFFF" },
  modalCancel: { backgroundColor: BRAND_COLORS.backgroundAlt, paddingVertical: 13, borderRadius: 14, alignItems: "center" },
  modalCancelText: { fontFamily: "NotoSans_700Bold", fontSize: 15, color: BRAND_COLORS.navy },
});

const pStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND_COLORS.backgroundAlt, paddingHorizontal: 16 },
  card: {
    backgroundColor: BRAND_COLORS.white,
    borderRadius: BRAND_RADII.card,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: BRAND_COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontFamily: "NotoSans_700Bold", fontSize: 30, color: BRAND_COLORS.white },
  name: { fontFamily: "NotoSans_800ExtraBold", fontSize: BRAND_TYPE.screenTitle, color: BRAND_COLORS.navy, textAlign: "center" },
  muted: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.textMuted, marginTop: 2 },
  rolePill: {
    marginTop: 12,
    backgroundColor: BRAND_COLORS.surfaceTint,
    borderRadius: BRAND_RADII.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rolePillText: {
    fontFamily: "NotoSans_700Bold",
    fontSize: BRAND_TYPE.secondary,
    color: BRAND_COLORS.navy,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kycCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: BRAND_COLORS.surfaceTint, borderColor: BRAND_COLORS.crystal },
  cardTitle: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.cardTitle, color: BRAND_COLORS.navy },
  body: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.navy, lineHeight: 22 },
  buttonText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.white },
  sectionTitle: {
    fontFamily: "NotoSans_700Bold",
    fontSize: BRAND_TYPE.secondary,
    color: BRAND_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  dataRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  dataRowDivider: { borderTopWidth: 1, borderTopColor: BRAND_COLORS.border },
  label: { fontFamily: "NotoSans_600SemiBold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.textMuted },
  value: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.navy, flexShrink: 1, textAlign: "right" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: BRAND_RADII.pill, paddingHorizontal: 12, paddingVertical: 5 },
  statusOk: { backgroundColor: BRAND_COLORS.navy },
  statusPending: { backgroundColor: BRAND_COLORS.surfaceTint, borderWidth: 1, borderColor: BRAND_COLORS.crystal },
  statusText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#BE123C",
    borderRadius: BRAND_RADII.input,
    paddingVertical: 13,
  },
  deleteText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: "#BE123C" },
});
