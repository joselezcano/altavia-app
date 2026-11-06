import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  DocumentType,
  NationalityType,
  PersonType,
} from "@/types/user";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function OnboardingStep2Screen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUserData, signOut } = useAuth();

  // Detect pre-filled name from social auth (Google / Firebase Auth)
  const initialParts = (user?.displayName || "").trim().split(/\s+/);
  const initialFirstName = initialParts[0] || "";
  const initialLastName = initialParts.slice(1).join(" ") || "";

  const [personType, setPersonType] = useState<PersonType>("individual");

  // Individual fields
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [nationalityType, setNationalityType] = useState<NationalityType>("paraguayan");
  const [documentType, setDocumentType] = useState<DocumentType>("CI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");

  // Company fields
  const [businessName, setBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeDoc, setRepresentativeDoc] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  const [loading, setLoading] = useState(false);

  // CRÍTICO (Blitz Pattern): Al montar, recuperar el nombre de Apple desde AsyncStorage
  // para resolver la race condition con onAuthStateChanged.
  useEffect(() => {
    const loadAppleName = async () => {
      try {
        const stored = await AsyncStorage.getItem("apple_fullName");
        if (stored) {
          const { givenName, familyName } = JSON.parse(stored);
          if (givenName && !firstName) setFirstName(givenName);
          if (familyName && !lastName) setLastName(familyName);
          // Limpiar para no reutilizar en futuros montajes
          await AsyncStorage.removeItem("apple_fullName");
        }
      } catch (error) {
        console.error("Error leyendo nombre de Apple desde AsyncStorage:", error);
      }
    };
    loadAppleName();
  }, []);

  // Apple Guideline 4: si el proveedor ya otorgó el nombre verificado, bloquear edición
  const nameProvidedByAuth = Boolean(
    (user?.displayName && initialFirstName && initialLastName) ||
    (firstName.trim() && lastName.trim() && user?.providerData?.some(p => p.providerId === "apple.com" || p.providerId === "google.com"))
  );

  const handleSubmit = async () => {
    if (!user) return;

    // Validations
    if (personType === "individual") {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa tu nombre y apellido completos.");
        return;
      }
      if (!documentNumber.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa tu número de documento de identidad.");
        return;
      }
      if (nationalityType === "paraguayan") {
        // Cédula paraguaya (entre 5 y 10 dígitos)
        const docRegex = /^\d{5,10}$/;
        const cleanDoc = documentNumber.replace(/\./g, "").trim();
        if (!docRegex.test(cleanDoc)) {
          Alert.alert("Documento Inválido", "La Cédula paraguaya debe contener números válidos.");
          return;
        }
      }
      if (!phone.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa un número de teléfono de contacto.");
        return;
      }
    } else {
      if (!businessName.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa la Razón Social de la empresa.");
        return;
      }
      if (!taxId.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa el RUC o identificación fiscal.");
        return;
      }
      if (!representativeName.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa el nombre del Representante Legal.");
        return;
      }
      if (!representativeDoc.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa el documento del Representante Legal.");
        return;
      }
      if (!companyPhone.trim()) {
        Alert.alert("Campo Requerido", "Por favor ingresa un teléfono corporativo de contacto.");
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Prepare Base User Document for 'users/{uid}'
      const baseUserData: Record<string, any> = {
        uid: user.uid,
        email: (user.email || "").trim().toLowerCase(),
        roles: ["CLIENT"],
        personType,
        profileCompleted: true,
        termsAcceptedAt: serverTimestamp(),
        termsVersion: "1.0",
        updatedAt: serverTimestamp(),
      };

      if (personType === "individual") {
        baseUserData.firstName = firstName.trim();
        baseUserData.lastName = lastName.trim();
        baseUserData.nationalityType = nationalityType;
        baseUserData.documentType = nationalityType === "paraguayan" ? "CI" : documentType;
        baseUserData.documentNumber = documentNumber.trim();
        baseUserData.phone = phone.trim();
      } else {
        baseUserData.firstName = businessName.trim();
        baseUserData.lastName = "(Empresa)";
        baseUserData.businessName = businessName.trim();
        baseUserData.taxId = taxId.trim();
        baseUserData.representativeName = representativeName.trim();
        baseUserData.representativeDoc = representativeDoc.trim();
        baseUserData.phone = companyPhone.trim();
      }

      // Upsert into users/{uid}
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, baseUserData, { merge: true });

      // 2. Multirole Rule 2: Prepare Client-specific profile in 'clients/{uid}'
      const clientDocData: Record<string, any> = {
        uid: user.uid,
        personType,
        acceptedTermsVersion: "1.0",
        updatedAt: serverTimestamp(),
      };

      const clientRef = doc(db, "clients", user.uid);
      await setDoc(clientRef, clientDocData, { merge: true });

      Toast.show({
        type: "success",
        text1: "¡Bienvenido a Alta Vía!",
        text2: "Tu perfil ha sido completado exitosamente.",
      });

      // 3. Refresh user state in AuthContext to transition smoothly to client app
      await refreshUserData();
    } catch (error: any) {
      console.error("Error al completar el perfil en Firestore:", error);
      Alert.alert(
        "Error al guardar datos",
        "Ocurrió un error al guardar la información. Por favor revisa tu conexión e inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
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
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingVertical: 10,
          paddingBottom: 40,
        }}
      >
        {/* Top Header */}
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[11px]">
              Paso 2 de 2 • Registro
            </ThemedText>
            <ThemedText type="title" className="text-2xl font-extrabold text-brand-blue mt-0.5">
              Completa tu Perfil
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={signOut}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-slate-200/80 active:bg-slate-300"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="log-out-outline" size={16} color="#475569" />
            <ThemedText className="text-xs font-semibold text-slate-700">Salir</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Subtitle / Explanation */}
        <ThemedText className="text-xs text-slate-500 mb-5 leading-relaxed">
          Para cumplir con las normas de seguridad operacional aeronáutica (DINAC) y emitir tus reservas, necesitamos clasificar tu perfil de cliente.
        </ThemedText>

        {/* Person Type Selector (Tabs) */}
        <View className="bg-slate-200/80 p-1 rounded-2xl flex-row mb-6">
          <TouchableOpacity
            onPress={() => setPersonType("individual")}
            className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2 ${
              personType === "individual" ? "bg-white shadow-xs" : ""
            }`}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person"
              size={16}
              color={personType === "individual" ? "#030436" : "#64748B"}
            />
            <ThemedText
              className={`text-xs font-bold ${
                personType === "individual" ? "text-brand-blue" : "text-slate-500"
              }`}
            >
              Persona Física
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPersonType("company")}
            className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2 ${
              personType === "company" ? "bg-white shadow-xs" : ""
            }`}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={16}
              color={personType === "company" ? "#030436" : "#64748B"}
            />
            <ThemedText
              className={`text-xs font-bold ${
                personType === "company" ? "text-brand-blue" : "text-slate-500"
              }`}
            >
              Empresa (Jurídica)
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* DYNAMIC FORM: PERSONA FÍSICA */}
        {personType === "individual" ? (
          <View className="gap-4">
            {/* Nationality Selector */}
            <View>
              <ThemedText type="caption" className="mb-2 ml-1 font-semibold text-slate-700">
                Nacionalidad / Residencia *
              </ThemedText>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setNationalityType("paraguayan");
                    setDocumentType("CI");
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl border flex-row items-center justify-center gap-2 ${
                    nationalityType === "paraguayan"
                      ? "bg-brand-blue/5 border-brand-blue"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <ThemedText className="text-base">🇵🇾</ThemedText>
                  <ThemedText
                    className={`text-xs font-bold ${
                      nationalityType === "paraguayan" ? "text-brand-blue" : "text-slate-600"
                    }`}
                  >
                    Paraguayo
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNationalityType("foreign")}
                  className={`flex-1 py-3 px-4 rounded-xl border flex-row items-center justify-center gap-2 ${
                    nationalityType === "foreign"
                      ? "bg-brand-blue/5 border-brand-blue"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <ThemedText className="text-base">🌎</ThemedText>
                  <ThemedText
                    className={`text-xs font-bold ${
                      nationalityType === "foreign" ? "text-brand-blue" : "text-slate-600"
                    }`}
                  >
                    Extranjero
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Foreign Document Type Selector */}
            {nationalityType === "foreign" && (
              <View>
                <ThemedText type="caption" className="mb-2 ml-1 font-semibold text-slate-700">
                  Tipo de Documento *
                </ThemedText>
                <View className="flex-row gap-2">
                  {(["PASSPORT", "DNI", "CI"] as DocumentType[]).map((docType) => (
                    <TouchableOpacity
                      key={docType}
                      onPress={() => setDocumentType(docType)}
                      className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                        documentType === docType
                          ? "bg-brand-gold/15 border-brand-gold"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <ThemedText
                        className={`text-xs font-bold ${
                          documentType === docType ? "text-amber-800" : "text-slate-600"
                        }`}
                      >
                        {docType === "PASSPORT" ? "Pasaporte" : docType === "DNI" ? "DNI" : "Cédula"}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Document Number */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                {nationalityType === "paraguayan" ? "Cédula de Identidad (CI) *" : "Número de Documento *"}
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder={nationalityType === "paraguayan" ? "Ej. 4512389" : "Ej. A12345678"}
                placeholderTextColor="#94A3B8"
                value={documentNumber}
                onChangeText={setDocumentNumber}
                keyboardType={nationalityType === "paraguayan" ? "numeric" : "default"}
                autoCapitalize="characters"
              />
            </View>

            {/* First Name (Pre-filled by auth / locked) */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Nombre(s) *
              </ThemedText>
              <TextInput
                className={`bg-white border border-slate-200 rounded-xl px-4 py-3.5 ${
                  nameProvidedByAuth ? "text-slate-500 bg-slate-50/80" : "text-brand-text"
                } font-medium text-base shadow-xs`}
                placeholder="Ej. Juan Carlos"
                placeholderTextColor="#94A3B8"
                value={firstName}
                onChangeText={setFirstName}
                editable={!nameProvidedByAuth}
                autoCapitalize="words"
              />
              {nameProvidedByAuth && (
                <ThemedText className="text-[11px] text-emerald-600 font-semibold mt-1 ml-1">
                  ✓ Verificado con tu cuenta
                </ThemedText>
              )}
            </View>

            {/* Last Name (Pre-filled by auth / locked) */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Apellido(s) *
              </ThemedText>
              <TextInput
                className={`bg-white border border-slate-200 rounded-xl px-4 py-3.5 ${
                  nameProvidedByAuth ? "text-slate-500 bg-slate-50/80" : "text-brand-text"
                } font-medium text-base shadow-xs`}
                placeholder="Ej. Rodríguez Pérez"
                placeholderTextColor="#94A3B8"
                value={lastName}
                onChangeText={setLastName}
                editable={!nameProvidedByAuth}
                autoCapitalize="words"
              />
              {nameProvidedByAuth && (
                <ThemedText className="text-[11px] text-emerald-600 font-semibold mt-1 ml-1">
                  ✓ Verificado con tu cuenta
                </ThemedText>
              )}
            </View>

            {/* Contact Phone */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Teléfono Celular (WhatsApp) *
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder="Ej. 0981234567 / +595981123456"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        ) : (
          /* DYNAMIC FORM: PERSONA JURÍDICA (EMPRESA) */
          <View className="gap-4">
            {/* Business Name */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Razón Social de la Empresa *
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder="Ej. Corporación Aeronáutica S.A."
                placeholderTextColor="#94A3B8"
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
              />
            </View>

            {/* Tax ID / RUC */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                RUC / Identificación Fiscal *
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder="Ej. 80098765-4"
                placeholderTextColor="#94A3B8"
                value={taxId}
                onChangeText={setTaxId}
                autoCapitalize="characters"
              />
            </View>

            {/* Legal Representative Name */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Nombre del Representante Legal *
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder="Ej. Carlos Benítez"
                placeholderTextColor="#94A3B8"
                value={representativeName}
                onChangeText={setRepresentativeName}
                autoCapitalize="words"
              />
            </View>

            {/* Legal Representative Document */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Documento del Representante Legal *
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder="Ej. CI 2345678 / Pasaporte"
                placeholderTextColor="#94A3B8"
                value={representativeDoc}
                onChangeText={setRepresentativeDoc}
              />
            </View>

            {/* Company Contact Phone */}
            <View>
              <ThemedText type="caption" className="mb-1.5 ml-1 font-semibold text-slate-700">
                Teléfono Corporativo *
              </ThemedText>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-brand-text font-medium text-base shadow-xs"
                placeholder="Ej. 021654321 / +595981999888"
                placeholderTextColor="#94A3B8"
                value={companyPhone}
                onChangeText={setCompanyPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          className="bg-brand-blue rounded-xl py-4 items-center mt-6 shadow-md active:bg-brand-blue/90"
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText className="text-white font-bold text-base">
              Finalizar Registro y Continuar
            </ThemedText>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}
