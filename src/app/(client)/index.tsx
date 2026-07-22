import AirportPicker from "@/components/airport-picker";
import { CustomDatePicker } from "@/components/custom-date-picker";
import SignOutButton from "@/components/sign-out-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useAvailableAircrafts } from "@/hooks/useAvailableAircrafts";
import { FlightSearchForm, FlightSearchFormSchema } from "@/types/client";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const CURRENT_CONTRACT_VERSION = "1.0";

export default function ClientDashboard() {
  const { user, role } = useAuth();
  const router = useRouter();

  const [isCheckingTerms, setIsCheckingTerms] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [activeSearch, setActiveSearch] = useState<FlightSearchForm | null>(null);

  // TanStack Query for searching available aircrafts
  const {
    data: searchResults = [],
    isLoading: isSearching,
    isFetched: isSearchFetched,
  } = useAvailableAircrafts(activeSearch);

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
  } = useForm<FlightSearchForm>({
    resolver: zodResolver(FlightSearchFormSchema),
    defaultValues,
    mode: "onChange",
  });

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
        Alert.alert("Campos requeridos", "Por favor completa el origen, destino y número de pasajeros.");
      }
    }
  };

  const onSubmit = (data: FlightSearchForm) => {
    setActiveSearch(data);
  };

  if (isCheckingTerms) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0f1e3d" />
      </ThemedView>
    );
  }

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-brand-light"
    >
      <ThemedView className="flex-1 px-4 pt-2">
        {/* Top Header with Greeting & Avatar */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <ThemedText
              type="caption"
              className="uppercase font-bold text-brand-gold tracking-widest"
            >
              Bienvenido
            </ThemedText>
            <ThemedText type="title" className="mt-0.5 text-xl">
              {user?.email?.split("@")[0] || "Pasajero"}
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="w-11 h-11 rounded-full bg-brand-blue items-center justify-center shadow-sm"
            activeOpacity={0.8}
          >
            <ThemedText className="text-white font-bold text-base">
              {userInitial}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Step Indicator Header */}
        <View className="flex-row justify-between mb-4 px-4 bg-white py-3 rounded-2xl border border-slate-100 shadow-sm">
          {[1, 2].map((step) => (
            <View key={step} className="items-center flex-1">
              <View
                className={`w-7 h-7 rounded-full items-center justify-center font-bold ${
                  currentStep === step
                    ? "bg-brand-blue"
                    : currentStep > step
                    ? "bg-brand-gold"
                    : "bg-slate-200"
                }`}
              >
                <ThemedText
                  className={`text-xs font-bold ${
                    currentStep >= step ? "text-white" : "text-slate-500"
                  }`}
                >
                  {step}
                </ThemedText>
              </View>
              <ThemedText className="text-[10px] font-medium text-slate-500 mt-1">
                {step === 1 ? "Ruta y Pasajeros" : "Fechas y Horario"}
              </ThemedText>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* STEP 1: Route & Passenger Capacity */}
          {currentStep === 1 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                1. Selecciona tu Ruta y Pasajeros
              </ThemedText>

              {/* Origin Airport */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Aeropuerto Origen
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
                  Aeropuerto Destino
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
                    />
                  )}
                />
                {errors.trip?.destination_airport_ident && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.trip.destination_airport_ident.message}
                  </ThemedText>
                )}
              </View>

              {/* Passengers Count */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Cantidad de Pasajeros
                </ThemedText>
                <Controller
                  control={control}
                  name="capacity.passangers"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={isNaN(value) ? "" : String(value)}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 1 : parsed);
                      }}
                      placeholder="1"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
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
                  <ThemedText className="font-bold text-slate-800 text-sm">Vuelo Ida y Vuelta</ThemedText>
                  <ThemedText className="text-xs text-slate-500">Activa si deseas consultar itinerario de retorno</ThemedText>
                </View>
                <Controller
                  control={control}
                  name="schedule.roundtrip"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: "#CBD5E1", true: "#0f1e3d" }}
                      thumbColor="#FFFFFF"
                    />
                  )}
                />
              </View>

              <TouchableOpacity
                onPress={handleNext}
                className="bg-brand-blue py-3.5 rounded-xl items-center justify-center mt-2 shadow-sm"
                activeOpacity={0.8}
              >
                <ThemedText className="text-white font-bold">Continuar a Fechas</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Dates & Schedule */}
          {currentStep === 2 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                2. Selecciona Fechas del Vuelo
              </ThemedText>

              {/* Outbound Date */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">
                  Fecha y Hora de Salida (Ida)
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
                    Fecha y Hora de Retorno (Vuelta)
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

              <View className="flex-row gap-3 mt-2">
                <TouchableOpacity
                  onPress={() => setCurrentStep(1)}
                  className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center justify-center border border-slate-200"
                  activeOpacity={0.7}
                >
                  <ThemedText className="text-slate-700 font-bold">Anterior</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit(onSubmit)}
                  className="flex-1 bg-brand-gold py-3.5 rounded-xl items-center justify-center shadow-md flex-row gap-2"
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={18} color="#FFFFFF" />
                  <ThemedText className="text-white font-bold">Buscar Vuelos</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Search Loading Indicator */}
          {isSearching && (
            <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-100 items-center justify-center mb-6 my-4">
              <ActivityIndicator size="large" color="#0f1e3d" />
              <ThemedText className="text-slate-600 font-medium mt-3 text-center">
                Buscando aeronaves disponibles y verificando itinerarios...
              </ThemedText>
            </View>
          )}

          {/* Search Results List */}
          {activeSearch && !isSearching && isSearchFetched && (
            <View className="mb-10">
              <View className="flex-row items-center justify-between mb-3 px-1">
                <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                  Aeronaves Disponibles ({searchResults.length})
                </ThemedText>
                <TouchableOpacity
                  onPress={() => {
                    setActiveSearch(null);
                    setCurrentStep(1);
                  }}
                  className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
                >
                  <ThemedText className="text-xs font-bold text-slate-700">Nueva Búsqueda</ThemedText>
                </TouchableOpacity>
              </View>

              {searchResults.length === 0 ? (
                <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-200 items-center justify-center">
                  <Ionicons name="airplane-outline" size={40} color="#94a3b8" />
                  <ThemedText type="subtitle" className="mt-3 text-center text-slate-700">
                    No hay aeronaves disponibles
                  </ThemedText>
                  <ThemedText className="text-slate-500 text-xs text-center mt-1">
                    No encontramos aeronaves en el aeropuerto de origen con la capacidad y disponibilidad requerida para estas fechas.
                  </ThemedText>
                </View>
              ) : (
                <View className="gap-4">
                  {searchResults.map(({ aircraft, flightDurationHours, distanceNm }) => (
                    <View
                      key={aircraft.id}
                      className="bg-brand-white rounded-2xl p-5 border border-slate-200 shadow-sm"
                    >
                      {/* Card Top Header */}
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-1 pr-2">
                          <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                            {aircraft.basic_specs.model}
                          </ThemedText>
                          <ThemedText className="text-xs text-slate-500 font-medium mt-0.5">
                            Matrícula: {aircraft.basic_specs.registration}
                          </ThemedText>
                        </View>
                        <View className="bg-brand-blue/10 px-3 py-1 rounded-full border border-brand-blue/20">
                          <ThemedText className="text-brand-blue text-xs font-bold">
                            {aircraft.basic_specs.type}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Specs Summary Grid */}
                      <View className="bg-slate-50 rounded-xl p-3 flex-row flex-wrap justify-between gap-y-2 mb-4 border border-slate-100">
                        <View className="w-[48%]">
                          <ThemedText className="text-[11px] text-slate-500">Capacidad (Pax)</ThemedText>
                          <ThemedText className="font-bold text-slate-800 text-sm">
                            {aircraft.basic_specs.pax_count} personas
                          </ThemedText>
                        </View>

                        <View className="w-[48%]">
                          <ThemedText className="text-[11px] text-slate-500">Velocidad Crucero</ThemedText>
                          <ThemedText className="font-bold text-slate-800 text-sm">
                            {aircraft.operating_specs.cruise_speed_knots} kts
                          </ThemedText>
                        </View>

                        <View className="w-[48%]">
                          <ThemedText className="text-[11px] text-slate-500">Techo de Servicio</ThemedText>
                          <ThemedText className="font-bold text-slate-800 text-sm">
                            {aircraft.operating_specs.service_ceiling_feet} ft
                          </ThemedText>
                        </View>

                        <View className="w-[48%]">
                          <ThemedText className="text-[11px] text-slate-500">Tiempo de Vuelo Est.</ThemedText>
                          <ThemedText className="font-bold text-brand-gold text-sm">
                            {flightDurationHours < 1
                              ? `${Math.round(flightDurationHours * 60)} min`
                              : `${flightDurationHours.toFixed(1)} hrs`}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Detail Screen Button */}
                      <TouchableOpacity
                        onPress={() => {
                          router.push({
                            pathname: "/(client)/aircraft-details",
                            params: {
                              aircraftJson: JSON.stringify(aircraft),
                            },
                          });
                        }}
                        className="bg-brand-blue py-3 rounded-xl items-center justify-center flex-row gap-2 shadow-sm"
                        activeOpacity={0.8}
                      >
                        <ThemedText className="text-white font-bold text-sm">Ver Información y Reservar</ThemedText>
                        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Profile Bottom Sheet Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <View
              className="mt-auto bg-brand-white rounded-t-3xl pt-2 pb-10 px-6 shadow-lg"
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <View className="w-12 h-1.5 bg-slate-300 rounded-full self-center mb-6" />

              <View className="items-center mb-6">
                <View className="w-20 h-20 rounded-full bg-brand-blue items-center justify-center shadow-sm mb-4">
                  <ThemedText className="text-white font-bold text-3xl">
                    {userInitial}
                  </ThemedText>
                </View>

                <ThemedText type="subtitle" className="text-center mb-1">
                  Mi Cuenta
                </ThemedText>
                <ThemedText type="caption" className="text-center mb-4">
                  {user?.email}
                </ThemedText>

                <View className="flex-row space-x-2 mb-6">
                  <View className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <ThemedText type="caption" className="font-bold text-brand-blue">
                      ROL: {role}
                    </ThemedText>
                  </View>
                  <View className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <ThemedText type="caption" className="font-bold text-brand-gold">
                      VERIFICADO
                    </ThemedText>
                  </View>
                </View>
              </View>

              <SignOutButton />
            </View>
          </TouchableOpacity>
        </Modal>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
