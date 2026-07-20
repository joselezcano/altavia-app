import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerAircrafts } from "@/hooks/useOwnerAircrafts";
import { useOwnerPilots, FullPilotData } from "@/hooks/useOwnerPilots";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  setDoc,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function PilotsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [emailInput, setEmailInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // TanStack Queries (replacing useEffect/onSnapshot)
  const { data: pilots = [], isLoading: isLoadingPilots } = useOwnerPilots(user?.uid);
  const { data: aircrafts = [] } = useOwnerAircrafts(user?.uid);

  // Modal para asignar aeronaves
  const [selectedPilot, setSelectedPilot] = useState<FullPilotData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Vincular un piloto mediante correo electrónico
  const handleLinkPilot = async () => {
    if (!user) return;
    if (!emailInput.trim()) {
      Alert.alert("Error", "Por favor ingresa un correo electrónico.");
      return;
    }

    setIsAdding(true);
    try {
      // 1. Buscar en colección 'users' para verificar que sea un piloto registrado
      const q = query(
        collection(db, "users"),
        where("roles", "array-contains", "PILOT"),
        where("email", "==", emailInput.trim().toLowerCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert(
          "No encontrado",
          "No se encontró ningún piloto registrado con ese correo electrónico."
        );
        setIsAdding(false);
        return;
      }

      const pilotDoc = querySnapshot.docs[0];

      // 2. Comprobar si ya existe un perfil en la colección 'pilots'
      const pilotProfileRef = doc(db, "pilots", pilotDoc.id);
      const pilotProfilesQuery = query(
        collection(db, "pilots"),
        where("ownerId", "==", user.uid)
      );
      const currentPilots = await getDocs(pilotProfilesQuery);
      let alreadyLinked = false;
      currentPilots.forEach((doc) => {
        if (doc.id === pilotDoc.id) {
          alreadyLinked = true;
        }
      });

      if (alreadyLinked) {
        Alert.alert("Aviso", "Este piloto ya está vinculado a tu flota.");
        setEmailInput("");
        setIsAdding(false);
        return;
      }

      // 3. Crear/actualizar el perfil específico en la colección 'pilots'
      await setDoc(pilotProfileRef, {
        uid: pilotDoc.id,
        ownerId: user.uid,
        isEncargado: false,
        managed_aircrafts: [],
      });

      Alert.alert("Éxito", "Piloto vinculado correctamente a tu flota.");
      setEmailInput("");
      
      // Invalidar query para recargar
      queryClient.invalidateQueries({ queryKey: ["owner-pilots", user.uid] });
    } catch (error) {
      console.error("Error al vincular piloto:", error);
      Alert.alert("Error", "Ocurrió un error al intentar vincular al piloto.");
    } finally {
      setIsAdding(false);
    }
  };

  // Desvincular piloto
  const handleUnlinkPilot = (pilotId: string) => {
    Alert.alert(
      "Confirmar desvinculación",
      "¿Estás seguro de que deseas desvincular a este piloto de tu flota?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desvincular",
          style: "destructive",
          onPress: async () => {
            try {
              // Desvincular seteando ownerId a null en la colección 'pilots'
              await updateDoc(doc(db, "pilots", pilotId), {
                ownerId: null,
                isEncargado: false,
                managed_aircrafts: [],
              });
              Alert.alert("Éxito", "Piloto desvinculado.");
              queryClient.invalidateQueries({ queryKey: ["owner-pilots", user?.uid] });
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No se pudo desvincular al piloto.");
            }
          },
        },
      ]
    );
  };

  // Alternar rol ENCARGADO
  const toggleEncargado = async (pilot: FullPilotData) => {
    try {
      await updateDoc(doc(db, "pilots", pilot.uid), {
        isEncargado: !pilot.isEncargado,
      });
      queryClient.invalidateQueries({ queryKey: ["owner-pilots", user?.uid] });
    } catch (error) {
      console.error("Error al cambiar estado de encargado:", error);
      Alert.alert("Error", "No se pudo cambiar el estado de encargado.");
    }
  };

  // Gestionar selección de aeronaves
  const toggleAircraftAssignment = async (aircraftId: string) => {
    if (!selectedPilot) return;
    const currentSpecs = selectedPilot.managed_aircrafts || [];
    let updatedSpecs: string[];

    if (currentSpecs.includes(aircraftId)) {
      updatedSpecs = currentSpecs.filter((id) => id !== aircraftId);
    } else {
      updatedSpecs = [...currentSpecs, aircraftId];
    }

    try {
      await updateDoc(doc(db, "pilots", selectedPilot.uid), {
        managed_aircrafts: updatedSpecs,
      });
      
      // Actualizar estado local del piloto seleccionado para reflejar en UI del modal
      setSelectedPilot({
        ...selectedPilot,
        managed_aircrafts: updatedSpecs,
      });
      
      queryClient.invalidateQueries({ queryKey: ["owner-pilots", user?.uid] });
    } catch (error) {
      console.error("Error al asignar aeronave:", error);
      Alert.alert("Error", "No se pudo actualizar la asignación de aeronaves.");
    }
  };

  const renderPilotItem = ({ item }: { item: FullPilotData }) => {
    return (
      <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <ThemedText className="font-bold text-lg text-brand-blue">
              {item.firstName} {item.lastName}
            </ThemedText>
            <ThemedText type="caption" className="text-slate-500 mt-0.5">
              {item.email}
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => handleUnlinkPilot(item.uid)}
            className="p-1"
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between border-t border-slate-100 pt-3 mt-1">
          {/* Toggle de Encargado */}
          <TouchableOpacity
            onPress={() => toggleEncargado(item)}
            className={`flex-row items-center px-3 py-1.5 rounded-full border ${
              item.isEncargado
                ? "bg-brand-gold/15 border-brand-gold/30"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <Ionicons
              name={item.isEncargado ? "star" : "star-outline"}
              size={14}
              color={item.isEncargado ? "#b89c50" : "#64748B"}
              style={{ marginRight: 4 }}
            />
            <ThemedText
              className={`text-xs font-bold ${
                item.isEncargado ? "text-brand-gold" : "text-slate-500"
              }`}
            >
              {item.isEncargado ? "ENCARGADO" : "Hacer Encargado"}
            </ThemedText>
          </TouchableOpacity>

          {/* Botón Asignar Aviones */}
          {item.isEncargado && (
            <TouchableOpacity
              onPress={() => {
                setSelectedPilot(item);
                setModalVisible(true);
              }}
              className="flex-row items-center bg-brand-blue px-3 py-1.5 rounded-lg"
            >
              <Ionicons name="airplane-outline" size={14} color="white" style={{ marginRight: 4 }} />
              <ThemedText className="text-white text-xs font-bold">
                Asignar Aviones ({item.managed_aircrafts?.length || 0})
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Header */}
      <View className="mb-6 mt-2">
        <ThemedText
          type="caption"
          className="uppercase font-bold text-brand-gold tracking-widest text-xs"
        >
          Tripulación Privada
        </ThemedText>
        <ThemedText type="title" className="text-2xl font-bold mt-0.5 text-brand-blue">
          Mis Pilotos
        </ThemedText>
      </View>

      {/* Formulario Vincular Piloto */}
      <View className="bg-brand-white border border-slate-100 rounded-2xl p-4 mb-6 shadow-sm">
        <ThemedText className="font-semibold text-brand-blue mb-2 text-sm">
          Vincular nuevo piloto
        </ThemedText>
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-brand-text font-medium text-sm"
            placeholder="ejemplo@piloto.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={emailInput}
            onChangeText={setEmailInput}
          />
          <TouchableOpacity
            onPress={handleLinkPilot}
            disabled={isAdding}
            className="bg-brand-blue px-4 py-2.5 rounded-xl justify-center items-center"
          >
            {isAdding ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="link" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Pilotos */}
      {isLoadingPilots ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0f1e3d" />
          <ThemedText className="text-slate-500 mt-2">Cargando pilotos...</ThemedText>
        </View>
      ) : pilots.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6 pb-12">
          <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="people" size={32} color="#94A3B8" />
          </View>
          <ThemedText type="subtitle" className="text-center mb-2 text-slate-700">
            No tienes pilotos vinculados
          </ThemedText>
          <ThemedText type="caption" className="text-center text-slate-500">
            Ingresa el correo electrónico de un piloto registrado en la plataforma para sumarlo a tu tripulación y asignarle aeronaves.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={pilots}
          renderItem={renderPilotItem}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Modal de Asignación de Aeronaves */}
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
                  Asignar Aeronaves
                </ThemedText>
                <ThemedText type="caption" className="text-slate-500">
                  Para: {selectedPilot?.firstName} {selectedPilot?.lastName}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {aircrafts.length === 0 ? (
              <View className="py-8 items-center">
                <ThemedText className="text-slate-500 text-center">
                  No tienes aeronaves registradas para asignar.
                </ThemedText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                {aircrafts.map((aircraft) => {
                  const isAssigned = selectedPilot?.managed_aircrafts?.includes(aircraft.id) || false;
                  return (
                    <TouchableOpacity
                      key={aircraft.id}
                      onPress={() => toggleAircraftAssignment(aircraft.id)}
                      className={`flex-row justify-between items-center p-4 mb-2 rounded-xl border ${
                        isAssigned
                          ? "bg-brand-blue/5 border-brand-blue"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <View>
                        <ThemedText className="font-bold text-slate-800">
                          {aircraft.basic_specs.model}
                        </ThemedText>
                        <ThemedText type="caption" className="text-slate-500 uppercase mt-0.5">
                          {aircraft.basic_specs.registration} • {aircraft.basic_specs.type}
                        </ThemedText>
                      </View>
                      <View
                        className={`w-6 h-6 rounded-full border items-center justify-center ${
                          isAssigned
                            ? "bg-brand-blue border-brand-blue"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isAssigned && (
                          <Ionicons name="checkmark" size={14} color="white" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="bg-brand-blue w-full py-3.5 rounded-xl items-center mt-2"
            >
              <ThemedText className="text-white font-bold">Aceptar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
