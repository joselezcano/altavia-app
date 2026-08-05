import { PilotHeader } from "@/components/pilot-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { useManagedAircrafts } from "@/hooks/useManagedAircrafts";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
}


export default function ManagerAircraftsScreen() {
  const { profileData } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // TanStack Queries (fetching aircrafts and owner pilots)
  const isEncargado = profileData?.isEncargado === true;
  const managedAircraftsList = profileData?.managed_aircrafts || [];

  const { data: aircrafts = [], isLoading } = useManagedAircrafts(
    isEncargado ? managedAircraftsList : []
  );

  const renderAircraftItem = ({ item }: { item: AircraftSpecsDoc }) => {
    const { model, registration, pax_count } = item.basic_specs;

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
                pathname: "/aircrafts/details",
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
    <ThemedView className="flex-1 px-4" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <PilotHeader
        title="Gestión de Flota"
        subtitle="Aviones a mi Cargo"
      />

      {/* Main content */}
      {isLoading ? (
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
            El propietario aún no ha puesto aeronaves a tu cargo.
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
    </ThemedView>
  );
}
