import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAvailableAircrafts } from "@/hooks/useAvailableAircrafts";
import { FlightSearchForm } from "@/types/client";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

export default function SearchResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ searchData?: string }>();

  const activeSearch = useMemo<FlightSearchForm | null>(() => {
    if (!params.searchData) return null;
    try {
      const parsed = JSON.parse(params.searchData);
      if (!parsed || typeof parsed !== "object" || !parsed.trip || !parsed.schedule) {
        return null;
      }
      return {
        ...parsed,
        schedule: {
          ...parsed.schedule,
          outbound_flight_datetime_utc: parsed.schedule?.outbound_flight_datetime_utc
            ? new Date(parsed.schedule.outbound_flight_datetime_utc)
            : null,
          return_flight_datetime_utc: parsed.schedule?.return_flight_datetime_utc
            ? new Date(parsed.schedule.return_flight_datetime_utc)
            : null,
        },
      };
    } catch (error) {
      console.error("Error al deserializar parámetros de búsqueda:", error);
      return null;
    }
  }, [params.searchData]);

  const {
    data: searchResults = [],
    isLoading: isSearching,
    isFetched: isSearchFetched,
  } = useAvailableAircrafts(activeSearch);

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2">
      {/* Header with Back Button */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#0f1e3d" />
        </TouchableOpacity>
        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
          Resultados de Búsqueda
        </ThemedText>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Search Parameters Summary Card */}
        {activeSearch && (
          <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 pr-2">
                {/* Origin Airport */}
                <View className="flex-row items-center gap-2 mb-4">
                  <MaterialCommunityIcons name="airplane-takeoff" size={16} color="#0f1e3d" />
                  <ThemedText className="font-bold text-brand-blue text-sm flex-1" numberOfLines={1}>
                    {activeSearch.trip.origin_airport?.name || activeSearch.trip.origin_airport_ident}
                  </ThemedText>
                </View>

                {/* Destination Airport */}
                <View className="flex-row items-center gap-2 mb-2">
                  <MaterialCommunityIcons name="airplane-landing" size={16} color="#0f1e3d" />
                  <ThemedText className="font-bold text-brand-blue text-sm flex-1" numberOfLines={1}>
                    {activeSearch.trip.destination_airport?.name || activeSearch.trip.destination_airport_ident}
                  </ThemedText>
                </View>
              </View>

            </View>
            <View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
              <View className="flex-row items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                <MaterialCommunityIcons name="seat-passenger" size={14} color="#0f1e3d" />
                <ThemedText className="text-sm font-bold text-slate-700">
                  {activeSearch.capacity.passangers}
                </ThemedText>
              </View>
              <ThemedText className="text-xs text-slate-500 font-medium">
                Ida: {activeSearch.schedule.outbound_flight_datetime_utc ? new Date(activeSearch.schedule.outbound_flight_datetime_utc).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) + ' hs' : "N/A"}
              </ThemedText>
              {activeSearch.schedule.roundtrip && (
                <ThemedText className="text-xs text-slate-500 font-medium">
                  Vuelta: {activeSearch.schedule.return_flight_datetime_utc ? new Date(activeSearch.schedule.return_flight_datetime_utc).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) + ' hs' : "N/A"}
                </ThemedText>
              )}
            </View>
          </View>
        )}

        {/* Search Loading Indicator */}
        {isSearching && (
          <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-100 items-center justify-center mb-6 my-4">
            <ActivityIndicator size="large" color="#0f1e3d" />
            <ThemedText className="text-slate-600 font-medium mt-3 text-center">
              Buscando aeronaves disponibles y verificando itinerarios...
            </ThemedText>
          </View>
        )}

        {/* Search Results List */}
        {!isSearching && isSearchFetched && (
          <View className="mb-10">
            <View className="flex-row items-center justify-end mb-6 px-1">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(client)",
                    params: { reset: "true" },
                  })
                }
                className="bg-brand-gold px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm"
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <ThemedText className="text-sm font-bold text-white">Nueva Búsqueda</ThemedText>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-between mb-3 px-1">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                Aeronaves Disponibles ({searchResults.length})
              </ThemedText>
            </View>

            {searchResults.length === 0 ? (
              <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-200 items-center justify-center">
                <Ionicons name="airplane-outline" size={40} color="#94a3b8" />
                <ThemedText type="subtitle" className="mt-3 text-center text-slate-700">
                  No hay aeronaves disponibles
                </ThemedText>
                <ThemedText className="text-slate-500 text-xs text-center mt-1 mb-4">
                  No encontramos aeronaves en el aeropuerto de origen con la capacidad y disponibilidad requerida para estas fechas.
                </ThemedText>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(client)",
                      params: { reset: "true" },
                    })
                  }
                  className="bg-brand-gold px-4 py-2.5 rounded-xl flex-row items-center gap-2 shadow-sm"
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <ThemedText className="text-xs font-bold text-white">Nueva Búsqueda</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-4">
                {searchResults.map(({ aircraft, flightDurationHours, distanceNm }) => (
                  <View
                    key={aircraft.id}
                    className="bg-brand-white rounded-2xl p-5 border border-slate-200 shadow-sm"
                  >
                    {/* Card Top Header */}
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1 pr-2">
                        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                          {aircraft.basic_specs.model}
                        </ThemedText>
                        <ThemedText className="text-xs text-slate-500 font-medium mt-0.5">
                          Matrícula: {aircraft.basic_specs.registration}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Specs Summary Grid */}
                    <View className="bg-slate-50 rounded-xl p-3 flex-row flex-wrap justify-between gap-y-2 mb-4 border border-slate-100">
                      <View className="w-[48%]">
                        <ThemedText className="text-[11px] text-slate-500">Capacidad</ThemedText>
                        <ThemedText className="font-bold text-slate-800 text-sm">
                          {aircraft.basic_specs.pax_count} personas
                        </ThemedText>
                      </View>

                      <View className="w-[48%]">
                        <ThemedText className="text-[11px] text-slate-500">Tiempo de Vuelo</ThemedText>
                        <ThemedText className="font-bold text-brand-gold text-sm">
                          {flightDurationHours < 1
                            ? `${Math.round(flightDurationHours * 60)} minutos`
                            : `${flightDurationHours.toFixed(1)} horas`}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Detail Screen Button */}
                    <TouchableOpacity
                      onPress={() => {
                        router.push({
                          pathname: "/(client)/aircraft-details",
                          params: {
                            aircraftJson: JSON.stringify(aircraft),
                            searchData: params.searchData,
                            flightDurationHours: JSON.stringify(flightDurationHours),
                            distanceNm: JSON.stringify(distanceNm),
                          },
                        });
                      }}
                      className="bg-brand-blue py-3 rounded-xl items-center justify-center flex-row gap-2 shadow-sm"
                      activeOpacity={0.8}
                    >
                      <ThemedText className="text-white font-bold text-sm">Ver Información y Reservar</ThemedText>
                      <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
