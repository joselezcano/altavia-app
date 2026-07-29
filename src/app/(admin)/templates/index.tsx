import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftTemplates } from "@/hooks/useAircraftTemplates";
import { Ionicons } from "@expo/vector-icons";
import { deleteDoc, doc } from "firebase/firestore";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function AdminTemplatesScreen() {
  const router = useRouter();
  const { data: templates = [], isLoading, refetch } = useAircraftTemplates();

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Eliminar Plantilla",
      `¿Estás seguro de que deseas eliminar la plantilla "${name}"? Esta acción no se puede deshacer y afectará a los propietarios que intenten registrar este modelo en el futuro.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "aircraft-templates", id));
              Toast.show({
                type: "success",
                text1: "Plantilla eliminada",
                text2: `La plantilla ${name} ha sido borrada correctamente.`,
              });
              refetch();
            } catch (error: any) {
              console.error("Error al eliminar plantilla:", error);
              Alert.alert("Error", "No se pudo eliminar la plantilla.");
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView className="flex-1 bg-brand-light">
      <View className="px-4 pt-6 pb-2">
        <ThemedText className="font-bold text-brand-blue text-2xl mb-1">
          Plantillas de Aeronaves
        </ThemedText>
        <ThemedText className="text-slate-500 mb-4">
          Gestiona los modelos base disponibles para registro.
        </ThemedText>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0f1e3d" />
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="airplane-outline" size={64} color="#CBD5E1" />
              <ThemedText className="text-slate-400 mt-4 text-center font-medium">
                No hay plantillas registradas.{"\n"}Crea una nueva para comenzar.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-white p-4 rounded-2xl mb-4 border border-slate-100 shadow-sm flex-row justify-between items-center">
              <View className="flex-1">
                <ThemedText className="font-bold text-brand-blue text-lg">
                  {item.template_info.name}
                </ThemedText>
                <View className="flex-row items-center gap-2 mt-1">
                  <View className="bg-brand-blue/10 px-2 py-0.5 rounded">
                    <ThemedText className="text-brand-blue text-[10px] font-bold">
                      {item.template_info.type}
                    </ThemedText>
                  </View>
                  <ThemedText className="text-slate-500 text-xs">
                    Modelo: {item.template_info.model}
                  </ThemedText>
                </View>
                <ThemedText className="text-slate-400 text-xs mt-2">
                  Capacidad Base: {item.template_info.default_pax_count} POB
                </ThemedText>
              </View>
              
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.template_info.name)}
                  className="w-10 h-10 rounded-full bg-red-50 items-center justify-center border border-red-100"
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* FAB (Floating Action Button) */}
      <TouchableOpacity
        onPress={() => router.push("/(admin)/templates/add")}
        className="absolute bottom-8 right-6 w-14 h-14 bg-brand-gold rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </ThemedView>
  );
}
