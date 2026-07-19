import AirportPicker from "@/components/airport-picker";
import { CustomDatePicker } from "@/components/custom-date-picker";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { FlightRequestForm, FlightRequestFormSchema } from "@/types/admin";
import { getDistanceBetweenAirports } from "@/utils/flight-distance";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
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


// Helper to remove undefined values so Firestore does not throw errors
const sanitizeFirestoreObject = (obj: any): any => {
  const clean: any = {};
  for (const key in obj) {
    if (obj[key] === undefined) {
      obj[key] = null;
      continue;
    }
    if (obj[key] !== null && typeof obj[key] === "object" && !(obj[key] instanceof Date)) {
      clean[key] = sanitizeFirestoreObject(obj[key]);
    } else {
      clean[key] = obj[key];
    }
  }
  return clean;
};


export default function FlightRequestFormScreen() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAirportTypes, setSelectedAirportTypes] = useState<string[]>([
    "large_airport",
    "medium_airport",
  ]);

  const toggleAirportType = (type: string) => {
    setSelectedAirportTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const [defaultValues] = useState<FlightRequestForm>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      trip: {
        origin_airport_ident: "",
        destination_airport_ident: "",
        passangers: 1,
      },
      schedule: {
        departure_datetime_utc: null,
        arrival_datetime_utc: null,
      },
      financials: {
        ticket_initial_price: 0,
        ticket_final_price: null,
        ticket_price_change_period_days: null,
        flight_budget: null,
      },
    };
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    reset,
    watch,
    setValue,
  } = useForm<FlightRequestForm>({
    resolver: zodResolver(FlightRequestFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const departureDate = watch("schedule.departure_datetime_utc");

  const onSubmit = async (data: FlightRequestForm) => {
    if (!user) {
      Alert.alert("Error", "No tienes una sesión activa.");
      return;
    }

    setIsSubmitting(true);
    try {
      let distance_km = 0; // Default fallback distance in km

      distance_km = getDistanceBetweenAirports(
        data.trip.origin_airport,
        data.trip.destination_airport,
        "km"
      );

      const { trip: { origin_airport, destination_airport, passangers }, ...request } = data;
      const requestComplete = {
        ...request,
        trip: {
          origin_airport_ident: origin_airport?.ident,
          destination_airport_ident: destination_airport?.ident,
          origin_timezone: origin_airport?.timezone,
          destination_timezone: destination_airport?.timezone,
          passangers: passangers
        },
      }
      const cleanedRequest = sanitizeFirestoreObject(requestComplete);

      const flightRequestDoc = {
        admin_id: user.uid,
        request: cleanedRequest,
        distance_km,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "flight-requests"), flightRequestDoc);

      Toast.show({
        type: "success",
        text1: "Solicitud Registrada",
        text2: `ID: ${docRef.id.slice(0, 8)}...`,
      });

      // Reset form and go back to step 1
      reset(defaultValues);
      setSelectedAirportTypes([
        "large_airport",
        "medium_airport",
      ]);
      setCurrentStep(1);
    } catch (error: any) {
      console.error("Error creating flight request:", error);
      Alert.alert("Error", error.message || "No se pudo guardar la solicitud de vuelo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];

    if (currentStep === 1) {
      fieldsToValidate = [
        "trip.origin_airport_ident",
        "trip.destination_airport_ident",
        "trip.passangers",
      ];
    } else if (currentStep === 2) {
      fieldsToValidate = [
        "schedule.departure_datetime_utc",
        "schedule.arrival_datetime_utc",
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
        {/* Header Indicator */}
        <View className="flex-row justify-between mb-6 mt-4 px-2">
          {[1, 2, 3].map((step) => (
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
                {step === 1 ? "Ruta" : step === 2 ? "Horario" : "Precio"}
              </ThemedText>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* STEP 1: Route & Passengers */}
          {currentStep === 1 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                1. Ruta y Pasajeros
              </ThemedText>

              {/* Origin */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Origen
                </ThemedText>
                <Controller
                  control={control}
                  name="trip.origin_airport"
                  render={({ field: { onChange, value } }) => (
                    <AirportPicker
                      value={value}
                      onChange={(airport) => {
                        onChange(airport);
                        setValue("trip.origin_airport_ident", airport?.ident || "");
                      }}
                      allowedTypes={selectedAirportTypes}
                    />
                  )}
                />
                {errors.trip?.origin_airport_ident && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.trip.origin_airport_ident.message}
                  </ThemedText>
                )}
              </View>

              {/* Destination */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Destino
                </ThemedText>
                <Controller
                  control={control}
                  name="trip.destination_airport"
                  render={({ field: { onChange, value } }) => (
                    <AirportPicker
                      value={value}
                      onChange={(airport) => {
                        onChange(airport);
                        setValue("trip.destination_airport_ident", airport?.ident || "");
                      }}
                      allowedTypes={selectedAirportTypes}
                    />
                  )}
                />
                {errors.trip?.destination_airport_ident && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.trip.destination_airport_ident.message}
                  </ThemedText>
                )}
              </View>

              {/* Airport Types Filter */}
              <View>
                <ThemedText type="caption" className="font-bold mb-4">
                  Tipos de aeropuerto
                </ThemedText>
                <View className="flex-row flex-wrap gap-x-4 gap-y-3">
                  {[
                    { key: "large_airport", label: "Grande" },
                    { key: "medium_airport", label: "Mediano" },
                    { key: "small_airport", label: "Pequeño" },
                    { key: "heliport", label: "Helipuerto" },
                    { key: "closed", label: "Cerrado" },
                  ].map((item) => {
                    const isChecked = selectedAirportTypes.includes(item.key);
                    return (
                      <TouchableOpacity
                        key={item.key}
                        className="flex-row items-center"
                        onPress={() => toggleAirportType(item.key)}
                        activeOpacity={0.7}
                      >
                        <View
                          className={`w-5 h-5 rounded border items-center justify-center mr-2 ${isChecked
                            ? "bg-brand-blue border-brand-blue"
                            : "border-slate-400 bg-white"
                            }`}
                        >
                          {isChecked && (
                            <Ionicons name="checkmark" size={14} color="white" />
                          )}
                        </View>
                        <ThemedText className="text-sm font-medium">
                          {item.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Passengers */}
              <View>
                <ThemedText type="caption" className="font-bold mt-3 mb-1">
                  Cantidad de Pasajeros
                </ThemedText>
                <Controller
                  control={control}
                  name="trip.passangers"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={isNaN(value) ? "" : String(value)}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(parsed);
                      }}
                      placeholder=""
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.trip?.passangers && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.trip.passangers.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* STEP 2: Schedule */}
          {currentStep === 2 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                2. Fechas y Horarios
              </ThemedText>

              {/* Departure Datetime */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Fecha / Hora de Salida
                </ThemedText>
                <Controller
                  control={control}
                  name="schedule.departure_datetime_utc"
                  render={({ field: { onChange, value } }) => (
                    <CustomDatePicker
                      value={value}
                      onChange={onChange}
                      placeholder="Seleccionar fecha y hora de salida"
                    />
                  )}
                />
                {errors.schedule?.departure_datetime_utc && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.schedule.departure_datetime_utc.message}
                  </ThemedText>
                )}
              </View>

              {/* Arrival Datetime (Optional) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Fecha / Hora de Retorno (Opcional)
                </ThemedText>
                <Controller
                  control={control}
                  name="schedule.arrival_datetime_utc"
                  render={({ field: { onChange, value } }) => (
                    <CustomDatePicker
                      value={value}
                      onChange={onChange}
                      placeholder="Seleccionar fecha y hora de retorno"
                      minimumDate={departureDate}
                    />
                  )}
                />
                {errors.schedule?.arrival_datetime_utc && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.schedule.arrival_datetime_utc.message}
                  </ThemedText>
                )}
              </View>

              <View>
                <ThemedText type="caption" className="font-babse mb-1">
                  Utilizar el horario local de cada aeropuerto
                </ThemedText>
              </View>
            </View>
          )}

          {/* STEP 3: Financials */}
          {currentStep === 3 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                3. Aspectos Financieros
              </ThemedText>

              {/* Ticket Initial Price */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Precio Inicial del Ticket (USD)
                </ThemedText>
                <Controller
                  control={control}
                  name="financials.ticket_initial_price"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== null ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseFloat(val);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder=""
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.financials?.ticket_initial_price && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.financials.ticket_initial_price.message}
                  </ThemedText>
                )}
              </View>

              {/* Ticket Final Price (Optional) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Precio Final del Ticket (USD) [Opcional]
                </ThemedText>
                <Controller
                  control={control}
                  name="financials.ticket_final_price"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== null ? String(value) : ""}
                      onChangeText={(val) => {
                        if (val === "") {
                          onChange(null);
                        } else {
                          const parsed = parseFloat(val);
                          onChange(isNaN(parsed) ? null : parsed);
                        }
                      }}
                      placeholder=""
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.financials?.ticket_final_price && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.financials.ticket_final_price.message}
                  </ThemedText>
                )}
              </View>

              {/* Ticket Price Change Period Days (Optional) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Periodo de Cambio de Precio (Días) [Opcional]
                </ThemedText>
                <Controller
                  control={control}
                  name="financials.ticket_price_change_period_days"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== null ? String(value) : ""}
                      onChangeText={(val) => {
                        if (val === "") {
                          onChange(null);
                        } else {
                          const parsed = parseInt(val, 10);
                          onChange(isNaN(parsed) ? null : parsed);
                        }
                      }}
                      placeholder=""
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.financials?.ticket_price_change_period_days && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.financials.ticket_price_change_period_days.message}
                  </ThemedText>
                )}
              </View>

              {/* Flight Budget (Optional) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Presupuesto del Vuelo (USD) [Opcional]
                </ThemedText>
                <Controller
                  control={control}
                  name="financials.flight_budget"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== null ? String(value) : ""}
                      onChangeText={(val) => {
                        if (val === "") {
                          onChange(null);
                        } else {
                          const parsed = parseFloat(val);
                          onChange(isNaN(parsed) ? null : parsed);
                        }
                      }}
                      placeholder=""
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.financials?.flight_budget && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.financials.flight_budget.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Navigation Controls */}
          <View className="flex-row gap-3 mt-4 mb-10">
            {currentStep > 1 && (
              <TouchableOpacity
                onPress={() => setCurrentStep((prev) => prev - 1)}
                disabled={isSubmitting}
                className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center justify-center border border-slate-200"
              >
                <ThemedText className="text-slate-700 font-bold">Anterior</ThemedText>
              </TouchableOpacity>
            )}

            {currentStep < 3 ? (
              <TouchableOpacity
                onPress={handleNext}
                className="flex-1 bg-brand-blue py-3.5 rounded-xl items-center justify-center shadow-sm"
              >
                <ThemedText className="text-white font-bold">Siguiente</ThemedText>
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
                    <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
                    <ThemedText className="text-white font-bold">Solicitar Vuelo</ThemedText>
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
