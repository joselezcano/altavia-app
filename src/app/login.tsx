import { auth } from "@/config/firebase";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    // 1. Validaciones básicas
    if (!email || !password) {
      Alert.alert("Error", "Por favor ingresa usuario y contraseña");
      return;
    }
    setLoading(true);

    try {
      // 2. INTENTO DE LOGIN REAL EN FIREBASE
      await signInWithEmailAndPassword(auth, email, password);

      // 3. ¡NO NAVEGAMOS MANUALMENTE!
      // El AuthProvider detectará el usuario y hará el redirect solo.
      console.log("Login exitoso!");
    } catch (error: any) {
      console.error(error);
      let msg = "Error desconocido";
      if (error.code === "auth/invalid-credential")
        msg = "Usuario o contraseña incorrectos.";
      if (error.code === "auth/too-many-requests")
        msg = "Demasiados intentos. Intenta más tarde.";
      if (error.code === "auth/user-not-found") msg = "Usuario no encontrado.";

      Alert.alert("Error de Acceso", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      {/* Usamos ThemedView para heredar el color de fondo claro (brand-light) */}
      <ThemedView className="flex-1 justify-center px-8">
        {/* Cabecera / Logo */}
        <View className="mb-12 items-center">
          {/* Aquí puedes reemplazar este texto por un componente <Image /> con el logo real de Alta Vía */}
          <ThemedText type="title" className="text-5xl tracking-widest mb-1">
            ALTAVIA
          </ThemedText>
          <ThemedText
            type="caption"
            className="uppercase tracking-[0.2em] font-medium text-brand-gold"
          >
            Aviation Platform
          </ThemedText>
        </View>

        {/* Formulario */}
        <View className="space-y-5">
          <View>
            <ThemedText type="caption" className="mb-1.5 ml-1 font-medium">
              Correo Electrónico
            </ThemedText>
            <TextInput
              className="bg-brand-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-sm"
              placeholder="ejemplo@altavia.com.py"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <ThemedText type="caption" className="mb-1.5 ml-1 font-medium">
              Contraseña
            </ThemedText>
            <TextInput
              className="bg-brand-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-sm"
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Botón Principal */}
          <TouchableOpacity
            className="bg-brand-blue rounded-xl py-4 items-center mt-4 shadow-sm active:bg-brand-blue/90"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText className="text-white font-bold text-lg">
                Ingresar
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Enlace al registro de clientes */}
        <View className="mt-8 flex-row justify-center items-center">
          <ThemedText type="caption" className="text-brand-muted">
            ¿Aún no tienes cuenta?{" "}
          </ThemedText>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <ThemedText type="accent" className="font-bold">
              Regístrate aquí
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
