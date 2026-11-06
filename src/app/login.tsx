import { AppleAuthButton } from "@/components/apple-auth-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { auth } from "@/config/firebase";
import { useAppleAuthAvailable } from "@/hooks/useAppleAuthAvailable";
import { useResponsive } from "@/hooks/use-responsive";
import {
  initSocialAuth,
  loginWithApple,
  loginWithGoogle,
} from "@/services/auth-social";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAppleAvailable = useAppleAuthAvailable();
  const { isWideScreen } = useResponsive();

  // Email / Password State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const isSubmitting = loading || googleLoading || appleLoading;

  useEffect(() => {
    initSocialAuth();
  }, []);

  const handleEmailLogin = async () => {
    if (isSubmitting) return;
    if (!email || !password) {
      Alert.alert("Error", "Por favor ingresa tu correo y contraseña.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("Inicio de sesión exitoso!");
    } catch (error: any) {
      console.error(error);
      let msg = "Error de acceso.";
      if (error.code === "auth/invalid-credential")
        msg = "Usuario o contraseña incorrectos.";
      if (error.code === "auth/too-many-requests")
        msg = "Demasiados intentos. Intenta más tarde.";
      if (error.code === "auth/user-not-found") msg = "Usuario no encontrado.";
      Alert.alert("Error de Acceso", msg);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success && !res.cancelled) {
        Alert.alert("Error de Google", res.error?.message || "No se pudo iniciar sesión con Google.");
      }
    } catch (error: any) {
      Alert.alert("Error de Google", error.message || "No se pudo iniciar sesión con Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (isSubmitting) return;
    setAppleLoading(true);
    try {
      const res = await loginWithApple();
      if (!res.success && !res.cancelled) {
        Alert.alert("Error de Apple", res.error?.message || "No se pudo iniciar sesión con Apple.");
      }
    } catch (error: any) {
      Alert.alert("Error de Apple", error.message || "No se pudo iniciar sesión con Apple.");
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
        {/* Contenedor Responsivo Central (Tope 480px en iPads/Web) */}
        <View style={[styles.formCard, isWideScreen && styles.wideFormCard]}>
          {/* Cabecera / Logo */}
          <View style={styles.headerContainer}>
            <ThemedText type="title" className="text-4xl tracking-widest font-black text-brand-blue">
              ALTAVIA
            </ThemedText>
            <View style={{ width: 140, height: 2, backgroundColor: "#0165FF" }} />
            <ThemedText
              type="caption"
              className="uppercase tracking-[0.25em] font-bold text-slate-500 text-[11px] mt-0.5"
            >
              Aviation Platform
            </ThemedText>
          </View>

          {/* Formulario Principal de Email y Contraseña */}
          <View style={styles.fieldsContainer}>
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Correo Electrónico
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base"
                placeholder="ejemplo@altavia.com.py"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isSubmitting}
              />
            </View>

            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Contraseña
              </ThemedText>
              <View className="relative justify-center">
                <TextInput
                  className="bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3.5 text-brand-text font-medium text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  className="absolute right-4"
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Botón Principal Ingresar */}
            <TouchableOpacity
              className="bg-brand-blue rounded-xl py-4 items-center mt-3"
              onPress={handleEmailLogin}
              disabled={isSubmitting}
              style={{ opacity: isSubmitting && !loading ? 0.6 : 1 }}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText className="text-white font-bold text-base">
                  Ingresar
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Divisor de Métodos Sociales */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-[1px] bg-slate-200" />
            <ThemedText className="mx-4 text-xs text-slate-400 font-bold uppercase tracking-wider">
              O continuar con
            </ThemedText>
            <View className="flex-1 h-[1px] bg-slate-200" />
          </View>

          {/* Botones de Social Login (Google y Apple) */}
          <View style={styles.socialButtonsContainer}>
            {/* Botón Google */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
              className="bg-white border border-slate-300 rounded-xl py-3.5 px-4 flex-row items-center justify-center"
              style={[
                styles.socialButton,
                { opacity: isSubmitting && !googleLoading ? 0.5 : 1 },
              ]}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#030436" />
                  <ThemedText className="font-bold text-slate-800 text-sm ml-2">
                    Iniciando sesión...
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.buttonContentRow}>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <ThemedText className="font-bold text-slate-800 text-sm ml-2.5">
                    Continuar con Google
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>

            {/* Botón Apple (Solo iOS) */}
            {isAppleAvailable && (
              <View
                style={{
                  height: 50,
                  opacity: isSubmitting && !appleLoading ? 0.5 : 1,
                }}
                pointerEvents={isSubmitting ? "none" : "auto"}
              >
                {appleLoading ? (
                  <View className="flex-1 flex-row bg-black rounded-xl items-center justify-center">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <ThemedText className="text-white font-bold text-sm ml-2">
                      Iniciando con Apple...
                    </ThemedText>
                  </View>
                ) : (
                  <AppleAuthButton onPress={handleAppleLogin} disabled={isSubmitting} />
                )}
              </View>
            )}
          </View>

          {/* Enlace al Registro */}
          <View className="flex-row justify-center items-center py-4">
            <ThemedText type="caption" className="text-slate-500 text-sm">
              ¿Aún no tienes cuenta?{" "}
            </ThemedText>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={() => router.replace("/register")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ThemedText type="accent" className="font-bold text-brand-blue text-sm">
                Regístrate aquí
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
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
  formCard: {
    width: "100%",
  },
  wideFormCard: {
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 36,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
    gap: 6,
    paddingTop: 16,
  },
  fieldsContainer: {
    gap: 14,
  },
  socialButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    height: 50,
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
