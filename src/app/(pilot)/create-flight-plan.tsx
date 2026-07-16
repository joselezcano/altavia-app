import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { FlightPlan, flightPlanSchema } from "@/types/pilot";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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
import Toast from "react-native-toast-message";

export default function CreateFlightPlanScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default values matching the Zod schema structure
  const defaultValues: FlightPlan = {
    flight_plan: {
      aircraft: {
        registration: "ZP-XYZ",
        type: "B350",
        wake_turbulence: "M",
        equipment: ["S", "D", "G", "S"],
        transponder: "S",
      },
      flight_details: {
        callsign: "ZPXYZ",
        flight_rules: "IFR",
        flight_type: "G",
      },
      departure: {
        icao: "SGAS",
        datetime_utc: new Date().toISOString(),
        off_block_time: "1200",
      },
      arrival: {
        icao: "SULS",
        datetime_utc: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        alternate_icao: "SUMU",
      },
      route: {
        cruising_speed_knots: 250,
        cruising_altitude_feet: 18000,
        waypoints: ["ASU", "PTE"],
        encoded_route: "SGAS ASU PTE SULS",
      },
      performance: {
        eet_hours: 2,
        eet_minutes: 0,
        fuel_hours: 4,
        fuel_minutes: 30,
      },
      emergency: {
        pax_count: 2,
        radio_equipment: ["V", "U"],
        survival_equipment: ["P"],
        life_jacket_equipment: ["J"],
        dinghies_capacity: "4",
      },
      pilot: {
        name: "Juan Perez",
        contact_info: "+595981123456",
      },
    },
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<FlightPlan>({
    resolver: zodResolver(flightPlanSchema),
    defaultValues,
    mode: "onChange",
  });

  const onSubmit = async (data: FlightPlan) => {
    if (!user) {
      Alert.alert("Error", "No tienes una sesión activa.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Add additional metadata and save to Firestore
      const docRef = await addDoc(collection(db, "flight-plans"), {
        ...data,
        pilotId: user.uid,
        createdAt: serverTimestamp(),
        status: "Pending", // Set initial status
      });

      Toast.show({
        type: "success",
        text1: "Plan de Vuelo Creado",
        text2: `ID: ${docRef.id.slice(0, 8)}...`,
      });

      router.back();
    } catch (error: any) {
      console.error("Error creating flight plan:", error);
      Alert.alert("Error", error.message || "No se pudo guardar el plan de vuelo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to validate current step before proceeding
  const handleNext = async () => {
    let fieldsToValidate: any[] = [];

    if (currentStep === 1) {
      fieldsToValidate = [
        "flight_plan.aircraft.registration",
        "flight_plan.aircraft.type",
        "flight_plan.aircraft.wake_turbulence",
        "flight_plan.aircraft.equipment",
        "flight_plan.aircraft.transponder",
        "flight_plan.flight_details.callsign",
        "flight_plan.flight_details.flight_rules",
        "flight_plan.flight_details.flight_type",
      ];
    } else if (currentStep === 2) {
      fieldsToValidate = [
        "flight_plan.departure.icao",
        "flight_plan.departure.datetime_utc",
        "flight_plan.departure.off_block_time",
        "flight_plan.arrival.icao",
        "flight_plan.arrival.datetime_utc",
        "flight_plan.arrival.alternate_icao",
        "flight_plan.route.cruising_speed_knots",
        "flight_plan.route.cruising_altitude_feet",
        "flight_plan.route.waypoints",
        "flight_plan.route.encoded_route",
      ];
    } else if (currentStep === 3) {
      fieldsToValidate = [
        "flight_plan.performance.eet_hours",
        "flight_plan.performance.eet_minutes",
        "flight_plan.performance.fuel_hours",
        "flight_plan.performance.fuel_minutes",
        "flight_plan.emergency.pax_count",
        "flight_plan.emergency.radio_equipment",
        "flight_plan.emergency.survival_equipment",
        "flight_plan.emergency.life_jacket_equipment",
        "flight_plan.emergency.dinghies_capacity",
      ];
    }

    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      Alert.alert("Campos requeridos", "Por favor corrige los errores antes de continuar.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-brand-light"
    >
      <ThemedView className="flex-1 px-4 pt-2">
        {/* Cabecera con botón de retroceso */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center p-1"
          >
            <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
            <ThemedText className="font-semibold text-brand-blue ml-1">
              Atrás
            </ThemedText>
          </TouchableOpacity>
          <ThemedText className="font-bold text-brand-blue text-lg">
            Nuevo Plan de Vuelo
          </ThemedText>
          <View style={{ width: 60 }} />
        </View>

        {/* Indicador de Pasos */}
        <View className="flex-row justify-between mb-6 px-2">
          {[1, 2, 3, 4].map((step) => (
            <View key={step} className="items-center flex-1">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center font-bold ${currentStep === step
                  ? "bg-brand-blue"
                  : currentStep > step
                    ? "bg-brand-gold"
                    : "bg-slate-200"
                  }`}
              >
                <ThemedText
                  className={`text-sm font-bold ${currentStep >= step ? "text-white" : "text-slate-500"
                    }`}
                >
                  {step}
                </ThemedText>
              </View>
              <ThemedText className="text-[10px] text-slate-500 mt-1">
                {step === 1 ? "Aeronave" : step === 2 ? "Ruta" : step === 3 ? "Rendimiento" : "Contacto"}
              </ThemedText>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* PASO 1: Aeronave y Detalles de Vuelo */}
          {currentStep === 1 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                1. Aeronave y Detalles
              </ThemedText>

              {/* Matrícula */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Matrícula (e.g. ZP-XYZ)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.aircraft.registration"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(val) => onChange(val.toUpperCase())}
                      placeholder="ZP-XYZ"
                      maxLength={7}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.aircraft?.registration && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.aircraft.registration.message}
                  </ThemedText>
                )}
              </View>

              {/* Tipo de Aeronave */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Tipo de Aeronave (OACI e.g. B350)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.aircraft.type"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(val) => onChange(val.toUpperCase())}
                      placeholder="B350"
                      maxLength={4}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.aircraft?.type && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.aircraft.type.message}
                  </ThemedText>
                )}
              </View>

              {/* Turbulencia de Estela */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">Turbulencia de Estela</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.aircraft.wake_turbulence"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row gap-2">
                      {(["L", "M", "H", "J"] as const).map((level) => (
                        <TouchableOpacity
                          key={level}
                          onPress={() => onChange(level)}
                          className={`flex-1 py-2.5 rounded-lg border items-center ${value === level
                            ? "bg-brand-blue border-brand-blue"
                            : "bg-slate-50 border-slate-200"
                            }`}
                        >
                          <ThemedText
                            className={`font-semibold ${value === level ? "text-white" : "text-slate-600"
                              }`}
                          >
                            {level}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                />
                {errors.flight_plan?.aircraft?.wake_turbulence && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.aircraft.wake_turbulence.message}
                  </ThemedText>
                )}
              </View>

              {/* Equipamiento (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Equipamiento (Separado por comas)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.aircraft.equipment"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value ? value.join(", ") : ""}
                      onChangeText={(val) => {
                        const parts = val
                          .split(/[\s,]+/)
                          .filter(Boolean)
                          .map((x) => x.toUpperCase().slice(0, 1));
                        onChange(parts);
                      }}
                      placeholder="S, D, G, S"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.aircraft?.equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.aircraft.equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Transpondedor */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Transpondedor (1 letra)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.aircraft.transponder"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(val) => onChange(val.toUpperCase().slice(0, 1))}
                      placeholder="S"
                      maxLength={1}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.aircraft?.transponder && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.aircraft.transponder.message}
                  </ThemedText>
                )}
              </View>

              {/* Indicativo de llamada */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Indicativo de Llamada (Callsign)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.flight_details.callsign"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(val) => onChange(val.toUpperCase())}
                      placeholder="ZPXYZ"
                      maxLength={7}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.flight_details?.callsign && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.flight_details.callsign.message}
                  </ThemedText>
                )}
              </View>

              {/* Reglas de vuelo */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">Reglas de Vuelo</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.flight_details.flight_rules"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row gap-2">
                      {(["IFR", "VFR", "Y", "Z"] as const).map((rule) => (
                        <TouchableOpacity
                          key={rule}
                          onPress={() => onChange(rule)}
                          className={`flex-1 py-2.5 rounded-lg border items-center ${value === rule
                            ? "bg-brand-blue border-brand-blue"
                            : "bg-slate-50 border-slate-200"
                            }`}
                        >
                          <ThemedText
                            className={`font-semibold ${value === rule ? "text-white" : "text-slate-600"
                              }`}
                          >
                            {rule}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                />
                {errors.flight_plan?.flight_details?.flight_rules && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.flight_details.flight_rules.message}
                  </ThemedText>
                )}
              </View>

              {/* Tipo de vuelo */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">Tipo de Vuelo</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.flight_details.flight_type"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row gap-2">
                      {(["S", "N", "G", "M", "X"] as const).map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => onChange(type)}
                          className={`flex-1 py-2.5 rounded-lg border items-center ${value === type
                            ? "bg-brand-blue border-brand-blue"
                            : "bg-slate-50 border-slate-200"
                            }`}
                        >
                          <ThemedText
                            className={`font-semibold ${value === type ? "text-white" : "text-slate-600"
                              }`}
                          >
                            {type}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                />
                {errors.flight_plan?.flight_details?.flight_type && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.flight_details.flight_type.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* PASO 2: Salida, Llegada y Ruta */}
          {currentStep === 2 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                2. Ruta y Aeródromos
              </ThemedText>

              {/* Origen ICAO */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Origen OACI (e.g. SGAS)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.departure.icao"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(val) => onChange(val.toUpperCase())}
                      placeholder="SGAS"
                      maxLength={4}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.departure?.icao && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.departure.icao.message}
                  </ThemedText>
                )}
              </View>

              {/* Fecha / Hora Salida */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Fecha/Hora de Salida (UTC ISO Format)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.departure.datetime_utc"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="2026-07-15T15:00:00Z"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-xs"
                    />
                  )}
                />
                {errors.flight_plan?.departure?.datetime_utc && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.departure.datetime_utc.message}
                  </ThemedText>
                )}
              </View>

              {/* Off Block Time (HHMM) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Hora Fuera de Calzos (HHMM)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.departure.off_block_time"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="1200"
                      maxLength={4}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.departure?.off_block_time && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.departure.off_block_time.message}
                  </ThemedText>
                )}
              </View>

              {/* Destino ICAO */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Destino OACI (e.g. SULS)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.arrival.icao"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(val) => onChange(val.toUpperCase())}
                      placeholder="SULS"
                      maxLength={4}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.arrival?.icao && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.arrival.icao.message}
                  </ThemedText>
                )}
              </View>

              {/* Fecha / Hora Llegada */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Fecha/Hora de Llegada (UTC ISO Format)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.arrival.datetime_utc"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="2026-07-15T17:00:00Z"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-xs"
                    />
                  )}
                />
                {errors.flight_plan?.arrival?.datetime_utc && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.arrival.datetime_utc.message}
                  </ThemedText>
                )}
              </View>

              {/* Alternativo ICAO (Opcional) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Alternativo OACI (Opcional)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.arrival.alternate_icao"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value || ""}
                      onChangeText={(val) => onChange(val ? val.toUpperCase() : undefined)}
                      placeholder="SUMU"
                      maxLength={4}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.arrival?.alternate_icao && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.arrival.alternate_icao.message}
                  </ThemedText>
                )}
              </View>

              {/* Velocidad de Crucero (Knots) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Velocidad de Crucero (Knots)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.route.cruising_speed_knots"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="250"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.route?.cruising_speed_knots && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.route.cruising_speed_knots.message}
                  </ThemedText>
                )}
              </View>

              {/* Altitud de Crucero (Feet) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Altitud de Crucero (Pies)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.route.cruising_altitude_feet"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="18000"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.route?.cruising_altitude_feet && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.route.cruising_altitude_feet.message}
                  </ThemedText>
                )}
              </View>

              {/* Waypoints (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Puntos de Ruta (Separados por espacios)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.route.waypoints"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value ? value.join(" ") : ""}
                      onChangeText={(val) => {
                        onChange(val.split(/\s+/).filter(Boolean));
                      }}
                      placeholder="ASU PTE"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.route?.waypoints && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.route.waypoints.message}
                  </ThemedText>
                )}
              </View>

              {/* Encoded Route */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Ruta Codificada Completa</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.route.encoded_route"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="SGAS ASU PTE SULS"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.route?.encoded_route && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.route.encoded_route.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* PASO 3: Rendimiento y Equipamiento de Emergencia */}
          {currentStep === 3 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                3. Rendimiento y Seguridad
              </ThemedText>

              {/* Tiempo Estimado (EET) */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText type="caption" className="font-bold mb-1">EET Horas</ThemedText>
                  <Controller
                    control={control}
                    name="flight_plan.performance.eet_hours"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value !== undefined ? String(value) : ""}
                        onChangeText={(val) => {
                          const parsed = parseInt(val, 10);
                          onChange(isNaN(parsed) ? 0 : parsed);
                        }}
                        placeholder="2"
                        keyboardType="numeric"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                      />
                    )}
                  />
                  {errors.flight_plan?.performance?.eet_hours && (
                    <ThemedText className="text-red-500 text-xs mt-1">
                      {errors.flight_plan.performance.eet_hours.message}
                    </ThemedText>
                  )}
                </View>

                <View className="flex-1">
                  <ThemedText type="caption" className="font-bold mb-1">EET Minutos</ThemedText>
                  <Controller
                    control={control}
                    name="flight_plan.performance.eet_minutes"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value !== undefined ? String(value) : ""}
                        onChangeText={(val) => {
                          const parsed = parseInt(val, 10);
                          onChange(isNaN(parsed) ? 0 : parsed);
                        }}
                        placeholder="0"
                        keyboardType="numeric"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                      />
                    )}
                  />
                  {errors.flight_plan?.performance?.eet_minutes && (
                    <ThemedText className="text-red-500 text-xs mt-1">
                      {errors.flight_plan.performance.eet_minutes.message}
                    </ThemedText>
                  )}
                </View>
              </View>

              {/* Combustible a Bordo */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText type="caption" className="font-bold mb-1">Combustible Horas</ThemedText>
                  <Controller
                    control={control}
                    name="flight_plan.performance.fuel_hours"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value !== undefined ? String(value) : ""}
                        onChangeText={(val) => {
                          const parsed = parseInt(val, 10);
                          onChange(isNaN(parsed) ? 0 : parsed);
                        }}
                        placeholder="4"
                        keyboardType="numeric"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                      />
                    )}
                  />
                  {errors.flight_plan?.performance?.fuel_hours && (
                    <ThemedText className="text-red-500 text-xs mt-1">
                      {errors.flight_plan.performance.fuel_hours.message}
                    </ThemedText>
                  )}
                </View>

                <View className="flex-1">
                  <ThemedText type="caption" className="font-bold mb-1">Combustible Minutos</ThemedText>
                  <Controller
                    control={control}
                    name="flight_plan.performance.fuel_minutes"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value !== undefined ? String(value) : ""}
                        onChangeText={(val) => {
                          const parsed = parseInt(val, 10);
                          onChange(isNaN(parsed) ? 0 : parsed);
                        }}
                        placeholder="30"
                        keyboardType="numeric"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                      />
                    )}
                  />
                  {errors.flight_plan?.performance?.fuel_minutes && (
                    <ThemedText className="text-red-500 text-xs mt-1">
                      {errors.flight_plan.performance.fuel_minutes.message}
                    </ThemedText>
                  )}
                </View>
              </View>

              {/* Cantidad de personas a bordo (Pax) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Personas a Bordo (POB)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.emergency.pax_count"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="2"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.emergency?.pax_count && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.emergency.pax_count.message}
                  </ThemedText>
                )}
              </View>

              {/* Radio de Emergencia (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Equipamiento Radio de Emergencia</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.emergency.radio_equipment"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value ? value.join(", ") : ""}
                      onChangeText={(val) => {
                        const parts = val
                          .split(/[\s,]+/)
                          .filter(Boolean)
                          .map((x) => x.toUpperCase().slice(0, 1));
                        onChange(parts);
                      }}
                      placeholder="U, V"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.emergency?.radio_equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.emergency.radio_equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Equipos de Supervivencia */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Equipos de Supervivencia</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.emergency.survival_equipment"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value ? value.join(", ") : ""}
                      onChangeText={(val) => {
                        const parts = val
                          .split(/[\s,]+/)
                          .filter(Boolean)
                          .map((x) => x.toUpperCase().slice(0, 1));
                        onChange(parts);
                      }}
                      placeholder="P, D"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.emergency?.survival_equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.emergency.survival_equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Chalecos Salvavidas */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Chalecos Salvavidas</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.emergency.life_jacket_equipment"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value ? value.join(", ") : ""}
                      onChangeText={(val) => {
                        const parts = val
                          .split(/[\s,]+/)
                          .filter(Boolean)
                          .map((x) => x.toUpperCase().slice(0, 1));
                        onChange(parts);
                      }}
                      placeholder="J, L"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.emergency?.life_jacket_equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.emergency.life_jacket_equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Capacidad de botes salvavidas (Opcional) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Capacidad de Botes Salvavidas (Opcional)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.emergency.dinghies_capacity"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value || ""}
                      onChangeText={(val) => onChange(val || undefined)}
                      placeholder="4"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.emergency?.dinghies_capacity && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.emergency.dinghies_capacity.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* PASO 4: Datos del Piloto y Envío */}
          {currentStep === 4 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                4. Datos del Piloto
              </ThemedText>

              {/* Nombre del Piloto */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Nombre Completo del Piloto</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.pilot.name"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Juan Perez"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.pilot?.name && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.pilot.name.message}
                  </ThemedText>
                )}
              </View>

              {/* Información de contacto */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Contacto del Piloto (Teléfono)</ThemedText>
                <Controller
                  control={control}
                  name="flight_plan.pilot.contact_info"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="+595981123456"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.flight_plan?.pilot?.contact_info && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.pilot.contact_info.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Botones de Navegación del Formulario */}
          <View className="flex-row gap-3 mt-4 mb-10">
            {currentStep > 1 && (
              <TouchableOpacity
                onPress={() => setCurrentStep((prev) => prev - 1)}
                disabled={isSubmitting}
                className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center justify-center border border-slate-200"
              >
                <ThemedText className="text-slate-700 font-bold">
                  Anterior
                </ThemedText>
              </TouchableOpacity>
            )}

            {currentStep < 4 ? (
              <TouchableOpacity
                onPress={handleNext}
                className="flex-1 bg-brand-blue py-3.5 rounded-xl items-center justify-center shadow-sm"
              >
                <ThemedText className="text-white font-bold">
                  Siguiente
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="flex-1 bg-brand-gold py-3.5 rounded-xl items-center justify-center shadow-md flex-row gap-2"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                    <ThemedText className="text-white font-bold">
                      Enviar Plan de Vuelo
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
