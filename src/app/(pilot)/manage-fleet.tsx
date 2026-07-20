import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useManagedAircrafts, AircraftSpecsDoc } from "@/hooks/useManagedAircrafts";
import { useOwnerPilots, FullPilotData } from "@/hooks/useOwnerPilots";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  TouchableOpacity,
  View,
} from "react-native";

export default function ManageFleetScreen() {
  const { profileData } = useAuth();
  const queryClient = useQueryClient();

  // Modal para asignar pilotos
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftSpecsDoc | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // TanStack Queries (fetching aircrafts and owner pilots)
  const isEncargado = profileData?.isEncargado === true;
  const managedAircraftsList = profileData?.managed_aircrafts || [];
  const ownerId = profileData?.ownerId;

  const { data: aircrafts = [], isLoading: isLoadingAircrafts } = useManagedAircrafts(
    isEncargado ? managedAircraftsList : []
  );

  const { data: pilots = [] } = useOwnerPilots(ownerId);

  // Asignar piloto a aeronave
  const handleAssignPilot = async (pilot: FullPilotData | null) => {
    if (!selectedAircraft) return;

    try {
      await updateDoc(doc(db, "AircraftSpecs", selectedAircraft.id), {
        assignedPilotId: pilot ? pilot.uid : null,
        assignedPilotName: pilot ? `${pilot.firstName} ${pilot.lastName}` : null,
      });

      Alert.alert(
        "Éxito",
        pilot
          ? `Piloto ${pilot.firstName} asignado correctamente.`
          : "Piloto desasignado de la aeronave."
      );
      
      // Invalidate query to refresh
      queryClient.invalidateQueries({ queryKey: ["managed-aircrafts", managedAircraftsList] });
      setModalVisible(false);
    } catch (error) {
      console.error("Error al asignar piloto:", error);
      Alert.alert("Error", "No se pudo realizar la asignación.");
    }
  };

  const renderAircraftItem = ({ item }: { item: AircraftSpecsDoc }) => {
    return (
      <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <ThemedText className="font-bold text-lg text-brand-blue">
              {item.basic_specs.model}
            </ThemedText>
            <View className="flex-row items-center gap-2 mt-1">
              <View className="bg-slate-100 px-2 py-0.5 rounded">
                <ThemedText type="caption" className="text-[10px] font-semibold text-slate-600 uppercase">
                  {item.basic_specs.type}
                </ThemedText>
              </View>
              <ThemedText type="caption" className="text-slate-400">
                POB: {item.basic_specs.pax_count}
              </ThemedText>
            </View>
          </View>
          <View className="bg-brand-gold/15 px-3 py-1 rounded-full border border-brand-gold/20">
            <ThemedText className="text-brand-gold text-xs font-bold uppercase tracking-wider">
              {item.basic_specs.registration}
            </ThemedText>
          </View>
        </View>

        <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center mt-2">
          <View className="flex-1">
            <ThemedText type="caption" className="text-slate-400 text-xs">
              Piloto Asignado:
            </ThemedText>
            <ThemedText className="font-semibold text-slate-700 text-sm mt-0.5">
              {item.assignedPilotName || "Ninguno (Sin asignar)"}
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => {
              setSelectedAircraft(item);
              setModalVisible(true);
            }}
            className="bg-brand-blue px-3 py-2 rounded-xl flex-row items-center gap-1.5"
          >
            <Ionicons name="person-add-outline" size={14} color="white" />
            <ThemedText className="text-white text-xs font-bold">
              Asignar
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!isEncargado) {
    return (
      <ThemedView className="flex-1 justify-center items-center px-6">
        <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
        <ThemedText type="subtitle" className="text-center mt-4 text-slate-700">
          Acceso Restringido
        </ThemedText>
        <ThemedText type="caption" className="text-center text-slate-500 mt-2">
          Esta sección está disponible únicamente para pilotos con rango de Encargado.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Header */}
      <View className="mb-6 mt-2">
        <ThemedText
          type="caption"
          className="uppercase font-bold text-brand-gold tracking-widest text-xs"
        >
          Gestión de Flota
        </ThemedText>
        <ThemedText type="title" className="text-2xl font-bold mt-0.5 text-brand-blue">
          Aviones a mi Cargo
        </ThemedText>
      </View>

      {/* Listado */}
      {isLoadingAircrafts ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0f1e3d" />
          <ThemedText className="text-slate-500 mt-2">Cargando flota...</ThemedText>
        </View>
      ) : aircrafts.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6 pb-12">
          <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="airplane-outline" size={32} color="#94A3B8" />
          </View>
          <ThemedText type="subtitle" className="text-center mb-2 text-slate-700">
            Sin aeronaves asignadas
          </ThemedText>
          <ThemedText type="caption" className="text-center text-slate-500">
            Tu propietario aún no te ha asignado aeronaves bajo tu cargo de Encargado.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={aircrafts}
          renderItem={renderAircraftItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Modal para Asignar Piloto */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-brand-white w-full max-h-[80%] rounded-2xl p-6 shadow-xl">
            <View className="flex-row justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <View>
                <ThemedText type="subtitle" className="text-brand-blue font-bold">
                  Asignar Piloto
                </ThemedText>
                <ThemedText type="caption" className="text-slate-500">
                  Para: {selectedAircraft?.basic_specs.model} ({selectedAircraft?.basic_specs.registration})
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pilots}
              keyExtractor={(item) => item.uid}
              ListHeaderComponent={
                selectedAircraft?.assignedPilotId ? (
                  <TouchableOpacity
                    onPress={() => handleAssignPilot(null)}
                    className="flex-row items-center p-4 mb-3 rounded-xl border border-red-200 bg-red-50 justify-between"
                  >
                    <ThemedText className="font-bold text-red-600">Desasignar Piloto Actual</ThemedText>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = selectedAircraft?.assignedPilotId === item.uid;
                return (
                  <TouchableOpacity
                    onPress={() => handleAssignPilot(item)}
                    className={`flex-row justify-between items-center p-4 mb-2 rounded-xl border ${
                      isSelected
                        ? "bg-brand-blue/5 border-brand-blue"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <View>
                      <ThemedText className="font-bold text-slate-800">
                        {item.firstName} {item.lastName}
                      </ThemedText>
                      <ThemedText type="caption" className="text-slate-500 mt-0.5">
                        {item.email}
                      </ThemedText>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border items-center justify-center ${
                        isSelected
                          ? "bg-brand-blue border-brand-blue"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="bg-slate-200 w-full py-3.5 rounded-xl items-center mt-4"
            >
              <ThemedText className="text-slate-700 font-bold">Cancelar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
