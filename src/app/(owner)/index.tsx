import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerAircrafts } from "@/hooks/useOwnerAircrafts";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OwnerFlightsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Filter states
  const [selectedAircraftId, setSelectedAircraftId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Fetch Owner's aircrafts
  const { data: aircrafts = [], isLoading: isLoadingAircrafts } = useOwnerAircrafts(user?.uid);

  // Fetch all reservations
  const { data: allReservations = [], isLoading: isLoadingReservations } = useOwnerReservations();

  const isLoading = isLoadingAircrafts || isLoadingReservations;

  // Filter reservations locally for this owner's fleet
  const ownerAircraftIds = aircrafts.map(ac => ac.id);
  const ownerFlights = allReservations.filter(res => ownerAircraftIds.includes(res.aircraftId));

  // Filter flights by selected filters
  const filteredFlights = ownerFlights.filter(flight => {
    const matchesAircraft = selectedAircraftId === "all" || flight.aircraftId === selectedAircraftId;
    const matchesStatus = selectedStatus === "all" || flight.internal_status === selectedStatus;
    return matchesAircraft && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return {
          label: "Aprobado",
          bg: "bg-emerald-50 border-emerald-100 text-emerald-700",
          dot: "bg-emerald-500",
        };
      case "completed":
        return {
          label: "Completado",
          bg: "bg-slate-50 border-slate-200 text-slate-700",
          dot: "bg-slate-500",
        };
      case "cancelled":
        return {
          label: "Cancelado",
          bg: "bg-red-50 border-red-100 text-red-700",
          dot: "bg-red-500",
        };
      default:
        return {
          label: "Pendiente",
          bg: "bg-amber-50 border-amber-100 text-amber-700",
          dot: "bg-amber-500",
        };
    }
  };

  const formatFlightDate = (date: Date) => {
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderFlightItem = ({ item }: { item: any }) => {
    const aircraft = aircrafts.find(ac => ac.id === item.aircraftId);
    const statusStyle = getStatusBadge(item.internal_status);

    return (
      <View className="bg-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <ThemedText className="font-bold text-lg text-brand-blue">
              {item.trip?.origin_airport?.icao_code || "SGAS"} ➔ {item.trip?.destination_airport?.icao_code || "SUMU"}
            </ThemedText>
            <ThemedText className="text-xs text-slate-500 mt-1">
              Aeronave: {aircraft?.basic_specs?.model || "Cessna Caravan"} ({aircraft?.basic_specs?.registration || "ZP-XXX"})
            </ThemedText>
          </View>
          <View className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border ${statusStyle.bg}`}>
            <View className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
            <ThemedText className="text-[10px] font-bold uppercase tracking-wider">
              {statusStyle.label}
            </ThemedText>
          </View>
        </View>

        <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center">
          <View>
            <ThemedText type="caption" className="text-[10px] uppercase font-semibold">
              Salida Programada
            </ThemedText>
            <ThemedText className="text-xs font-bold text-slate-700 mt-0.5">
              {formatFlightDate(item.outboundTime)}
            </ThemedText>
          </View>
          <View className="items-end">
            <ThemedText type="caption" className="text-[10px] uppercase font-semibold">
              Distancia / Tarifa
            </ThemedText>
            <ThemedText className="text-xs font-bold text-brand-blue mt-0.5">
              {item.distance_nm} NM • {item.price ? `USD ${item.price.toLocaleString()}` : "Cotizando"}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2" style={{ paddingTop: insets.top }}>
      {/* Custom Title Header with Menu Trigger */}
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
            Operaciones de Vuelo
          </ThemedText>
          <ThemedText type="title" className="text-2xl font-bold mt-0.5 text-brand-blue">
            Mis Vuelos
          </ThemedText>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0f1e3d" />
          <ThemedText className="text-slate-500 mt-2">Cargando vuelos...</ThemedText>
        </View>
      ) : (
        <View className="flex-1">
          {/* Filters Section */}
          <View className="mb-4 gap-3">
            {/* Aircraft Filter */}
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                <TouchableOpacity
                  onPress={() => setSelectedAircraftId("all")}
                  className={`px-4 py-2 rounded-full mr-2 border ${selectedAircraftId === "all"
                    ? "bg-brand-blue border-brand-blue"
                    : "bg-white border-slate-200"
                    }`}
                >
                  <ThemedText
                    className={`text-xs font-semibold ${selectedAircraftId === "all" ? "text-white" : "text-slate-600"
                      }`}
                  >
                    Todas las Aeronaves
                  </ThemedText>
                </TouchableOpacity>

                {aircrafts.map(ac => (
                  <TouchableOpacity
                    key={ac.id}
                    onPress={() => setSelectedAircraftId(ac.id)}
                    className={`px-4 py-2 rounded-full mr-2 border ${selectedAircraftId === ac.id
                      ? "bg-brand-blue border-brand-blue"
                      : "bg-white border-slate-200"
                      }`}
                  >
                    <ThemedText
                      className={`text-xs font-semibold ${selectedAircraftId === ac.id ? "text-white" : "text-slate-600"
                        }`}
                    >
                      {ac.basic_specs.registration} ({ac.basic_specs.type})
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Status Filter */}
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                {[
                  { id: "all", label: "Todos los Estados" },
                  { id: "pending", label: "Pendientes" },
                  { id: "approved", label: "Aprobados" },
                  { id: "completed", label: "Completados" },
                  { id: "cancelled", label: "Cancelados" },
                ].map(status => (
                  <TouchableOpacity
                    key={status.id}
                    onPress={() => setSelectedStatus(status.id)}
                    className={`px-4 py-2 rounded-full mr-2 border ${selectedStatus === status.id
                      ? "bg-brand-gold border-brand-gold"
                      : "bg-white border-slate-200"
                      }`}
                  >
                    <ThemedText
                      className={`text-xs font-semibold ${selectedStatus === status.id ? "text-white" : "text-slate-600"
                        }`}
                    >
                      {status.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Flights list */}
          <FlatList
            data={filteredFlights}
            renderItem={renderFlightItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
                <ThemedText className="text-slate-400 mt-4 text-center font-medium">
                  No hay operaciones de vuelos registradas{"\n"}que coincidan con los filtros.
                </ThemedText>
              </View>
            }
          />
        </View>
      )}
    </ThemedView>
  );
}