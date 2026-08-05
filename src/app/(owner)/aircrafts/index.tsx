import { OwnerHeader } from "@/components/owner-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
}

export default function ListAircraftsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
    const coverPhoto = item.profile_photo || (item.photos && item.photos.length > 0 ? item.photos[0] : null);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          router.push({
            pathname: "/aircrafts/details",
            params: { id: item.id },
          });
        }}
        className="bg-brand-white border border-slate-100 rounded-3xl mb-5 overflow-hidden shadow-sm"
      >
        {/* Cover Photo / Header Banner */}
        <View className="h-44 w-full bg-slate-900 relative justify-center items-center overflow-hidden">
          {coverPhoto ? (
            <Image
              source={{ uri: coverPhoto }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-brand-blue/95 justify-center items-center relative">
              <View className="w-20 h-20 rounded-full bg-white/10 items-center justify-center">
                <Ionicons name="airplane" size={40} color="#DAA520" />
              </View>
            </View>
          )}

          {/* Registration Badge Pill */}
          <View className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-full">
            <ThemedText className="text-white text-xs font-bold tracking-wide uppercase">
              {registration}
            </ThemedText>
          </View>

          {/* Type Badge Pill */}
          {type && (
            <View className="absolute top-3 left-3 bg-black/60 px-3 py-1 rounded-full">
              <ThemedText className="text-white text-xs font-bold tracking-wide uppercase">
                {type}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Card Body & Details */}
        <View className="p-5">
          <View className="flex-row justify-between items-center mb-3">
            <ThemedText className="font-extrabold text-xl text-brand-blue flex-1 mr-2" numberOfLines={1}>
              {model}
            </ThemedText>
          </View>

          {/* Key Specs Pills */}
          <View className="flex-row flex-wrap items-center gap-2 mb-4">
            <View className="flex-row items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <Ionicons name="people" size={14} color="#64748B" />
              <ThemedText className="text-xs font-semibold text-slate-700">
                {pax_count} {pax_count === 1 ? "Persona" : "Personas"} (POB)
              </ThemedText>
            </View>

            {item.base_airport && (
              <View className="flex-row items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                <Ionicons name="location" size={14} color="#0f1e3d" />
                <ThemedText className="text-xs font-semibold text-slate-700">
                  {item.base_airport.icao_code || item.base_airport.iata_code || item.base_airport.name}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Card Footer Action */}
          <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center">
            <View className="flex-row items-center gap-1">
              <Ionicons name="images-outline" size={15} color="#94A3B8" />
              <ThemedText className="text-xs text-slate-400 font-medium">
                {item.photos?.length || 0} {item.photos?.length === 1 ? "foto" : "fotos"}
              </ThemedText>
            </View>

            <View className="flex-row items-center gap-1 bg-brand-gold/10 px-3 py-2 rounded-xl">
              <ThemedText className="text-xs font-bold text-brand-gold">
                Ver Detalles
              </ThemedText>
              <Ionicons name="chevron-forward" size={14} color="#b89c50" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView className="flex-1 px-4" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <OwnerHeader
        title="Aeronaves Registradas"
        subtitle="Mis Aviones"
        onMenuPress={() => navigation.openDrawer()}
        onActionButtonPress={handleAddAircraft}
        iconName="add"
      />

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
