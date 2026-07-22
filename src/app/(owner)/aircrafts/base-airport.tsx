import AirportPicker from "@/components/airport-picker";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { Airport } from "@/types/all-roles";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function BaseAirportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: aircraft, isLoading, error } = useAircraftDetails(id);

  const [selectedAirport, setSelectedAirport] = useState<Airport | undefined>(
    undefined
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (aircraft?.base_airport) {
      setSelectedAirport(aircraft.base_airport);
    }
  }, [aircraft?.base_airport]);

  const handleSave = async () => {
    if (!id) {
      Alert.alert("Error", "Identificador de aeronave no válido.");
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "AircraftSpecs", id);
      await updateDoc(docRef, {
        base_airport: selectedAirport || null,
        updatedAt: serverTimestamp(),
      });

      await queryClient.invalidateQueries({
        queryKey: ["aircraft-details", id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["owner-aircrafts"],
      });

      Toast.show({
        type: "success",
        text1: "Aeropuerto Base Actualizado",
        text2: selectedAirport
          ? `${selectedAirport.name} (${
              selectedAirport.iata_code || selectedAirport.icao_code || ""
            })`
          : "Se ha removido el aeropuerto base.",
      });

      router.back();
    } catch (err: any) {
      console.error("Error updating base airport:", err);
      Alert.alert("Error", "No se pudo guardar el aeropuerto base.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0f1e3d" />
        <ThemedText className="text-slate-500 mt-2">
          Cargando datos de la aeronave...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !aircraft) {
    return (
      <ThemedView className="flex-1 px-4 justify-center items-center">
        <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={36} color="#EF4444" />
        </View>
        <ThemedText type="subtitle" className="text-center text-slate-800 mb-2">
          Aeronave no encontrada
        </ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-brand-blue px-6 py-2.5 rounded-xl flex-row items-center gap-2"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <ThemedText className="text-white font-semibold">Regresar</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const { basic_specs } = aircraft;

  return (
    <ThemedView className="flex-1 px-4 pt-2">
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
          Aeropuerto Base
        </ThemedText>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Title Section Card */}
        <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center">
          <View className="flex-1">
            <View className="mb-2">
              <ThemedText className="font-bold text-xl text-white">
                {basic_specs.model}
              </ThemedText>
            </View>
            <View className="self-start bg-brand-gold px-4 py-1.5 rounded-full">
              <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                {basic_specs.registration}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Airport Picker Form Card */}
        <ThemedView
          variant="card"
          className="p-5 mb-5 border border-slate-100"
        >
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="location" size={20} color="#0f1e3d" />
            <ThemedText type="subtitle" className="font-bold text-brand-blue">
              Seleccionar Aeropuerto
            </ThemedText>
          </View>
          <ThemedText className="text-xs text-slate-500 mb-4 leading-relaxed">
            Indique el aeropuerto de origen donde la aeronave se encuentra
            estacionada habitualmente para sus operaciones diarias.
          </ThemedText>

          <AirportPicker
            value={selectedAirport}
            onChange={(airport) => setSelectedAirport(airport || undefined)}
          />
        </ThemedView>

        {/* Details Card for selected airport */}
        {selectedAirport && (
          <ThemedView
            variant="card"
            className="p-5 mb-6 border border-slate-100 bg-slate-50/50"
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="information-circle-outline" size={20} color="#0f1e3d" />
              <ThemedText className="font-semibold text-brand-blue">
                Detalles del Aeropuerto Seleccionado
              </ThemedText>
            </View>

            <View className="flex-row justify-between py-2 border-b border-slate-100">
              <ThemedText className="text-xs text-slate-500 font-medium">Nombre</ThemedText>
              <ThemedText className="text-xs font-semibold text-slate-700">{selectedAirport.name}</ThemedText>
            </View>

            <View className="flex-row justify-between py-2 border-b border-slate-100">
              <ThemedText className="text-xs text-slate-500 font-medium">Código IATA / ICAO</ThemedText>
              <ThemedText className="text-xs font-semibold text-slate-700">
                {selectedAirport.iata_code || "—"} / {selectedAirport.icao_code || selectedAirport.gps_code || "—"}
              </ThemedText>
            </View>

            {selectedAirport.municipality && (
              <View className="flex-row justify-between py-2 border-b border-slate-100">
                <ThemedText className="text-xs text-slate-500 font-medium">Ciudad / Municipio</ThemedText>
                <ThemedText className="text-xs font-semibold text-slate-700">{selectedAirport.municipality}</ThemedText>
              </View>
            )}

            <View className="flex-row justify-between py-2 border-b border-slate-100">
              <ThemedText className="text-xs text-slate-500 font-medium">País</ThemedText>
              <ThemedText className="text-xs font-semibold text-slate-700">{selectedAirport.country}</ThemedText>
            </View>

            {selectedAirport.timezone && (
              <View className="flex-row justify-between py-2">
                <ThemedText className="text-xs text-slate-500 font-medium">Zona Horaria</ThemedText>
                <ThemedText className="text-xs font-semibold text-slate-700">
                  {selectedAirport.timezone.replaceAll("_", " ")}
                </ThemedText>
              </View>
            )}
          </ThemedView>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="bg-brand-blue py-4 rounded-xl items-center justify-center mb-8 flex-row gap-2"
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
              <ThemedText className="text-white font-bold text-base">
                Guardar Aeropuerto Base
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}
