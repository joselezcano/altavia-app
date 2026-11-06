import { AppleAuthButton } from "@/components/apple-auth-button";
import { auth } from "@/config/firebase";
import { BRAND_COLORS, BRAND_LOGO_ASPECT, BRAND_LOGOS, BRAND_RADII } from "@/constants/brand";
import { useAppleAuthAvailable } from "@/hooks/useAppleAuthAvailable";
import { useResponsive } from "@/hooks/use-responsive";
import {
  initSocialAuth,
  loginWithApple,
  loginWithGoogle,
} from "@/services/auth-social";
import { brandFontFamily } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LOGIN_BACKGROUND = require("../../assets/images/brand/login-background.jpg");

/**
 * Login con la composición del manual de marca (pág. 15): foto a sangre, logo arriba,
 * tagline y acciones abajo sobre un degradado Dark Navy. La lógica de acceso
 * (correo, Google, Apple, registro) es la misma de antes.
 */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAppleAvailable = useAppleAuthAvailable();
  const { isWideScreen } = useResponsive();

  // Email / Password State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const isSubmitting = loading || googleLoading || appleLoading;

  useEffect(() => {
    initSocialAuth();
  }, []);

  const toggleEmailForm = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEmailForm((v) => !v);
  };

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

  const fontRegular = { fontFamily: brandFontFamily(400) };
  const fontSemibold = { fontFamily: brandFontFamily(600) };
  const fontBold = { fontFamily: brandFontFamily(700) };

  return (
    <ImageBackground source={LOGIN_BACKGROUND} resizeMode="cover" style={styles.background}>
      {/* Degradado Dark Navy: suave arriba (logo), profundo abajo (acciones). */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="navyFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BRAND_COLORS.navy} stopOpacity="0.55" />
            <Stop offset="0.3" stopColor={BRAND_COLORS.navy} stopOpacity="0.05" />
            <Stop offset="0.55" stopColor={BRAND_COLORS.navy} stopOpacity="0.25" />
            <Stop offset="1" stopColor={BRAND_COLORS.navy} stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#navyFade)" />
      </Svg>

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === "android" ? 0 : 100}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
          isWideScreen && styles.wideScrollContainer,
        ]}
      >
        <View style={[styles.content, isWideScreen && styles.wideContent]}>
          {/* Logo y tagline */}
          <View style={styles.header}>
            <Image
              source={BRAND_LOGOS.horizontalWhite}
              style={{ width: 190, height: 190 / BRAND_LOGO_ASPECT.horizontal }}
              resizeMode="contain"
              accessibilityLabel="AltaGo"
            />
            <Text style={[styles.tagline, fontRegular]}>
              Vuelos privados{"\n"}
              <Text style={fontBold}>a tu medida.</Text>
            </Text>
          </View>

          <View style={styles.spacer} />

          {/* Acciones */}
          <View style={styles.actions}>
            {/* Google: acción principal (Azur) */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
              style={[styles.primaryButton, { opacity: isSubmitting && !googleLoading ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <View style={styles.row}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={[styles.primaryText, fontSemibold]}>Iniciando sesión...</Text>
                </View>
              ) : (
                <View style={styles.row}>
                  <View style={styles.googleBadge}>
                    <Ionicons name="logo-google" size={16} color="#EA4335" />
                  </View>
                  <Text style={[styles.primaryText, fontSemibold]}>Continuar con Google</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Apple (solo iOS) */}
            {isAppleAvailable && (
              <View
                style={{ height: 52, opacity: isSubmitting && !appleLoading ? 0.5 : 1 }}
                pointerEvents={isSubmitting ? "none" : "auto"}
              >
                {appleLoading ? (
                  <View style={[styles.appleLoading, styles.row]}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.primaryText, fontSemibold]}>Iniciando con Apple...</Text>
                  </View>
                ) : (
                  <AppleAuthButton onPress={handleAppleLogin} disabled={isSubmitting} />
                )}
              </View>
            )}

            {/* Correo y contraseña: botón de contorno que despliega el formulario */}
            <TouchableOpacity
              onPress={toggleEmailForm}
              disabled={isSubmitting}
              style={styles.outlineButton}
              activeOpacity={0.8}
            >
              <View style={styles.row}>
                <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.outlineText, fontSemibold]}>Iniciar sesión con correo</Text>
                <Ionicons name={showEmailForm ? "chevron-up" : "chevron-down"} size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {showEmailForm && (
              <View style={styles.emailForm}>
                <TextInput
                  style={[styles.input, fontRegular]}
                  placeholder="Correo electrónico"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  editable={!isSubmitting}
                />
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, fontRegular]}
                    placeholder="Contraseña"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.primaryButton, { opacity: isSubmitting && !loading ? 0.6 : 1 }]}
                  onPress={handleEmailLogin}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.primaryText, fontSemibold]}>Ingresar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Registro */}
            <View style={[styles.row, styles.registerRow]}>
              <Text style={[styles.registerText, fontRegular]}>¿Aún no tenés cuenta?</Text>
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={() => router.replace("/register")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.registerLink, fontBold]}>Registrate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: BRAND_COLORS.navy,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  wideScrollContainer: {
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
  },
  wideContent: {
    maxWidth: 440,
  },
  header: {
    alignItems: "center",
    gap: 18,
  },
  tagline: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 30,
    textAlign: "center",
    textShadowColor: "rgba(3, 4, 54, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  spacer: {
    flex: 1,
    minHeight: 160,
  },
  actions: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButton: {
    height: 52,
    borderRadius: BRAND_RADII.button,
    backgroundColor: BRAND_COLORS.azur,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  googleBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  appleLoading: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: BRAND_RADII.button,
  },
  outlineButton: {
    height: 52,
    borderRadius: BRAND_RADII.button,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  emailForm: {
    gap: 10,
    paddingTop: 2,
  },
  input: {
    height: 52,
    borderRadius: BRAND_RADII.input,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 16,
  },
  passwordWrapper: {
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    padding: 4,
  },
  registerRow: {
    paddingTop: 8,
    gap: 6,
  },
  registerText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  registerLink: {
    color: BRAND_COLORS.crystal,
    fontSize: 14,
  },
});
