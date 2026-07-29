import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAllAircrafts, AdminAircraftSpecsDoc } from "@/hooks/useAllAircrafts";
import { useModelPricing, ModelPricingDoc } from "@/hooks/useModelPricing";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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

export default function FleetPricingScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"fleet" | "models">("fleet");

  // TanStack Queries
  const { data: aircrafts = [], isLoading: isLoadingAircrafts } = useAllAircrafts();
  const { data: modelPricing = [], isLoading: isLoadingModels } = useModelPricing();

  // Modal para sobrescribir tarifa de avión específico
  const [selectedAircraft, setSelectedAircraft] = useState<AdminAircraftSpecsDoc | null>(null);
  const [overridePriceInput, setOverridePriceInput] = useState("");
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);

  // Modal para agregar/editar tarifa base por modelo
  const [selectedModel, setSelectedModel] = useState<ModelPricingDoc | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [modelPriceInput, setModelPriceInput] = useState("");
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);

  // Encontrar la tarifa efectiva de un avión (individual override o default por modelo)
  const getEffectiveRate = (aircraft: AdminAircraftSpecsDoc) => {
    if (aircraft.pricePerMileOverride !== null && aircraft.pricePerMileOverride !== undefined) {
      return { rate: aircraft.pricePerMileOverride, type: "Personalizada" };
    }
    const modelConf = modelPricing.find(
      (m) => m.model.toUpperCase() === aircraft.basic_specs.type.toUpperCase()
    );
    if (modelConf) {
      return { rate: modelConf.defaultPricePerMile, type: "Por Modelo" };
    }
    return { rate: null, type: "Sin definir" };
  };

  // Guardar Tarifa de Avión Particular (Override)
  const handleSaveOverride = async () => {
    if (!selectedAircraft) return;
    const price = parseFloat(overridePriceInput);
    if (overridePriceInput.trim() !== "" && (isNaN(price) || price < 0)) {
      Alert.alert("Error", "Por favor ingresa un precio válido o deja el campo vacío.");
      return;
    }

    setIsSavingOverride(true);
    try {
      const docRef = doc(db, "AircraftSpecs", selectedAircraft.id);
      await updateDoc(docRef, {
        pricePerMileOverride: overridePriceInput.trim() === "" ? null : price,
      });

      Alert.alert("Éxito", "Tarifa de aeronave actualizada correctamente.");
      setOverrideModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["all-aircrafts"] });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo actualizar la tarifa.");
    } finally {
      setIsSavingOverride(false);
    }
  };

  // Guardar Tarifa Base por Modelo
  const handleSaveModelPricing = async () => {
    const modelName = modelInput.trim().toUpperCase();
    const price = parseFloat(modelPriceInput);

    if (!modelName) {
      Alert.alert("Error", "El código del modelo es obligatorio.");
      return;
    }
    if (isNaN(price) || price < 0) {
      Alert.alert("Error", "Por favor ingresa un precio válido.");
      return;
    }

    setIsSavingModel(true);
    try {
      const docRef = doc(db, "model-pricing", modelName);
      await setDoc(docRef, {
        model: modelName,
        defaultPricePerMile: price,
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Éxito", "Tarifa por modelo configurada correctamente.");
      setModelModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["model-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["all-aircrafts"] }); // Recalcular efectivas
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo registrar la tarifa del modelo.");
    } finally {
      setIsSavingModel(false);
    }
  };

  const openOverrideModal = (aircraft: AdminAircraftSpecsDoc) => {
    setSelectedAircraft(aircraft);
    setOverridePriceInput(aircraft.pricePerMileOverride?.toString() || "");
    setOverrideModalVisible(true);
  };

  const openModelModal = (modelConf: ModelPricingDoc | null) => {
    if (modelConf) {
      setSelectedModel(modelConf);
      setModelInput(modelConf.model);
      setModelPriceInput(modelConf.defaultPricePerMile.toString());
    } else {
      setSelectedModel(null);
      setModelInput("");
      setModelPriceInput("");
    }
    setModelModalVisible(true);
  };

  return (
    <ThemedView className="flex-1 bg-brand-light">
      {/* Tabs superiores */}
      <View className="flex-row border-b border-slate-200 bg-white">
        <TouchableOpacity
          onPress={() => setActiveTab("fleet")}
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === "fleet" ? "border-brand-gold" : "border-transparent"
          }`}
        >
          <ThemedText
            className={`font-bold ${
              activeTab === "fleet" ? "text-brand-blue" : "text-slate-400"
            }`}
          >
            Flota Global
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("models")}
          className={`flex-1 py-4 items-center border-b-2 ${
            activeTab === "models" ? "border-brand-gold" : "border-transparent"
          }`}
        >
          <ThemedText
            className={`font-bold ${
              activeTab === "models" ? "text-brand-blue" : "text-slate-400"
            }`}
          >
            Tarifas por Modelo
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Contenido según pestaña */}
      {activeTab === "fleet" ? (
        <View className="flex-1 px-4 pt-4">
          <View className="mb-4">
            <ThemedText type="caption" className="text-slate-500">
              Establece tarifas de dry lease y asigna multiplicadores por milla.
            </ThemedText>
          </View>

          {isLoadingAircrafts ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0f1e3d" />
            </View>
          ) : aircrafts.length === 0 ? (
            <View className="flex-1 justify-center items-center py-12">
              <Ionicons name="airplane-outline" size={48} color="#94A3B8" />
              <ThemedText className="text-slate-500 mt-2">No hay aeronaves registradas en el sistema.</ThemedText>
            </View>
          ) : (
            <FlatList
              data={aircrafts}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const effective = getEffectiveRate(item);
                return (
                  <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1">
                        <ThemedText className="font-bold text-lg text-brand-blue">
                          {item.basic_specs.model}
                        </ThemedText>
                        <ThemedText type="caption" className="text-slate-400 mt-0.5">
                          Matrícula: {item.basic_specs.registration} • ICAO: {item.basic_specs.type}
                        </ThemedText>
                      </View>
                      <TouchableOpacity
                        onPress={() => openOverrideModal(item)}
                        className="bg-brand-blue/5 border border-brand-blue/10 px-3 py-1.5 rounded-lg flex-row items-center"
                      >
                        <Ionicons name="create-outline" size={14} color="#0f1e3d" style={{ marginRight: 4 }} />
                        <ThemedText className="text-brand-blue text-xs font-bold">Editar Tarifa</ThemedText>
                      </TouchableOpacity>
                    </View>

                    <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center mt-2">
                      <View>
                        <ThemedText type="caption" className="text-slate-400 text-xs">
                          Costo por Milla:
                        </ThemedText>
                        <ThemedText className="font-bold text-slate-800 text-base mt-0.5">
                          {effective.rate !== null ? `$${effective.rate} USD` : "Sin configurar"}
                        </ThemedText>
                      </View>
                      <View className={`px-2.5 py-1 rounded-full border ${
                        effective.type === "Personalizada"
                          ? "bg-amber-50 border-amber-200"
                          : effective.type === "Por Modelo"
                          ? "bg-blue-50 border-blue-200"
                          : "bg-slate-100 border-slate-200"
                      }`}>
                        <ThemedText className={`text-[10px] font-bold uppercase ${
                          effective.type === "Personalizada"
                            ? "text-amber-700"
                            : effective.type === "Por Modelo"
                            ? "text-blue-700"
                            : "text-slate-500"
                        }`}>
                          {effective.type}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        <View className="flex-1 px-4 pt-4">
          <View className="flex-row justify-between items-center mb-4">
            <ThemedText type="caption" className="text-slate-500 flex-1 mr-4">
              Configura tarifas base por designador ICAO. Si un avión no tiene tarifa personalizada, se aplicará esta.
            </ThemedText>
            <TouchableOpacity
              onPress={() => openModelModal(null)}
              className="bg-brand-blue px-3 py-2 rounded-xl flex-row items-center"
            >
              <Ionicons name="add" size={18} color="white" style={{ marginRight: 2 }} />
              <ThemedText className="text-white text-xs font-bold">Nueva</ThemedText>
            </TouchableOpacity>
          </View>

          {isLoadingModels ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0f1e3d" />
            </View>
          ) : modelPricing.length === 0 ? (
            <View className="flex-1 justify-center items-center py-12">
              <Ionicons name="pricetag-outline" size={48} color="#94A3B8" />
              <ThemedText className="text-slate-500 mt-2">No hay tarifas base por modelo configuradas.</ThemedText>
            </View>
          ) : (
            <FlatList
              data={modelPricing}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm flex-row justify-between items-center">
                  <View>
                    <ThemedText className="font-bold text-lg text-brand-blue">
                      Modelo: {item.model}
                    </ThemedText>
                    <ThemedText type="caption" className="text-brand-gold font-bold mt-0.5">
                      ${item.defaultPricePerMile} USD / milla
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    onPress={() => openModelModal(item)}
                    className="p-2 bg-slate-50 border border-slate-100 rounded-lg"
                  >
                    <Ionicons name="create-outline" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Modal para Override de Aeronave */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={overrideModalVisible}
        onRequestClose={() => setOverrideModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-brand-white w-full rounded-2xl p-6 shadow-xl">
            <View className="flex-row justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <View>
                <ThemedText type="subtitle" className="text-brand-blue font-bold">
                  Sobrescribir Tarifa
                </ThemedText>
                <ThemedText type="caption" className="text-slate-500">
                  {selectedAircraft?.basic_specs.model} ({selectedAircraft?.basic_specs.registration})
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => setOverrideModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <ThemedText className="font-semibold text-brand-blue mb-1.5 text-sm">
                Precio por Milla Negociado (USD)
              </ThemedText>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-base"
                placeholder="Ej. 12.5"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={overridePriceInput}
                onChangeText={setOverridePriceInput}
              />
              <ThemedText type="caption" className="text-slate-400 mt-1.5 text-[11px]">
                Deja vacío este campo si deseas heredar la tarifa general por modelo de aeronave.
              </ThemedText>
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setOverrideModalVisible(false)}
                className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center"
              >
                <ThemedText className="text-slate-700 font-bold">Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveOverride}
                disabled={isSavingOverride}
                className="flex-1 bg-brand-blue py-3.5 rounded-xl items-center"
              >
                {isSavingOverride ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText className="text-white font-bold">Guardar</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Tarifas por Modelo */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modelModalVisible}
        onRequestClose={() => setModelModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-brand-white w-full rounded-2xl p-6 shadow-xl">
            <View className="flex-row justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <View>
                <ThemedText type="subtitle" className="text-brand-blue font-bold">
                  {selectedModel ? "Editar Tarifa Base" : "Nueva Tarifa Base"}
                </ThemedText>
                <ThemedText type="caption" className="text-slate-500">
                  Establece el precio por defecto según tipo ICAO
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => setModelModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="space-y-4 mb-4">
              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1.5 text-sm">
                  Código de Modelo (ICAO)
                </ThemedText>
                <TextInput
                  className={`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-base ${
                    selectedModel ? "text-slate-400 opacity-80" : ""
                  }`}
                  placeholder="Ej. C172"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  editable={!selectedModel}
                  value={modelInput}
                  onChangeText={setModelInput}
                />
              </View>

              <View>
                <ThemedText className="font-semibold text-brand-blue mb-1.5 text-sm">
                  Tarifa por Milla Base (USD)
                </ThemedText>
                <TextInput
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium text-base"
                  placeholder="Ej. 8.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={modelPriceInput}
                  onChangeText={setModelPriceInput}
                />
              </View>
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setModelModalVisible(false)}
                className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center"
              >
                <ThemedText className="text-slate-700 font-bold">Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveModelPricing}
                disabled={isSavingModel}
                className="flex-1 bg-brand-blue py-3.5 rounded-xl items-center"
              >
                {isSavingModel ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText className="text-white font-bold">Guardar</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
