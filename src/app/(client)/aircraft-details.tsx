import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AircraftSpecsDoc } from "@/hooks/useAvailableAircrafts";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

export default function AircraftDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    aircraftJson?: string;
    searchData?: string;
    flightDurationHours?: string;
    distanceNm?: string;
    model?: string;
    registration?: string;
    pax_count?: string;
    type?: string;
    cruise_speed_knots?: string;
    service_ceiling_feet?: string;
    base_airport_name?: string;
    base_airport_ident?: string;
  }>();

  let aircraft: AircraftSpecsDoc | null = null;
  if (params.aircraftJson) {
    try {
      aircraft = JSON.parse(params.aircraftJson);
    } catch {
      aircraft = null;
    }
  }

  const model = aircraft?.basic_specs?.model || params.model || "Aeronave";
  const registration = aircraft?.basic_specs?.registration || params.registration || "N/A";
  const paxCount = aircraft?.basic_specs?.pax_count ?? (params.pax_count ? Number(params.pax_count) : "N/A");
  const type = aircraft?.basic_specs?.type || params.type || "N/A";
  const cruiseSpeed = aircraft?.operating_specs?.cruise_speed_knots ?? (params.cruise_speed_knots ? Number(params.cruise_speed_knots) : "N/A");
  const serviceCeiling = aircraft?.operating_specs?.service_ceiling_feet ?? (params.service_ceiling_feet ? Number(params.service_ceiling_feet) : "N/A");
  const flightDurationHours = params.flightDurationHours ? Number(params.flightDurationHours) : undefined;
  const distanceNm = params.distanceNm ? Number(params.distanceNm) : undefined;
  const distanceKm = distanceNm ? distanceNm * 1.852 : undefined;

  const handleReserve = () => {
    Toast.show({
      type: "success",
      text1: "Reserva Iniciada",
      text2: `Has seleccionado la aeronave ${model} (${registration})`,
    });
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2">
      {/* Header with Back Button */}
      <View className="flex-row items-center justify-between mb-6 mt-2">
        <TouchableOpacity
          onPress={() => {
            if (params.searchData) {
              router.push({
                pathname: "/(client)/search-results",
                params: {
                  searchData: params.searchData,
                },
              });
            } else {
              router.back();
            }
          }}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#0f1e3d" />
        </TouchableOpacity>
        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
          Datos de la Aeronave
        </ThemedText>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Card containing aircraft model and registration */}
        <View className="bg-brand-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 rounded-xl bg-brand-blue/10 items-center justify-center">
              <Ionicons name="airplane" size={24} color="#0f1e3d" />
            </View>
            <View className="flex-1">
              <ThemedText type="subtitle" className="text-brand-blue font-bold text-xl">
                {model}
              </ThemedText>
              <View className="bg-slate-100 self-start px-2.5 py-1 rounded-md mt-1 border border-slate-200">
                <ThemedText className="text-xs font-bold text-slate-700">
                  Matrícula: {registration}
                </ThemedText>
              </View>
            </View>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          {/* Specs breakdown grid */}
          <View className="gap-3">
            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Capacidad de Pasajeros:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{paxCount}</ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Tiempo de vuelo:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">
                {flightDurationHours && flightDurationHours < 1
                  ? `${Math.round(flightDurationHours * 60)} minutos`
                  : `${flightDurationHours?.toFixed(1)} horas`}
              </ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Distancia:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{distanceKm?.toFixed(0)} km</ThemedText>
            </View>

            <View className="h-px bg-slate-100 my-4" />

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Tipo de Aeronave:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{type}</ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Velocidad de Crucero:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{cruiseSpeed} nudos</ThemedText>
            </View>

            <View className="flex-row justify-between items-center">
              <ThemedText className="text-slate-500 text-sm font-medium">Techo de Servicio:</ThemedText>
              <ThemedText className="font-bold text-brand-blue">{serviceCeiling} pies</ThemedText>
            </View>
          </View>
        </View>

        {/* Reserve Button below the card */}
        <TouchableOpacity
          onPress={handleReserve}
          className="bg-brand-gold py-4 rounded-xl items-center justify-center shadow-md flex-row gap-2 mb-10"
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
          <ThemedText className="text-white font-bold text-base">Reservar</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}
