import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { AircraftTemplate, AircraftTemplateSchema } from "@/types/templates";
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

export default function AddTemplateScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AircraftTemplate>({
    resolver: zodResolver(AircraftTemplateSchema),
    defaultValues: {
      template_info: { name: "", type: "", model: "", default_pax_count: undefined as any },
      technical_specs: { equipment: [], transponder: "S", flight_rules: "VFR", wake_turbulence_category: "L", fuel_capacity_gallons: undefined as any },
      operating_specs: { cruise_speed_knots: undefined as any, fuel_burn_rate_gph: undefined as any, service_ceiling_feet: undefined as any, max_takeoff_weight_lbs: undefined as any, takeoff_distance_feet: undefined as any, landing_distance_feet: undefined as any, rate_of_climb_fpm: undefined as any },
      emergency: { radio_equipment: [], survival_equipment: [], life_jacket_equipment: [], dinghies_capacity: { carried: false } },
    },
    mode: "onChange",
  });

  const onSubmit = async (data: AircraftTemplate) => {
    setIsSubmitting(true);
    try {
      // Remover valores undefined
      const cleanData = JSON.parse(JSON.stringify(data));

      await addDoc(collection(db, "aircraft-templates"), {
        ...cleanData,
        createdAt: serverTimestamp(),
      });

      Toast.show({
        type: "success",
        text1: "Plantilla Registrada",
        text2: `El modelo ${data.template_info.name} ha sido guardado.`,
      });

      router.back();
    } catch (error: any) {
      console.error("Error creating aircraft template:", error);
      Alert.alert("Error", error.message || "No se pudo guardar la plantilla.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4"
      style={{ paddingBottom: insets.bottom }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        // agregar un desplazamiento extra para arriba
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}

      >
        <ThemedView className="flex-1 pt-2"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4 mt-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-row items-center p-1"
            >
              <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
              <ThemedText className="font-semibold text-brand-blue ml-1">
                Volver
              </ThemedText>
            </TouchableOpacity>
            <ThemedText className="font-bold text-brand-blue text-lg">
              Nueva Plantilla
            </ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pb-10">

            {/* SECCIÓN 1: Info Base */}
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-1">
                1. Información de Plantilla
              </ThemedText>

              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Nombre Comercial</ThemedText>
                <Controller
                  control={control}
                  name="template_info.name"
                  render={({ field: { onChange, value } }) => (
                    <TextInput returnKeyType="done"
                      className={`bg-slate-50 border ${errors.template_info?.name ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                      placeholder="Ej. Cessna 208B Grand Caravan"
                      placeholderTextColor="#94A3B8"
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Código ICAO</ThemedText>
                  <Controller
                    control={control}
                    name="template_info.type"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.template_info?.type ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase`}
                        placeholder="Ej. C208"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                        maxLength={4}
                        value={value}
                        onChangeText={(text) => onChange(text.toUpperCase())}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Modelo Fabricante</ThemedText>
                  <Controller
                    control={control}
                    name="template_info.model"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.template_info?.model ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="Ej. 208B"
                        placeholderTextColor="#94A3B8"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Capacidad POB (Defecto)</ThemedText>
                <Controller
                  control={control}
                  name="template_info.default_pax_count"
                  render={({ field: { onChange, value } }) => (
                    <TextInput returnKeyType="done"
                      className={`bg-slate-50 border ${errors.template_info?.default_pax_count ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                      placeholder="Piloto + Pasajeros"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={value ? value.toString() : ""}
                      onChangeText={(val) => onChange(val ? parseInt(val, 10) : undefined)}
                    />
                  )}
                />
              </View>
            </View>

            {/* SECCIÓN 2: Especificaciones Técnicas */}
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-1">
                2. Especificaciones Técnicas
              </ThemedText>

              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Equipos COM/NAV (Separados por coma)</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.equipment"
                  render={({ field: { onChange, value } }) => (
                    <TextInput returnKeyType="done"
                      className={`bg-slate-50 border ${errors.technical_specs?.equipment ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase`}
                      placeholder="S, D, G"
                      placeholderTextColor="#94A3B8"
                      value={value ? value.join(", ") : ""}
                      onChangeText={(val) => {
                        const arr = val.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s);
                        onChange(arr);
                      }}
                    />
                  )}
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-[0.5]">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Tx</ThemedText>
                  <Controller
                    control={control}
                    name="technical_specs.transponder"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase"
                        placeholder="S"
                        placeholderTextColor="#94A3B8"
                        maxLength={1}
                        value={value}
                        onChangeText={(val) => onChange(val.toUpperCase())}
                      />
                    )}
                  />
                </View>
                <View className="flex-[0.5]">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Reglas</ThemedText>
                  <Controller
                    control={control}
                    name="technical_specs.flight_rules"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase"
                        placeholder="VFR"
                        placeholderTextColor="#94A3B8"
                        value={value}
                        onChangeText={(val) => onChange(val.toUpperCase())}
                      />
                    )}
                  />
                </View>
                <View className="flex-[0.5]">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Estela</ThemedText>
                  <Controller
                    control={control}
                    name="technical_specs.wake_turbulence_category"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase"
                        placeholder="L"
                        placeholderTextColor="#94A3B8"
                        maxLength={1}
                        value={value}
                        onChangeText={(val) => onChange(val.toUpperCase())}
                      />
                    )}
                  />
                </View>
              </View>

              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Capacidad Combustible (Gal)</ThemedText>
                <Controller
                  control={control}
                  name="technical_specs.fuel_capacity_gallons"
                  render={({ field: { onChange, value } }) => (
                    <TextInput returnKeyType="done"
                      className={`bg-slate-50 border ${errors.technical_specs?.fuel_capacity_gallons ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                      placeholder="332"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={value ? value.toString() : ""}
                      onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                    />
                  )}
                />
              </View>
            </View>

            {/* SECCIÓN 3: Performance (Operating) */}
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-1">
                3. Performance (Limites)
              </ThemedText>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Vel. Crucero (KT)</ThemedText>
                  <Controller
                    control={control}
                    name="operating_specs.cruise_speed_knots"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.operating_specs?.cruise_speed_knots ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="185"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={value ? value.toString() : ""}
                        onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Consumo (GPH)</ThemedText>
                  <Controller
                    control={control}
                    name="operating_specs.fuel_burn_rate_gph"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.operating_specs?.fuel_burn_rate_gph ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="45"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={value ? value.toString() : ""}
                        onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                      />
                    )}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Techo Serv. (FT)</ThemedText>
                  <Controller
                    control={control}
                    name="operating_specs.service_ceiling_feet"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.operating_specs?.service_ceiling_feet ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="25000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={value ? value.toString() : ""}
                        onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">MTOW (Lbs)</ThemedText>
                  <Controller
                    control={control}
                    name="operating_specs.max_takeoff_weight_lbs"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.operating_specs?.max_takeoff_weight_lbs ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="8750"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={value ? value.toString() : ""}
                        onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                      />
                    )}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Despegue (FT)</ThemedText>
                  <Controller
                    control={control}
                    name="operating_specs.takeoff_distance_feet"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.operating_specs?.takeoff_distance_feet ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="2050"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={value ? value.toString() : ""}
                        onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Aterrizaje (FT)</ThemedText>
                  <Controller
                    control={control}
                    name="operating_specs.landing_distance_feet"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.operating_specs?.landing_distance_feet ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                        placeholder="1625"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={value ? value.toString() : ""}
                        onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                      />
                    )}
                  />
                </View>
              </View>

              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Tasa Ascenso (FPM)</ThemedText>
                <Controller
                  control={control}
                  name="operating_specs.rate_of_climb_fpm"
                  render={({ field: { onChange, value } }) => (
                    <TextInput returnKeyType="done"
                      className={`bg-slate-50 border ${errors.operating_specs?.rate_of_climb_fpm ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base`}
                      placeholder="775"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={value ? value.toString() : ""}
                      onChangeText={(val) => onChange(val ? parseFloat(val) : undefined)}
                    />
                  )}
                />
              </View>
            </View>

            {/* SECCIÓN 4: Emergencia */}
            <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-1">
                4. Emergencia
              </ThemedText>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Radios (U, V, E)</ThemedText>
                  <Controller
                    control={control}
                    name="emergency.radio_equipment"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.emergency?.radio_equipment ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase`}
                        placeholder="E, U"
                        placeholderTextColor="#94A3B8"
                        value={value ? value.join(", ") : ""}
                        onChangeText={(val) => {
                          const arr = val.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s);
                          onChange(arr);
                        }}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Supervivencia</ThemedText>
                  <Controller
                    control={control}
                    name="emergency.survival_equipment"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.emergency?.survival_equipment ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase`}
                        placeholder="P, D, M"
                        placeholderTextColor="#94A3B8"
                        value={value ? value.join(", ") : ""}
                        onChangeText={(val) => {
                          const arr = val.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s);
                          onChange(arr);
                        }}
                      />
                    )}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ThemedText className="font-semibold text-brand-blue mb-1 text-sm">Chalecos</ThemedText>
                  <Controller
                    control={control}
                    name="emergency.life_jacket_equipment"
                    render={({ field: { onChange, value } }) => (
                      <TextInput returnKeyType="done"
                        className={`bg-slate-50 border ${errors.emergency?.life_jacket_equipment ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-3 text-brand-text font-medium text-base uppercase`}
                        placeholder="L, F"
                        placeholderTextColor="#94A3B8"
                        value={value ? value.join(", ") : ""}
                        onChangeText={(val) => {
                          const arr = val.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s);
                          onChange(arr);
                        }}
                      />
                    )}
                  />
                </View>

              </View>

              {/* Balsas */}
              <Controller
                control={control}
                name="emergency.dinghies_capacity"
                render={({ field: { onChange, value } }) => {
                  const currentVal = value || { carried: false };
                  return (
                    <View className="mt-2">
                      <ThemedText className="font-semibold text-brand-blue mb-2 text-sm">¿Lleva balsas salvavidas por defecto?</ThemedText>
                      <View className="flex-row items-center gap-2 mb-3">
                        <Switch
                          value={currentVal.carried}
                          onValueChange={(val) => onChange({ ...currentVal, carried: val })}
                          trackColor={{ false: "#CBD5E1", true: "#C5A059" }}
                          thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (currentVal.carried ? "#FFFFFF" : "#f4f3f4")}
                        />
                        <ThemedText className={currentVal.carried ? "text-brand-text font-medium" : "text-slate-400"}>
                          {currentVal.carried ? "Sí, especificar detalles" : "No"}
                        </ThemedText>
                      </View>

                      {currentVal.carried && (
                        <View className="bg-slate-50 p-3 rounded-xl border border-slate-200 gap-3">
                          <View className="flex-row gap-3">
                            <View className="flex-1">
                              <ThemedText className="font-semibold text-slate-500 mb-1 text-xs">Cantidad</ThemedText>
                              <TextInput returnKeyType="done"
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-brand-text text-sm"
                                placeholder="Ej: 1"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={currentVal.number ? currentVal.number.toString() : ""}
                                onChangeText={(val) => onChange({ ...currentVal, number: val ? parseInt(val) : undefined })}
                              />
                            </View>
                            <View className="flex-1">
                              <ThemedText className="font-semibold text-slate-500 mb-1 text-xs">Capacidad Total</ThemedText>
                              <TextInput returnKeyType="done"
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-brand-text text-sm"
                                placeholder="Ej: 6"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={currentVal.total_capacity ? currentVal.total_capacity.toString() : ""}
                                onChangeText={(val) => onChange({ ...currentVal, total_capacity: val ? parseInt(val) : undefined })}
                              />
                            </View>
                          </View>

                          <View className="flex-row gap-3 mt-1">
                            <View className="flex-1">
                              <ThemedText className="font-semibold text-slate-500 mb-1 text-xs">¿Cubiertas?</ThemedText>
                              <View className="flex-row items-center mt-1">
                                <Switch
                                  value={currentVal.covered || false}
                                  onValueChange={(val) => onChange({ ...currentVal, covered: val })}
                                  trackColor={{ false: "#CBD5E1", true: "#C5A059" }}
                                  thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (currentVal.covered ? "#FFFFFF" : "#f4f3f4")}
                                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                                <ThemedText className="text-sm ml-2 text-slate-600">{currentVal.covered ? 'Sí' : 'No'}</ThemedText>
                              </View>
                            </View>
                            <View className="flex-1">
                              <ThemedText className="font-semibold text-slate-500 mb-1 text-xs">Color</ThemedText>
                              <TextInput returnKeyType="done"
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-brand-text text-sm"
                                placeholder="Ej: ORANGE"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="characters"
                                value={currentVal.color || ""}
                                onChangeText={(val) => onChange({ ...currentVal, color: val ? val.toUpperCase() : undefined })}
                              />
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>



        </ThemedView>
      </KeyboardAvoidingView>
      {/* Footer flotante para Guardar */}
      <View className="py-4 border-t border-slate-100 bg-brand-light">
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-brand-gold py-4 rounded-xl items-center flex-row justify-center gap-2 shadow-sm"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#FFFFFF" />
              <ThemedText className="text-white font-bold text-base">
                Guardar Plantilla
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}
