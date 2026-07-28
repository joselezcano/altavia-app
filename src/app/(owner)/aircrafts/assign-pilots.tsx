import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerPilots } from "@/hooks/useOwnerPilots";
import { PilotProfile } from "@/types/pilot";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";

export default function AssignPilotsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { id, model, registration } =
    useLocalSearchParams<{ id?: string; model?: string; registration?: string }>();

  const aircraftId = Array.isArray(id) ? id[0] : id;
  const aircraftModel = Array.isArray(model) ? model[0] : model;
  const aircraftRegistration = Array.isArray(registration)
    ? registration[0]
    : registration;

  const { data: pilots = [], isLoading } = useOwnerPilots(user?.uid);
  const [updatingPilotId, setUpdatingPilotId] = useState<string | null>(null);

  const togglePilotAssignment = async (pilot: PilotProfile) => {
    const pilotUid = pilot.user?.uid;
    if (!pilotUid || !aircraftId) return;

    const isAssigned = pilot.pilot_aircrafts?.includes(aircraftId);
    setUpdatingPilotId(pilotUid);

    try {
      const pilotRef = doc(db, "pilots", pilotUid);
      await updateDoc(pilotRef, {
        pilot_aircrafts: isAssigned
          ? arrayRemove(aircraftId)
          : arrayUnion(aircraftId),
      });

      queryClient.invalidateQueries({ queryKey: ["owner-pilots", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["pilot-details", pilotUid] });
    } catch (error) {
      console.error("Error al actualizar asignación de piloto:", error);
      Alert.alert("Error", "No se pudo actualizar la asignación del piloto.");
    } finally {
      setUpdatingPilotId(null);
    }
  };

  const renderPilotItem = ({ item }: { item: PilotProfile }) => {
    const pilotUid = item.user?.uid;
    const fullName =
      `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.trim() ||
      item.user?.email ||
      "Piloto Registrado";
    const isAssigned = aircraftId
      ? item.pilot_aircrafts?.includes(aircraftId)
      : false;
    const isUpdating = updatingPilotId === pilotUid;

    return (
      <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          {/* Pilot Info */}
          <View className="flex-1 pr-3">
            <ThemedText className="font-bold text-lg text-brand-blue">
              {fullName}
            </ThemedText>
            <ThemedText type="caption" className="text-slate-500 mt-0.5">
              {item.user?.email}
            </ThemedText>
            <View className="flex-row items-center gap-2 mt-2">
              {item.aeronautical?.licence_type ? (
                <View className="bg-slate-100 px-2.5 py-0.5 rounded-md">
                  <ThemedText
                    type="caption"
                    className="text-xs font-semibold text-slate-700"
                  >
                    {item.aeronautical.licence_type}
                  </ThemedText>
                </View>
              ) : null}
              {item.isEncargado ? (
                <View className="bg-brand-gold/15 px-2.5 py-0.5 rounded-md border border-brand-gold/20">
                  <ThemedText
                    type="caption"
                    className="text-xs font-bold text-brand-gold"
                  >
                    Encargado
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          {/* Action Checkbox */}
          <TouchableOpacity
            onPress={() => togglePilotAssignment(item)}
            disabled={isUpdating}
            className="p-2 justify-center items-center"
            activeOpacity={0.7}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#0f1e3d" />
            ) : (
              <View
                className={`w-7 h-7 rounded-lg border-2 items-center justify-center ${isAssigned
                  ? "bg-brand-blue border-brand-blue"
                  : "border-slate-300 bg-white"
                  }`}
              >
                {isAssigned && (
                  <Ionicons name="checkmark" size={18} color="white" />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer: Perfil Button */}
        <View className="border-t border-slate-100 pt-3 mt-3 flex-row justify-end items-center">
          <TouchableOpacity
            onPress={() => {
              if (pilotUid) {
                router.push({
                  pathname: "/aircrafts/pilot-details",
                  params: { pilotUid },
                });
              }
            }}
            className="flex-row items-center bg-slate-100 px-3.5 py-1.5 rounded-xl gap-1.5"
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={18} color="#0f1e3d" />
            <ThemedText className="text-brand-blue text-xs font-bold">
              Perfil
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color="#0f1e3d" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
          Asignar Pilotos
        </ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {/* Target Aircraft Card */}
      {aircraftModel || aircraftRegistration ? (
        <View className="bg-brand-blue rounded-2xl p-4 mb-4 flex-row justify-between items-center">
          <View>
            <ThemedText type="caption" className="text-slate-300 font-medium">
              Aeronave seleccionada:
            </ThemedText>
            <ThemedText className="font-bold text-lg text-white mt-0.5">
              {aircraftModel || "Aeronave"}
            </ThemedText>
          </View>
          {aircraftRegistration ? (
            <View className="bg-brand-gold px-3 py-1 rounded-full">
              <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                {aircraftRegistration}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Pilots List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0f1e3d" />
          <ThemedText className="text-slate-500 mt-2">
            Cargando pilotos...
          </ThemedText>
        </View>
      ) : pilots.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6 pb-12">
          <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="people-outline" size={32} color="#94A3B8" />
          </View>
          <ThemedText type="subtitle" className="text-center mb-2 text-slate-700">
            No hay pilotos registrados
          </ThemedText>
          <ThemedText type="caption" className="text-center text-slate-500">
            No tienes pilotos vinculados a tu flota actualmente para asignar a
            esta aeronave.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={pilots}
          renderItem={renderPilotItem}
          keyExtractor={(item) =>
            item.user?.uid || item.basic?.id_number || Math.random().toString()
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </ThemedView>
  );
}
