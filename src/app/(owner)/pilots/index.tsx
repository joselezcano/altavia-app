import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerAircrafts } from "@/hooks/useOwnerAircrafts";
import { useOwnerPilots } from "@/hooks/useOwnerPilots";
import { PilotProfile } from "@/types/pilot";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { useState } from "react";
import { useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [emailInput, setEmailInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // TanStack Queries
  const { data: pilots = [], isLoading: isLoadingPilots } = useOwnerPilots(user?.uid);
  const { data: aircrafts = [] } = useOwnerAircrafts(user?.uid);

  // Modal para asignar aeronaves
  const [selectedPilot, setSelectedPilot] = useState<PilotProfile | null>(null);
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
      const q1 = query(
        collection(db, "users"),
        where("roles", "array-contains", "PILOT"),
        where("email", "==", emailInput.trim().toLowerCase()),
        limit(1)
      );
      const querySnapshot = await getDocs(q1);

      if (querySnapshot.empty) {
        Alert.alert(
          "No encontrado",
          "No se encontró ningún piloto registrado con ese correo electrónico."
        );
        setEmailInput("");
        setIsAdding(false);
        return;
      }

      const pilotUserDoc = querySnapshot.docs[0];
      const pilotUid = pilotUserDoc.id;

      // 2. Comprobar perfil existente en 'pilots'
      const pilotProfileRef = doc(db, "pilots", pilotUid);
      const pilotProfileSnap = await getDoc(pilotProfileRef);

      if (pilotProfileSnap.exists()) {
        const existingData = pilotProfileSnap.data() as PilotProfile;
        const currentOwnerIds: string[] = Array.isArray(existingData.owner_ids)
          ? existingData.owner_ids
          : [];

        if (currentOwnerIds.includes(user.uid)) {
          Alert.alert("Aviso", "Este piloto ya está vinculado a tu flota.");
          setEmailInput("");
          setIsAdding(false);
          return;
        }

        // Vincular agregando el ID del owner a owner_ids
        await updateDoc(pilotProfileRef, {
          owner_ids: arrayUnion(user.uid),
          updated_at: serverTimestamp(),
        });

        Alert.alert("Éxito", "Piloto vinculado correctamente a tu flota.");
        setEmailInput("");
      } else {
        Alert.alert("Información", "La persona aún no ha creado su perfil de piloto.");
        setEmailInput("");
      }

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
  const handleUnlinkPilot = (pilotUid: string | undefined) => {
    Alert.alert(
      "Confirmar desvinculación",
      "¿Estás seguro de que deseas desvincular a este piloto de tu flota?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desvincular",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            if (!pilotUid) return;
            try {
              // Desvincular removiendo el ID del owner del array owner_ids y los aircrafts de tal owner
              // TODO: No verifica que la flota se quede sin encargado
              await updateDoc(doc(db, "pilots", pilotUid), {
                owner_ids: arrayRemove(user.uid),
                isEncargado: false,
                managed_aircrafts: arrayRemove(...aircrafts.map(a => a.id)),
              });
              Alert.alert("Éxito", "Piloto desvinculado.");
              queryClient.invalidateQueries({ queryKey: ["owner-pilots", user.uid] });
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
  // TODO: No verifica que no haya otro encargado ya asignado, o que la flota se quede sin encargado
  // TODO: Como actualizar la UI del piloto/encargado en tiempo real cuando se cambia isEncargado?
  const toggleEncargado = async (pilot: PilotProfile) => {
    try {
      await updateDoc(doc(db, "pilots", pilot.user?.uid || ""), {
        isEncargado: !pilot.isEncargado,
        managed_aircrafts: arrayRemove(...aircrafts.map(a => a.id)),
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
      await updateDoc(doc(db, "pilots", selectedPilot.user?.uid || ""), {
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

  const renderPilotItem = ({ item }: { item: PilotProfile }) => {
    const fullName = `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.trim() || "Piloto Registrado";
    const licenceType = item.aeronautical.licence_type;

    return (
      <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-2">
            <ThemedText className="font-bold text-lg text-brand-blue">
              {fullName}
            </ThemedText>
            <ThemedText type="caption" className="text-slate-500 mt-0.5">
              {item.user?.email}
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => handleUnlinkPilot(item.user?.uid)}
            className="p-1"
          >
            <Ionicons name="person-remove" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Aeronautical Badges */}
        <View className="flex-row flex-wrap gap-4 mb-3">
          {licenceType ? (
            <View className="bg-slate-100 px-2.5 py-1 rounded-md justify-center">
              <ThemedText type="caption" className="text-xs font-semibold text-slate-700">
                {licenceType}
              </ThemedText>
            </View>
          ) : null}

          {/* Botón Perfil */}
          <TouchableOpacity
            onPress={() => {
              if (item.user?.uid) {
                router.push({
                  pathname: "/pilots/pilot-details",
                  params: { pilotUid: item.user.uid },
                });
              }
            }}
            className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl gap-1"
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={16} color="#0f1e3d" />
            <ThemedText className="text-brand-blue text-xs font-bold">
              Perfil
            </ThemedText>
            <Ionicons name="chevron-forward" size={12} color="#0f1e3d" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between border-t border-slate-100 pt-3 mt-1 flex-wrap gap-2">
          <View className="flex-row items-center gap-4 flex-wrap mb-1">
            {/* Toggle de Encargado */}
            <TouchableOpacity
              onPress={() => toggleEncargado(item)}
              className={`flex-row items-center px-3 py-1.5 rounded-full border ${item.isEncargado
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
                className={`text-xs font-bold ${item.isEncargado ? "text-brand-gold" : "text-slate-500"
                  }`}
              >
                {item.isEncargado ? "ENCARGADO" : "Hacer Encargado"}
              </ThemedText>
            </TouchableOpacity>

            {/* Botón Asignar Aviones */}
            {item.isEncargado && <TouchableOpacity
              onPress={() => {
                setSelectedPilot(item);
                setModalVisible(true);
              }}
              className="flex-row items-center bg-brand-blue px-3 py-2 rounded-lg"
            >
              <Ionicons name="airplane-outline" size={14} color="white" style={{ marginRight: 4 }} />
              <ThemedText className="text-white text-sm font-bold">
                Aviones a su cargo ({item.managed_aircrafts?.length || 0})
              </ThemedText>
            </TouchableOpacity>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1 px-4 pt-2" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center mb-6 mt-2">
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          className="p-2 mr-3 bg-white rounded-xl shadow-sm border border-slate-100 active:bg-slate-50"
        >
          <Ionicons name="menu" size={24} color="#0f1e3d" />
        </TouchableOpacity>
        <View className="flex-1">
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
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
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
          keyExtractor={(item) => item.user?.uid || item.basic.id_number}
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
                <View className="flex-row justify-between items-center gap-4 mb-3">
                  <ThemedText type="subtitle" className="text-brand-blue font-bold">
                    Asignar Aviones
                  </ThemedText>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <ThemedText type="caption" className="text-slate-500 mb-2">
                  Aeronaves que {selectedPilot?.basic?.id_first_name} {selectedPilot?.basic?.id_last_name} podrá gestionar como Encargado:
                </ThemedText>
              </View>
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
                      className={`flex-row justify-between items-center p-4 mb-2 rounded-xl border ${isAssigned
                        ? "bg-brand-blue/5 border-brand-blue"
                        : "bg-slate-50 border-slate-200"
                        }`}
                    >
                      <View>
                        <ThemedText className="font-bold text-slate-800">
                          {aircraft.basic_specs.model}
                        </ThemedText>
                        <ThemedText type="caption" className="text-slate-500 uppercase mt-0.5">
                          {aircraft.basic_specs.registration}
                        </ThemedText>
                      </View>
                      <View
                        className={`w-6 h-6 rounded-full border items-center justify-center ${isAssigned
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

