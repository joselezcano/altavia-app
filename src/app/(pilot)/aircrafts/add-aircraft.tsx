import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftTemplates } from "@/hooks/useAircraftTemplates";
import { useAuth } from "@/hooks/useAuth";
import { AircraftSpecs, AircraftSpecsSchema } from "@/types/owner";
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
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function AddAircraftScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selector states
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [isManualInput, setIsManualInput] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
    setValue,
  } = useForm<AircraftSpecs>({
    resolver: zodResolver(AircraftSpecsSchema),
    defaultValues: {
      basic_specs: { model: "", type: "", registration: "", pax_count: undefined as any },
      technical_specs: { equipment: [], transponder: "S", flight_rules: "VFR", wake_turbulence_category: "L", fuel_capacity_gallons: undefined as any },
      operating_specs: { cruise_speed_knots: undefined as any, fuel_burn_rate_gph: undefined as any, service_ceiling_feet: undefined as any, max_takeoff_weight_lbs: undefined as any, takeoff_distance_feet: undefined as any, landing_distance_feet: undefined as any, rate_of_climb_fpm: undefined as any },
      emergency: { radio_equipment: [], survival_equipment: [], life_jacket_equipment: [], dinghies_capacity: { carried: false } },
    },
    mode: "onChange",
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useAircraftTemplates();

  const dinghiesCarried = watch("emergency.dinghies_capacity.carried");

  // Watch fields for Step Validation
  const model = watch("basic_specs.model");
  const type = watch("basic_specs.type");
  const registration = watch("basic_specs.registration");
  const pax_count = watch("basic_specs.pax_count");

  const equipment = watch("technical_specs.equipment");
  const transponder = watch("technical_specs.transponder");
  const flightRules = watch("technical_specs.flight_rules");
  const wakeTurbulence = watch("technical_specs.wake_turbulence_category");
  const fuelCapacity = watch("technical_specs.fuel_capacity_gallons");

  const cruiseSpeed = watch("operating_specs.cruise_speed_knots");
  const fuelBurn = watch("operating_specs.fuel_burn_rate_gph");
  const ceiling = watch("operating_specs.service_ceiling_feet");
  const weight = watch("operating_specs.max_takeoff_weight_lbs");
  const takeoffDist = watch("operating_specs.takeoff_distance_feet");
  const landingDist = watch("operating_specs.landing_distance_feet");
  const climbRate = watch("operating_specs.rate_of_climb_fpm");

  const isCurrentStepValid = () => {
    if (currentStep === 1) {
      return !!model && !!type && !!registration && pax_count > 0;
    }
    if (currentStep === 2) {
      return (equipment?.length > 0) && !!transponder && !!flightRules && !!wakeTurbulence && fuelCapacity > 0;
    }
    if (currentStep === 3) {
      return cruiseSpeed > 0 && fuelBurn > 0 && ceiling > 0 && weight > 0 && takeoffDist > 0 && landingDist > 0 && climbRate >= 0;
    }
    return true;
  };

  const onSubmit = async (data: AircraftSpecs) => {
    if (!user) {
      Alert.alert("Error", "No tienes una sesión activa.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Remove undefined values to prevent Firestore serialization crashes
      const cleanData = JSON.parse(JSON.stringify(data));

      // Save specifications into 'AircraftSpecs' collection with owner ID
      await addDoc(collection(db, "AircraftSpecs"), {
        ...cleanData,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });

      Toast.show({
        type: "success",
        text1: "Aeronave Registrada",
        text2: `Matrícula: ${data.basic_specs.registration}`,
      });

      router.back();
    } catch (error: any) {
      console.error("Error creating aircraft specification:", error);
      Alert.alert("Error", error.message || "No se pudo registrar la aeronave.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: string[] = [];

    if (currentStep === 1) {
      fieldsToValidate = [
        "basic_specs.model",
        "basic_specs.type",
        "basic_specs.registration",
        "basic_specs.pax_count",
      ];
    } else if (currentStep === 2) {
      fieldsToValidate = [
        "technical_specs.equipment",
        "technical_specs.transponder",
        "technical_specs.flight_rules",
        "technical_specs.wake_turbulence_category",
        "technical_specs.fuel_capacity_gallons",
      ];
    } else if (currentStep === 3) {
      fieldsToValidate = [
        "operating_specs.cruise_speed_knots",
        "operating_specs.fuel_burn_rate_gph",
        "operating_specs.service_ceiling_feet",
        "operating_specs.max_takeoff_weight_lbs",
        "operating_specs.takeoff_distance_feet",
        "operating_specs.landing_distance_feet",
        "operating_specs.rate_of_climb_fpm",
      ];
    }

    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      Alert.alert("Campos requeridos o inválidos", "Por favor corrige los errores antes de continuar.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-brand-light"
      style={{ paddingTop: insets.top }}
    >
      <ThemedView className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center p-1"
          >
            <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
            <ThemedText className="font-semibold text-brand-blue ml-1">
              Cancelar
            </ThemedText>
          </TouchableOpacity>
          <ThemedText className="font-bold text-brand-blue text-lg">
            Registrar Aeronave
          </ThemedText>
          <View style={{ width: 60 }} />
        </View>

        {/* Step Indicator */}
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
              <ThemedText className="text-[9px] text-slate-500 mt-1 text-center font-medium">
                {step === 1 ? "Básicas" : step === 2 ? "Técnicas" : step === 3 ? "Operación" : "Seguridad"}
              </ThemedText>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* STEP 1: Basic specs */}
          {currentStep === 1 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-1">
                1. Especificaciones Básicas
              </ThemedText>

              {/* Autocomplete Search Input */}
              <View className="border-b border-slate-100 pb-5 mb-2">
                <ThemedText className="font-semibold text-brand-blue mb-2 text-sm">
                  Buscar modelo o código ICAO
                </ThemedText>

                <View >
                  <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                    <Ionicons name="search-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      className="text-brand-text font-medium text-base"
                      style={{ flex: 1, height: 40, paddingVertical: 0 }}
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        setShowSuggestions(text.trim().length > 0);
                        if (!text) {
                          setSelectedTemplateName("");
                        }
                      }}
                      onFocus={() => {
                        if (searchQuery.trim().length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setSearchQuery("");
                          setSelectedTemplateName("");
                          setShowSuggestions(false);
                          setIsManualInput(false);
                          setValue("basic_specs.model", "");
                          setValue("basic_specs.type", "");
                          setValue("basic_specs.pax_count", undefined as any);
                          setValue("basic_specs.registration", "");
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSuggestions && (
                    <View className="absolute top-[52px] left-0 right-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg max-h-48 z-50">
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {templates
                          .filter(
                            (tpl) =>
                              tpl.template_info.name
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              tpl.template_info.type
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase())
                          )
                          .map((tpl) => (
                            <TouchableOpacity
                              key={tpl.id}
                              onPress={() => {
                                setValue("basic_specs.model", tpl.template_info.model);
                                setValue("basic_specs.type", tpl.template_info.type);
                                setValue("basic_specs.pax_count", tpl.template_info.default_pax_count);
                                setValue("technical_specs", tpl.technical_specs);
                                setValue("operating_specs", tpl.operating_specs);
                                setValue("emergency", tpl.emergency);
                                setSelectedTemplateName(tpl.template_info.name);
                                setSearchQuery(tpl.template_info.name);
                                setIsManualInput(false);
                                setShowSuggestions(false);
                                Toast.show({
                                  type: "info",
                                  text1: "Plantilla aplicada",
                                  text2: `${tpl.template_info.name} cargado correctamente.`,
                                });
                              }}
                              className="px-4 py-3 border-b border-slate-100 flex-row justify-between items-center active:bg-slate-50"
                            >
                              <View>
                                <ThemedText className="text-sm font-semibold text-brand-blue">
                                  {tpl.template_info.name}
                                </ThemedText>
                                <ThemedText type="caption" className="text-slate-400 text-xs">
                                  Código ICAO: {tpl.template_info.type}
                                </ThemedText>
                              </View>
                              <Ionicons name="airplane-outline" size={16} color="#b89c50" />
                            </TouchableOpacity>
                          ))}
                        {templates.filter(
                          (tpl) =>
                            tpl.template_info.name
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase()) ||
                            tpl.template_info.type
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                            <View className="px-2 py-4">
                              <ThemedText type="caption" className="text-slate-400 text-center mb-3">
                                No hay coincidencias
                              </ThemedText>
                              <TouchableOpacity
                                onPress={() => {
                                  setIsManualInput(true);
                                  setSelectedTemplateName("");
                                  setShowSuggestions(false);
                                  setValue("basic_specs.model", searchQuery);
                                  setValue("basic_specs.type", "");
                                  setValue("basic_specs.pax_count", undefined as any);
                                  setValue("basic_specs.registration", "");
                                }}
                                className="bg-brand-gold/10 border border-brand-gold/20 px-4 py-2.5 rounded-xl items-center"
                              >
                                <View className="flex-row items-center gap-2">
                                  <Ionicons
                                    name="add-circle-outline"
                                    size={20}
                                    color="#C5A059"
                                  />
                                  <ThemedText type="accent" className="text-base font-bold text-brand-gold">
                                    Ingresar datos manualmente
                                  </ThemedText>
                                </View>
                              </TouchableOpacity>
                            </View>
                          )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Show basic fields only if a template is applied or manual input is active */}
              {(isManualInput || !!selectedTemplateName) && (
                <View className="gap-4">
                  {/* Model */}
                  <View>
                    <ThemedText type="caption" className="font-bold mb-1">Modelo de Avión</ThemedText>
                    <Controller
                      control={control}
                      name="basic_specs.model"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value}
                          onChangeText={onChange}
                          placeholder="Cessna 172 Skyhawk"
                          placeholderTextColor="#94A3B8"
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                        />
                      )}
                    />
                    {errors.basic_specs?.model && (
                      <ThemedText className="text-red-500 text-xs mt-1">
                        {errors.basic_specs.model.message}
                      </ThemedText>
                    )}
                  </View>

                  {/* ICAO Type */}
                  <View>
                    <ThemedText type="caption" className="font-bold mb-1">Tipo de Aeronave (ICAO, 2-4 caracteres)</ThemedText>
                    <Controller
                      control={control}
                      name="basic_specs.type"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value}
                          onChangeText={(val) => onChange(val.toUpperCase().trim())}
                          placeholder="C172"
                          placeholderTextColor="#94A3B8"
                          maxLength={4}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                        />
                      )}
                    />
                    {errors.basic_specs?.type && (
                      <ThemedText className="text-red-500 text-xs mt-1">
                        {errors.basic_specs.type.message}
                      </ThemedText>
                    )}
                  </View>

                  {/* Registration */}
                  <View>
                    <ThemedText type="caption" className="font-bold mb-1">Matrícula / Registro (e.g. ZP1234)</ThemedText>
                    <Controller
                      control={control}
                      name="basic_specs.registration"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value}
                          onChangeText={(val) => onChange(val.toUpperCase().trim())}
                          placeholder="ZP1234"
                          placeholderTextColor="#94A3B8"
                          maxLength={7}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                        />
                      )}
                    />
                    {errors.basic_specs?.registration && (
                      <ThemedText className="text-red-500 text-xs mt-1">
                        {errors.basic_specs.registration.message}
                      </ThemedText>
                    )}
                  </View>

                  {/* Passengers Count */}
                  <View>
                    <ThemedText type="caption" className="font-bold mb-1">Capacidad de Personas a Bordo (POB)</ThemedText>
                    <Controller
                      control={control}
                      name="basic_specs.pax_count"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value !== undefined ? String(value) : ""}
                          onChangeText={(val) => {
                            const parsed = parseInt(val, 10);
                            onChange(isNaN(parsed) ? 0 : parsed);
                          }}
                          placeholder="4"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                        />
                      )}
                    />
                    {errors.basic_specs?.pax_count && (
                      <ThemedText className="text-red-500 text-xs mt-1">
                        {errors.basic_specs.pax_count.message}
                      </ThemedText>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* STEP 2: Technical specs */}
          {currentStep === 2 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                2. Especificaciones Técnicas
              </ThemedText>

              {/* Flight Rules */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">Reglas de Vuelo Permitidas</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.flight_rules"
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
                {errors.technical_specs?.flight_rules && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.technical_specs.flight_rules.message}
                  </ThemedText>
                )}
              </View>

              {/* Wake Turbulence Category */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">Categoría Estela Turbulenta OACI</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.wake_turbulence_category"
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
                {errors.technical_specs?.wake_turbulence_category && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.technical_specs.wake_turbulence_category.message}
                  </ThemedText>
                )}
              </View>

              {/* Equipment (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Equipamiento COM/NAV (Separado por comas o espacios)</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.equipment"
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
                      placeholder="S, D, G"
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                <ThemedText type="caption" className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Ejemplos válidos: S, D, F, G, I, O, P, R, T, U, X, Z.
                </ThemedText>
                {errors.technical_specs?.equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.technical_specs.equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Transponder */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1.5">Transponder</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.transponder"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row flex-wrap gap-2">
                      {(["A", "C", "S", "E", "H", "L", "I", "P", "X"] as const).map((tx) => (
                        <TouchableOpacity
                          key={tx}
                          onPress={() => onChange(tx)}
                          style={{ width: "30%", minWidth: 60 }}
                          className={`py-2 rounded-lg border items-center ${value === tx
                            ? "bg-brand-blue border-brand-blue"
                            : "bg-slate-50 border-slate-200"
                            }`}
                        >
                          <ThemedText
                            className={`font-semibold text-xs ${value === tx ? "text-white" : "text-slate-600"
                              }`}
                          >
                            {tx}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                />
                {errors.technical_specs?.transponder && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.technical_specs.transponder.message}
                  </ThemedText>
                )}
              </View>

              {/* Fuel Usable Capacity */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Capacidad Combustible Usable (Galones)</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.fuel_capacity_gallons"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseFloat(val);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="56"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.technical_specs?.fuel_capacity_gallons && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.technical_specs.fuel_capacity_gallons.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* STEP 3: Operating specs */}
          {currentStep === 3 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                3. Especificaciones de Operación
              </ThemedText>

              {/* Cruise Speed */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Velocidad Crucero (Knots)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.cruise_speed_knots"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseFloat(val);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="124"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.cruise_speed_knots && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.cruise_speed_knots.message}
                  </ThemedText>
                )}
              </View>

              {/* Fuel Burn Rate */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Régimen Consumo Combustible (GPH)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.fuel_burn_rate_gph"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseFloat(val);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="8.5"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.fuel_burn_rate_gph && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.fuel_burn_rate_gph.message}
                  </ThemedText>
                )}
              </View>

              {/* Service Ceiling */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Techo de Servicio (Pies)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.service_ceiling_feet"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="14000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.service_ceiling_feet && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.service_ceiling_feet.message}
                  </ThemedText>
                )}
              </View>

              {/* Max Takeoff Weight */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Peso Máximo Despegue (Libras)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.max_takeoff_weight_lbs"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseFloat(val);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="2550"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.max_takeoff_weight_lbs && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.max_takeoff_weight_lbs.message}
                  </ThemedText>
                )}
              </View>

              {/* Takeoff Distance */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Distancia Carrera Despegue (Pies)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.takeoff_distance_feet"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="1630"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.takeoff_distance_feet && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.takeoff_distance_feet.message}
                  </ThemedText>
                )}
              </View>

              {/* Landing Distance */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Distancia Aterrizaje Requerida (Pies)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.landing_distance_feet"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="1335"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.landing_distance_feet && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.landing_distance_feet.message}
                  </ThemedText>
                )}
              </View>

              {/* Rate of Climb */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Régimen de Ascenso (Pies por Minuto)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.rate_of_climb_fpm"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value !== undefined ? String(value) : ""}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      placeholder="730"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                {errors.operating_specs?.rate_of_climb_fpm && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.operating_specs.rate_of_climb_fpm.message}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* STEP 4: Emergency & Safety Equipment */}
          {currentStep === 4 && (
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                4. Emergencia y Observaciones
              </ThemedText>

              {/* Emergency Radio (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Radio de Emergencia (Distress beacons)</ThemedText>
                <Controller
                  control={control}
                  name="emergency.radio_equipment"
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
                      placeholder="U, V, E"
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                <ThemedText type="caption" className="text-[10px] text-slate-400 mt-1">
                  U (UHF 243.0 MHz), V (VHF 121.5 MHz), E (ELT beacon)
                </ThemedText>
                {errors.emergency?.radio_equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.emergency.radio_equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Survival Gear (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Equipo de Supervivencia</ThemedText>
                <Controller
                  control={control}
                  name="emergency.survival_equipment"
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
                      placeholder="P, D, M, J"
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                <ThemedText type="caption" className="text-[10px] text-slate-400 mt-1">
                  P (Polar), D (Desert), M (Maritime), J (Jungle)
                </ThemedText>
                {errors.emergency?.survival_equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.emergency.survival_equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Life Jackets (Array) */}
              <View>
                <ThemedText type="caption" className="font-bold mb-1">Chalecos Salvavidas (Flotation devices)</ThemedText>
                <Controller
                  control={control}
                  name="emergency.life_jacket_equipment"
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
                      placeholder="L, F, U, V"
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
                <ThemedText type="caption" className="text-[10px] text-slate-400 mt-1">
                  L (Light), F (Fluorescein), U (UHF radio), V (VHF radio)
                </ThemedText>
                {errors.emergency?.life_jacket_equipment && (
                  <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.emergency.life_jacket_equipment.message}
                  </ThemedText>
                )}
              </View>

              {/* Dinghies Carried (Switch) */}
              <View className="flex-row justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-2">
                <View className="flex-1 pr-4">
                  <ThemedText className="font-bold text-sm text-brand-blue">¿Lleva balsas salvavidas?</ThemedText>
                  <ThemedText type="caption" className="text-[11px] text-slate-500 mt-0.5">
                    Activar si el avión cuenta con balsas de emergencia a bordo.
                  </ThemedText>
                </View>
                <Controller
                  control={control}
                  name="emergency.dinghies_capacity.carried"
                  render={({ field: { onChange, value } }) => (
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: "#CBD5E1", true: "#0f1e3d" }}
                      thumbColor={value ? "#b89c50" : "#F1F5F9"}
                    />
                  )}
                />
              </View>

              {/* Dinghies Details (Conditional) */}
              {dinghiesCarried && (
                <View className="bg-slate-50 rounded-xl p-4 border border-slate-200 gap-3 mt-2">
                  <ThemedText className="font-bold text-xs text-brand-blue uppercase tracking-wider">
                    Detalles de Balsas
                  </ThemedText>

                  {/* Quantity */}
                  <View>
                    <ThemedText type="caption" className="font-bold text-xs mb-1">Cantidad de Balsas</ThemedText>
                    <Controller
                      control={control}
                      name="emergency.dinghies_capacity.number"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value !== undefined ? String(value) : ""}
                          onChangeText={(val) => {
                            const parsed = parseInt(val, 10);
                            onChange(isNaN(parsed) ? undefined : parsed);
                          }}
                          placeholder="1"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-brand-text font-medium text-xs"
                        />
                      )}
                    />
                    {errors.emergency?.dinghies_capacity?.number && (
                      <ThemedText className="text-red-500 text-[11px] mt-1">
                        {errors.emergency.dinghies_capacity.number.message}
                      </ThemedText>
                    )}
                  </View>

                  {/* Combined Capacity */}
                  <View>
                    <ThemedText type="caption" className="font-bold text-xs mb-1">Capacidad Combinada Total (Personas)</ThemedText>
                    <Controller
                      control={control}
                      name="emergency.dinghies_capacity.total_capacity"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value !== undefined ? String(value) : ""}
                          onChangeText={(val) => {
                            const parsed = parseInt(val, 10);
                            onChange(isNaN(parsed) ? undefined : parsed);
                          }}
                          placeholder="4"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-brand-text font-medium text-xs"
                        />
                      )}
                    />
                    {errors.emergency?.dinghies_capacity?.total_capacity && (
                      <ThemedText className="text-red-500 text-[11px] mt-1">
                        {errors.emergency.dinghies_capacity.total_capacity.message}
                      </ThemedText>
                    )}
                  </View>

                  {/* Covered (Switch) */}
                  <View className="flex-row justify-between items-center bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <ThemedText type="caption" className="font-bold text-xs">¿Tienen cubierta de protección?</ThemedText>
                    <Controller
                      control={control}
                      name="emergency.dinghies_capacity.covered"
                      render={({ field: { onChange, value } }) => (
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          trackColor={{ false: "#CBD5E1", true: "#0f1e3d" }}
                          thumbColor={value ? "#b89c50" : "#F1F5F9"}
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                      )}
                    />
                  </View>

                  {/* Raft Color */}
                  <View>
                    <ThemedText type="caption" className="font-bold text-xs mb-1">Color de la Balsa (e.g. AMARILLO)</ThemedText>
                    <Controller
                      control={control}
                      name="emergency.dinghies_capacity.color"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          value={value || ""}
                          onChangeText={(val) => onChange(val.toUpperCase())}
                          placeholder="AMARILLO"
                          placeholderTextColor="#94A3B8"
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-brand-text font-medium text-xs"
                        />
                      )}
                    />
                  </View>
                </View>
              )}

              {/* Notes */}
              <View className="mt-2">
                <ThemedText type="caption" className="font-bold mb-1">Observaciones / Notas Adicionales</ThemedText>
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Agrega cualquier detalle adicional aquí..."
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={4}
                      style={{ height: 100, textAlignVertical: "top" }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
                  )}
                />
              </View>
            </View>
          )}
        </ScrollView>


      </ThemedView>

      {/* Bottom Actions */}
      <View
        style={{ paddingBottom: insets.bottom }}
        className="flex-row gap-3 px-4 border-t border-slate-100 bg-brand-light">
        {currentStep > 1 && (
          <TouchableOpacity
            onPress={() => setCurrentStep((prev) => prev - 1)}
            className="flex-1 bg-slate-200 py-4 rounded-xl items-center"
          >
            <ThemedText className="text-slate-700 font-bold">
              Atrás
            </ThemedText>
          </TouchableOpacity>
        )}

        {currentStep < 4 ? (
          <TouchableOpacity
            onPress={handleNext}
            disabled={!isCurrentStepValid()}
            className={`flex-1 py-4 rounded-xl items-center ${isCurrentStepValid() ? "bg-brand-blue" : "bg-slate-300"
              }`}
          >
            <ThemedText className="text-white font-bold">
              Siguiente
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex-1 bg-brand-gold py-4 rounded-xl items-center flex-row justify-center gap-2"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <ThemedText className="text-white font-bold">
                  Guardar Flota
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
