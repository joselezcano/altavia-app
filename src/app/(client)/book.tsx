import AirportPicker from "@/components/airport-picker";
import { CustomDatePicker } from "@/components/custom-date-picker";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ScreenHeader } from "@/components/screen-header";
import UserAvatar from "@/components/user-avatar";
import { WhatsAppContactButton } from "@/components/whatsapp-contact-button";
import { BRAND_COLORS, BRAND_TYPE } from "@/constants/brand";
import { brandFont } from "@/utils/brand-fonts";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { FlightSearchForm, FlightSearchFormSchema } from "@/types/client";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const CURRENT_CONTRACT_VERSION = "1.0";

export default function ClientDashboard() {
  const { user, role } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ reset?: string }>();

  const [isCheckingTerms, setIsCheckingTerms] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    const verifyLegalStatus = async () => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.acceptedTermsVersion !== CURRENT_CONTRACT_VERSION) {
            router.replace("/terms");
            return;
          }
        }
      } catch (error) {
        console.error("Error verificando estado legal:", error);
      } finally {
        setIsCheckingTerms(false);
      }
    };

    verifyLegalStatus();
  }, [user]);

  const [defaultValues] = useState<FlightSearchForm>(() => {
    return {
      trip: {
        origin_airport_ident: "",
        origin_airport: undefined,
        origin_timezone: undefined,
        destination_airport_ident: "",
        destination_airport: undefined,
        destination_timezone: undefined,
      },
      schedule: {
        roundtrip: false,
        outbound_flight_datetime_utc: null,
        return_flight_datetime_utc: null,
      },
      capacity: {
        passangers: 1,
      },
    };
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
    setValue,
    reset,
  } = useForm<FlightSearchForm>({
    resolver: zodResolver(FlightSearchFormSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (params.reset === "true") {
      reset({
        trip: {
          origin_airport_ident: "",
          origin_airport: undefined,
          origin_timezone: undefined,
          destination_airport_ident: "",
          destination_airport: undefined,
          destination_timezone: undefined,
        },
        schedule: {
          roundtrip: false,
          outbound_flight_datetime_utc: null,
          return_flight_datetime_utc: null,
        },
        capacity: {
          passangers: 1,
        },
      });
      setCurrentStep(1);
      router.setParams({ reset: undefined });
    }
  }, [params.reset]);

  const isRoundtrip = watch("schedule.roundtrip");
  const outboundDate = watch("schedule.outbound_flight_datetime_utc");

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await trigger([
        "trip.origin_airport_ident",
        "trip.destination_airport_ident",
        "capacity.passangers",
      ]);
      if (isValid) {
        setCurrentStep(2);
      } else {
        Alert.alert("Faltan datos", "Completá el origen, el destino y la cantidad de pasajeros.");
      }
    }
  };

  const onSubmit = (data: FlightSearchForm) => {
    router.push({
      pathname: "/(client)/search-results",
      params: {
        searchData: JSON.stringify(data),
      },
    });
  };

  if (isCheckingTerms) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#030436" />
      </ThemedView>
    );
  }


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-brand-light"
    >
      <ThemedView className="flex-1 px-4 pt-2">
        <ScreenHeader
          title={currentStep === 2 ? "Fecha y hora" : "Reservar un vuelo"}
          subtitle={`Paso ${currentStep} de 2 · ${currentStep === 2 ? "Cuándo viajás" : "Ruta y pasajeros"}`}
          hideBack={currentStep === 1}
          onBack={() => setCurrentStep(1)}
          right={<UserAvatar size={40} />}
        />

        {/* Indicador de pasos */}
        <View style={stepStyles.row}>
          {[1, 2].map((step) => {
            const active = currentStep === step;
            const done = currentStep > step;
            return (
              <View key={step} style={stepStyles.item}>
                <View style={[stepStyles.dot, active ? stepStyles.dotActive : done ? stepStyles.dotDone : null]}>
                  {done ? (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  ) : (
                    <Text style={[stepStyles.dotText, brandFont(700), active ? stepStyles.dotTextOn : null]}>{step}</Text>
                  )}
                </View>
                <Text style={[stepStyles.label, brandFont(600), active ? stepStyles.labelActive : null]}>
                  {step === 1 ? "Ruta y pasajeros" : "Fecha y hora"}
                </Text>
              </View>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* STEP 1: Route & Passenger Capacity */}
          {currentStep === 1 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 mb-4" style={{ gap: 16 }}>
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                ¿Desde dónde y hacia dónde?
              </ThemedText>

              {/* Origin Airport */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Aeropuerto de origen
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
                        setValue("trip.origin_timezone", airport?.timezone || "");
                      }}
                      title="Aeropuerto de origen"
                    />
                  )}
                />
                {errors.trip?.origin_airport_ident && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.trip.origin_airport_ident.message}
                  </ThemedText>
                )}
              </View>

              {/* Destination Airport */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Aeropuerto de destino
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
                        setValue("trip.destination_timezone", airport?.timezone || "");
                      }}
                      title="Aeropuerto de destino"
                    />
                  )}
                />
                {errors.trip?.destination_airport_ident && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.trip.destination_airport_ident.message}
                  </ThemedText>
                )}
              </View>

              {/* Passengers Count (Airbnb / E-commerce style stepper) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">
                  Pasajeros
                </ThemedText>
                <Controller
                  control={control}
                  name="capacity.passangers"
                  render={({ field: { onChange, value } }) => {
                    const count = typeof value === "number" && !isNaN(value) && value >= 1 ? value : 1;
                    return (
                      <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                        <View className="flex-row items-center flex-1 mr-2" style={{ gap: 10 }}>
                          <View className="w-9 h-9 rounded-full bg-[rgba(3,4,54,0.1)] items-center justify-center">
                            <Ionicons name="people" size={18} color="#030436" />
                          </View>
                          <View className="flex-1">
                            <ThemedText className="font-bold text-brand-blue text-sm" numberOfLines={1}>
                              {count} {count === 1 ? "pasajero" : "pasajeros"}
                            </ThemedText>
                            <ThemedText className="text-xs text-slate-600" numberOfLines={1}>
                              Incluye adultos y menores
                            </ThemedText>
                          </View>
                        </View>

                        <View className="flex-row items-center" style={{ gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => {
                              if (count > 1) {
                                onChange(count - 1);
                              }
                            }}
                            disabled={count <= 1}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: count <= 1 ? "#E2E8F0" : "#CBD5E1",
                              backgroundColor: count <= 1 ? "#F1F5F9" : "#FFFFFF",
                              opacity: count <= 1 ? 0.4 : 1,
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="remove"
                              size={18}
                              color={count <= 1 ? "#94A3B8" : "#030436"}
                            />
                          </TouchableOpacity>

                          <View style={{ minWidth: 26, alignItems: "center", justifyContent: "center" }}>
                            <ThemedText className="text-base font-bold text-brand-blue text-center">
                              {count}
                            </ThemedText>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              if (count < 30) {
                                onChange(count + 1);
                              }
                            }}
                            disabled={count >= 30}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: count >= 30 ? "#94A3B8" : "#030436",
                              opacity: count >= 30 ? 0.4 : 1,
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="add"
                              size={18}
                              color="#FFFFFF"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />
                {errors.capacity?.passangers && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.capacity.passangers.message}
                  </ThemedText>
                )}
              </View>

              {/* Trip type toggle: Roundtrip */}
              <View className="flex-row items-center justify-between pt-2 border-t border-slate-100 mt-1">
                <View>
                  <ThemedText className="font-bold text-slate-800 text-sm">Ida y vuelta</ThemedText>
                  <ThemedText className="text-xs text-slate-600">Activalo si también necesitás el regreso</ThemedText>
                </View>
                <Controller
                  control={control}
                  name="schedule.roundtrip"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: "#CBD5E1", true: "#030436" }}
                      thumbColor="#FFFFFF"
                    />
                  )}
                />
              </View>

              <TouchableOpacity
                onPress={handleNext}
                className="bg-brand-blue py-3.5 rounded-xl items-center justify-center mt-2"
                activeOpacity={0.8}
              >
                <ThemedText className="text-white font-bold">Elegir fecha y hora</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {currentStep === 1 && (
            <View style={{ marginBottom: 24, gap: 8 }}>
              <Text style={[stepStyles.helpText, brandFont(400)]}>¿Varias escalas o una ruta especial?</Text>
              <WhatsAppContactButton variant="outline" message="Hola, quiero consultar por un vuelo con una ruta especial." />
            </View>
          )}

          {/* STEP 2: Dates & Schedule */}
          {currentStep === 2 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 mb-4" style={{ gap: 16 }}>
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                ¿Cuándo viajás?
              </ThemedText>

              {/* Outbound Date */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Salida
                </ThemedText>
                <Controller
                  control={control}
                  name="schedule.outbound_flight_datetime_utc"
                  render={({ field: { onChange, value } }) => (
                    <CustomDatePicker
                      value={value}
                      onChange={onChange}
                      placeholder="Seleccionar fecha y hora de salida"
                      minimumDate={new Date()}
                    />
                  )}
                />
                {errors.schedule?.outbound_flight_datetime_utc && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.schedule.outbound_flight_datetime_utc.message}
                  </ThemedText>
                )}
              </View>

              {/* Return Date (if Roundtrip) */}
              {isRoundtrip && (
                <View>
                  <ThemedText type="caption" className="font-bold mb-1">
                    Regreso
                  </ThemedText>
                  <Controller
                    control={control}
                    name="schedule.return_flight_datetime_utc"
                    render={({ field: { onChange, value } }) => (
                      <CustomDatePicker
                        value={value}
                        onChange={onChange}
                        placeholder="Seleccionar fecha y hora de retorno"
                        minimumDate={outboundDate || new Date()}
                      />
                    )}
                  />
                  {errors.schedule?.return_flight_datetime_utc && (
                    <ThemedText className="text-red-500 text-xs mt-1">
                      {errors.schedule.return_flight_datetime_utc.message}
                    </ThemedText>
                  )}
                </View>
              )}

              <View className="flex-row mt-2" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setCurrentStep(1)}
                  className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center justify-center border border-slate-200"
                  activeOpacity={0.7}
                >
                  <ThemedText className="text-slate-700 font-bold">Atrás</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit(onSubmit)}
                  className="flex-1 bg-brand-gold py-3.5 rounded-xl items-center justify-center flex-row" style={{ gap: 8 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={18} color="#FFFFFF" />
                  <ThemedText className="text-white font-bold">Buscar aviones</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>


      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: BRAND_COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  item: { flex: 1, alignItems: "center" },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },
  dotActive: { backgroundColor: BRAND_COLORS.navy },
  dotDone: { backgroundColor: BRAND_COLORS.azur },
  dotText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.secondary, color: "#475569" },
  dotTextOn: { color: "#FFFFFF" },
  label: { fontFamily: "NotoSans_600SemiBold", fontSize: BRAND_TYPE.label, color: BRAND_COLORS.textMuted, marginTop: 4 },
  labelActive: { color: BRAND_COLORS.navy },
  helpText: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary, color: BRAND_COLORS.textMuted, textAlign: "center" },
});
