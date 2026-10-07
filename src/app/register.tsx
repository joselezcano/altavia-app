import { auth, db } from "@/config/firebase";
import { RegisterClientForm, RegisterClientSchema } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";

export default function RegisterScreen() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterClientForm>({
    resolver: zodResolver(RegisterClientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterClientForm) => {
    setLoading(true);
    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email.trim(),
        data.password
      );
      const uid = userCredential.user.uid;

      // 2. Save Common Data in 'users' collection
      const userDocRef = doc(db, "users", uid);
      await setDoc(userDocRef, {
        uid,
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        roles: ["CLIENT"],
        kycVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Save Client-Specific Data in 'clients' collection (Multirole Rule 2)
      const clientDocRef = doc(db, "clients", uid);
      await setDoc(clientDocRef, {
        uid,
        acceptedTermsVersion: "1.0",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log("Cliente registrado con éxito:", uid);
      // AuthProvider will automatically redirect the user to /(client)
    } catch (error: any) {
      console.error("Error al registrar cliente:", error);
      let errorMsg = "No se pudo completar el registro. Inténtalo nuevamente.";

      if (error.code === "auth/email-already-in-use") {
        errorMsg = "Este correo electrónico ya está registrado.";
      } else if (error.code === "auth/invalid-email") {
        errorMsg = "El correo electrónico ingresado no es válido.";
      } else if (error.code === "auth/weak-password") {
        errorMsg = "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
      }

      Alert.alert("Error de Registro", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ThemedView className="flex-1 bg-brand-light px-6 pt-12">
        {/* Back Button & Header */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-1 mb-6"
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
          <ThemedText className="font-semibold text-slate-800 text-sm">
            Volver
          </ThemedText>
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Header Title */}
          <View className="mb-6">
            <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest">
              Crear Cuenta
            </ThemedText>
            <ThemedText type="title" className="text-3xl font-extrabold text-brand-blue mt-1">
              Registro de Cliente
            </ThemedText>
            <ThemedText className="text-xs text-slate-500 mt-1 leading-relaxed">
              Completa tus datos para reservar vuelos privados y gestionar tus itinerarios.
            </ThemedText>
          </View>

          {/* Form Fields */}
          <View className="gap-4">
            {/* First Name Field */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Nombre *
              </ThemedText>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-white border ${
                      errors.firstName ? "border-red-500" : "border-slate-200"
                    } rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs`}
                    placeholder="Ej. Juan"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.firstName && (
                <ThemedText className="text-xs text-red-500 mt-1 ml-1 font-medium">
                  {errors.firstName.message}
                </ThemedText>
              )}
            </View>

            {/* Last Name Field */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Apellido *
              </ThemedText>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-white border ${
                      errors.lastName ? "border-red-500" : "border-slate-200"
                    } rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs`}
                    placeholder="Ej. Pérez"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.lastName && (
                <ThemedText className="text-xs text-red-500 mt-1 ml-1 font-medium">
                  {errors.lastName.message}
                </ThemedText>
              )}
            </View>

            {/* Email Field */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Correo Electrónico *
              </ThemedText>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`bg-white border ${
                      errors.email ? "border-red-500" : "border-slate-200"
                    } rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs`}
                    placeholder="ejemplo@altavia.com.py"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.email && (
                <ThemedText className="text-xs text-red-500 mt-1 ml-1 font-medium">
                  {errors.email.message}
                </ThemedText>
              )}
            </View>

            {/* Password Field */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Contraseña *
              </ThemedText>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="relative justify-center">
                    <TextInput
                      className={`bg-white border ${
                        errors.password ? "border-red-500" : "border-slate-200"
                      } rounded-xl pl-4 pr-12 py-3.5 text-brand-text font-medium text-base shadow-xs`}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    <TouchableOpacity
                      className="absolute right-4"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.password && (
                <ThemedText className="text-xs text-red-500 mt-1 ml-1 font-medium">
                  {errors.password.message}
                </ThemedText>
              )}
            </View>

            {/* Confirm Password Field */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Confirmar Contraseña *
              </ThemedText>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="relative justify-center">
                    <TextInput
                      className={`bg-white border ${
                        errors.confirmPassword ? "border-red-500" : "border-slate-200"
                      } rounded-xl pl-4 pr-12 py-3.5 text-brand-text font-medium text-base shadow-xs`}
                      placeholder="Repite tu contraseña"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirmPassword}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    <TouchableOpacity
                      className="absolute right-4"
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.confirmPassword && (
                <ThemedText className="text-xs text-red-500 mt-1 ml-1 font-medium">
                  {errors.confirmPassword.message}
                </ThemedText>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className="bg-brand-blue rounded-xl py-4 items-center mt-3 shadow-md active:bg-brand-blue/90"
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText className="text-white font-bold text-base">
                  Crear Mi Cuenta
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View className="mt-8 flex-row justify-center items-center">
            <ThemedText type="caption" className="text-slate-500">
              ¿Ya tienes una cuenta?{" "}
            </ThemedText>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <ThemedText type="accent" className="font-bold text-brand-blue">
                Inicia Sesión
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
