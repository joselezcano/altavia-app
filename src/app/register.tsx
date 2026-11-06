import { AppleAuthButton } from "@/components/apple-auth-button";
import { TermsModal } from "@/components/terms-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppleAuthAvailable } from "@/hooks/useAppleAuthAvailable";
import { useAuth } from "@/hooks/useAuth";
import { useResponsive } from "@/hooks/use-responsive";
import {
  initSocialAuth,
  loginWithApple,
  loginWithGoogle,
} from "@/services/auth-social";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setRegistrationMetadata } = useAuth();
  const isAppleAvailable = useAppleAuthAvailable();
  const { isWideScreen } = useResponsive();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Loading States
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const isSubmitting = googleLoading || appleLoading;

  useEffect(() => {
    initSocialAuth();
  }, []);

  const handleGoogleSignUp = async () => {
    if (isSubmitting) return;

    if (!termsAccepted) {
      Alert.alert(
        "Términos Requeridos",
        "Debes aceptar los Términos y Condiciones para registrarte."
      );
      return;
    }

    setRegistrationMetadata({
      termsAccepted: true,
      referralSource: null,
    });

    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success && !res.cancelled) {
        Alert.alert("Error de Google", res.error?.message || "No se pudo registrar con Google.");
      }
    } catch (error: any) {
      Alert.alert("Error de Google", error.message || "No se pudo registrar con Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    if (isSubmitting) return;

    if (!termsAccepted) {
      Alert.alert(
        "Términos Requeridos",
        "Debes aceptar los Términos y Condiciones para registrarte."
      );
      return;
    }

    setRegistrationMetadata({
      termsAccepted: true,
      referralSource: null,
    });

    setAppleLoading(true);
    try {
      const res = await loginWithApple();
      if (!res.success && !res.cancelled) {
        Alert.alert("Error con Apple", res.error?.message || "No se pudo registrar con Apple.");
      }
    } catch (error: any) {
      Alert.alert("Error con Apple", error.message || "No se pudo registrar con Apple.");
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <ThemedView
      className="flex-1 bg-brand-light"
      style={{
        paddingTop: insets.top + (Platform.OS === "ios" ? 10 : 20),
        paddingBottom: insets.bottom + 16,
      }}
    >
      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === "android" ? 0 : 100}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          isWideScreen && styles.wideScrollContainer,
        ]}
      >
        <View style={[styles.card, isWideScreen && styles.wideCard]}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.replace("/login")}
            disabled={isSubmitting}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
            <ThemedText className="font-semibold text-slate-800 text-sm">
              Volver a Iniciar Sesión
            </ThemedText>
          </TouchableOpacity>

          {/* Header Title */}
          <View className="mb-6">
            <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[11px]">
              Paso 1 de 2 • Alta Vía
            </ThemedText>
            <ThemedText type="title" className="text-3xl font-black text-brand-blue mt-0.5">
              Crear Cuenta
            </ThemedText>
            <ThemedText className="text-xs text-slate-500 mt-1 leading-relaxed">
              Regístrate de forma rápida y segura con tu cuenta de Google o Apple para acceder a la plataforma.
            </ThemedText>
          </View>

          {/* Checkbox de Términos y Condiciones */}
          <View style={styles.termsBox}>
            <View style={styles.termsRow}>
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={() => setTermsAccepted(!termsAccepted)}
                style={[
                  styles.checkbox,
                  termsAccepted ? styles.checkboxActive : styles.checkboxInactive,
                ]}
                activeOpacity={0.7}
              >
                {termsAccepted && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <View className="flex-1">
                <ThemedText className="text-xs text-slate-700 leading-snug">
                  He leído y acepto los{" "}
                  <ThemedText
                    onPress={() => setShowTermsModal(true)}
                    className="font-bold text-brand-blue underline"
                  >
                    Términos y Condiciones
                  </ThemedText>
                  , la Política de Privacidad y la normativa de retención de registros de la DINAC.
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowTermsModal(true)}
                  style={styles.termsLinkRow}
                >
                  <Ionicons name="document-text-outline" size={13} color="#D4AF37" />
                  <ThemedText className="text-[11px] font-bold text-brand-gold ml-1">
                    Leer términos completos
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Botones Sociales */}
          <View style={styles.socialButtonsContainer}>
            {/* Botón Google */}
            <TouchableOpacity
              onPress={handleGoogleSignUp}
              disabled={!termsAccepted || isSubmitting}
              activeOpacity={0.8}
              style={[
                styles.socialButton,
                termsAccepted ? styles.socialButtonActive : styles.socialButtonInactive,
                {
                  opacity: !termsAccepted ? 0.35 : isSubmitting && !googleLoading ? 0.5 : 1,
                },
              ]}
            >
              {googleLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#0F1E3D" />
                  <ThemedText className="font-bold text-slate-800 text-sm ml-2">
                    Registrando con Google...
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="logo-google"
                    size={20}
                    color={termsAccepted ? "#EA4335" : "#94A3B8"}
                  />
                  <ThemedText
                    className="font-bold text-sm ml-2.5"
                    style={{ color: termsAccepted ? "#1E293B" : "#94A3B8" }}
                  >
                    Registrarse con Google
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>

            {/* Botón Apple (Solo iOS) */}
            {isAppleAvailable && (
              <View
                style={{
                  height: 50,
                  opacity: !termsAccepted ? 0.35 : isSubmitting && !appleLoading ? 0.5 : 1,
                }}
                pointerEvents={!termsAccepted || isSubmitting ? "none" : "auto"}
              >
                {appleLoading ? (
                  <View className="flex-1 flex-row bg-black rounded-2xl items-center justify-center">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <ThemedText className="text-white font-bold text-sm ml-2">
                      Registrando con Apple...
                    </ThemedText>
                  </View>
                ) : (
                  <AppleAuthButton onPress={handleAppleSignUp} disabled={!termsAccepted || isSubmitting} />
                )}
              </View>
            )}

            {!termsAccepted && (
              <ThemedText className="text-[11px] text-slate-400 text-center mt-1">
                Acepta los términos arriba para habilitar los métodos de registro
              </ThemedText>
            )}
          </View>

          {/* Enlace para volver a Iniciar Sesión */}
          <View className="flex-row justify-center items-center py-4">
            <ThemedText type="caption" className="text-slate-500 text-sm">
              ¿Ya tienes una cuenta?{" "}
            </ThemedText>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={() => router.replace("/login")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ThemedText type="accent" className="font-bold text-brand-blue text-sm">
                Inicia Sesión
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms Modal */}
        <TermsModal
          visible={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          onAccept={() => setTermsAccepted(true)}
        />
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    flexGrow: 1,
  },
  wideScrollContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  card: {
    width: "100%",
  },
  wideCard: {
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 36,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  termsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: "#0F1E3D",
    borderColor: "#0F1E3D",
  },
  checkboxInactive: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  termsLinkRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  socialButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  socialButtonActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
  },
  socialButtonInactive: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
