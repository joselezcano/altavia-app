import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";

interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
}

export default function ListAircraftsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [aircrafts, setAircrafts] = useState<AircraftSpecsDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for the user's aircraft specifications
    const q = query(
      collection(db, "AircraftSpecs"),
      where("ownerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const specsList: AircraftSpecsDoc[] = [];
        snapshot.forEach((doc) => {
          specsList.push({
            id: doc.id,
            ...(doc.data() as AircraftSpecs),
          });
        });
        setAircrafts(specsList);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching aircrafts:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleAddAircraft = () => {
    router.push("/aircrafts/add-aircraft");
  };

  const renderAircraftItem = ({ item }: { item: AircraftSpecsDoc }) => {
    const { model, type, registration, pax_count } = item.basic_specs;

    return (
      <View className="bg-brand-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <ThemedText className="font-bold text-lg text-brand-blue">
              {model}
            </ThemedText>
          </View>
          <View className="bg-brand-gold/15 px-3 py-1 rounded-full border border-brand-gold/20">
            <ThemedText className="text-brand-gold text-xs font-bold uppercase tracking-wider">
              {registration}
            </ThemedText>
          </View>
        </View>

        <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center">
          <View className="flex-row items-center gap-1">
            <Ionicons name="people" size={16} color="#64748B" />
            <ThemedText type="caption" className="text-xs text-slate-500 font-medium">
              Capacidad:
            </ThemedText>
            <ThemedText className="text-xs font-bold text-slate-700">
              {pax_count} {pax_count === 1 ? "Persona" : "Personas"} (POB)
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: "/aircrafts/aircraft-details",
                params: { id: item.id },
              });
            }}
            className="flex-row items-center gap-0.5"
          >
            <ThemedText type="accent" className="text-xs font-semibold text-brand-gold">
              Detalles
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color="#b89c50" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6 mt-2">
        <View>
          <ThemedText
            type="caption"
            className="uppercase font-bold text-brand-gold tracking-widest text-xs"
          >
            Aeronaves Registradas
          </ThemedText>
          <ThemedText type="title" className="text-2xl font-bold mt-0.5 text-brand-blue">
            Mis Aviones
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={handleAddAircraft}
          className="bg-brand-blue w-10 h-10 rounded-full items-center justify-center shadow-sm"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main content */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0f1e3d" />
          <ThemedText className="text-slate-500 mt-2">Cargando flota...</ThemedText>
        </View>
      ) : aircrafts.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-20 h-20 bg-slate-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="airplane" size={40} color="#94A3B8" />
          </View>
          <ThemedText type="subtitle" className="text-center mb-2 text-slate-700">
            No tienes aeronaves registradas
          </ThemedText>
          <ThemedText type="caption" className="text-center text-slate-500 mb-6">
            Registra los datos técnicos, de performance y seguridad de tus aviones para poder generar planes de vuelo.
          </ThemedText>
          <TouchableOpacity
            onPress={handleAddAircraft}
            className="bg-brand-blue px-6 py-3 rounded-xl flex-row items-center gap-2 shadow-sm"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <ThemedText className="text-white font-semibold">
              Agregar Primera Aeronave
            </ThemedText>
          </TouchableOpacity>
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
    </ThemedView>
  );
}
