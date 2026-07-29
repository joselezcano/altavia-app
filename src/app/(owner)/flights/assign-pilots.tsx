import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerPilots } from "@/hooks/useOwnerPilots";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { PilotProfile } from "@/types/pilot";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

export default function AssignFlightPilotsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { reservationId } = useLocalSearchParams<{
    reservationId?: string;
  }>();

  const targetReservationId = Array.isArray(reservationId) ? reservationId[0] : reservationId;

  const { data: pilots = [], isLoading: isLoadingPilots } = useOwnerPilots(user?.uid);
  const { data: reservations = [], isLoading: isLoadingReservations } = useOwnerReservations(user?.uid);

  const reservation = reservations.find((r) => r.id === targetReservationId);
  const assignedPilotIds = reservation?.pilot_ids || [];

  const [updatingPilotId, setUpdatingPilotId] = useState<string | null>(null);

  const togglePilotAssignment = async (pilot: PilotProfile) => {
    const pilotUid = pilot.user?.uid;
    if (!pilotUid || !targetReservationId) return;

    const isAssigned = assignedPilotIds.includes(pilotUid);
    setUpdatingPilotId(pilotUid);

    try {
      const reservationRef = doc(db, "aircraft-reservation", targetReservationId);
      await updateDoc(reservationRef, {
        pilot_ids: isAssigned
          ? arrayRemove(pilotUid)
          : arrayUnion(pilotUid),
      });

      await queryClient.invalidateQueries({ queryKey: ["owner-reservations", user?.uid] });
    } catch (error) {
      console.error("Error al actualizar tripulación del vuelo:", error);
      Alert.alert("Error", "No se pudo actualizar la tripulación del vuelo.");
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
    const isAssigned = pilotUid ? assignedPilotIds.includes(pilotUid) : false;
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

  const isLoading = isLoadingPilots || isLoadingReservations;
  const displayModel = reservation?.aircraftSpecs?.basic_specs?.model || "";
  const displayRegistration = reservation?.aircraftSpecs?.basic_specs?.registration || "";
  const bothAirportsHaveIATACodes = reservation?.originAirport?.iata_code && reservation?.destinationAirport?.iata_code;

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
          Tripulación del Vuelo
        </ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {/* Target Flight Card */}
      <View className="bg-brand-blue rounded-2xl p-4 mb-4">
        <View className="flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <ThemedText type="caption" className="text-slate-300 font-medium">
              Vuelo seleccionado:
            </ThemedText>
            <ThemedText className="font-bold text-lg text-white mt-0.5">
              {displayModel}
            </ThemedText>
          </View>
          {displayRegistration ? (
            <View className="bg-brand-gold px-3 py-1 rounded-full">
              <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                {displayRegistration}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {bothAirportsHaveIATACodes ? (
          <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <ThemedText className="text-sm font-bold text-slate-200">
              {reservation?.originAirport?.iata_code}
            </ThemedText>
            <MaterialCommunityIcons name="airplane" size={14} color="#C5A059" />
            <ThemedText className="text-sm font-bold text-slate-200">
              {reservation?.destinationAirport?.iata_code}
            </ThemedText>
            <View className="flex-1" />
            <View className="bg-white/15 px-2 py-0.5 rounded-md">
              <ThemedText className="text-sm font-bold text-white">
                {assignedPilotIds.length} tripulante(s)
              </ThemedText>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between gap-3 mt-3 pt-3 border-t border-white/10">
            <View className="flex-col items-start gap-2">
              {/* Origin Airport */}
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="airplane-takeoff" size={14} color="#C5A059" />
                <ThemedText className="text-xs font-bold text-slate-200" numberOfLines={1}>
                  {reservation?.originAirport?.name}
                </ThemedText>
              </View>

              {/* Destination Airport */}
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="airplane-landing" size={14} color="#C5A059" />
                <ThemedText className="text-xs font-bold text-slate-200" numberOfLines={1}>
                  {reservation?.destinationAirport?.name}
                </ThemedText>
              </View>
            </View>
            <View className="flex-row items-center gap-2 bg-white/15 p-2 rounded-md">
              <MaterialCommunityIcons name="account-tie-hat" size={16} color="#FFFFFF" />
              <ThemedText className="text-xs font-bold text-white">
                {assignedPilotIds.length}
              </ThemedText>
            </View>
          </View>
        )}
      </View>

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
            No tienes pilotos vinculados a tu flota actualmente para asignar a este vuelo.
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
