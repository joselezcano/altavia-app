import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { AircraftDetailsTitleCard } from "@/screens/aircraft-details/components/aircraft-details-title-card";
import { AircraftToolBar } from "@/screens/aircraft-details/components/tool-bar";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ActivityIndicator,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import { AircraftDetailsHeader } from "./components/header";


export default function AircraftDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: aircraft, isLoading, error } = useAircraftDetails(id);

    if (isLoading) {
        return (
            <ThemedView className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#030436" />
                <ThemedText className="text-slate-500 mt-2">
                    Cargando especificaciones...
                </ThemedText>
            </ThemedView>
        );
    }

    if (error || !aircraft) {
        return (
            <ThemedView className="flex-1 px-4 justify-center items-center">
                <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
                    <Ionicons name="alert-circle" size={36} color="#EF4444" />
                </View>
                <ThemedText type="subtitle" className="text-center text-slate-800 mb-2">
                    Ocurrió un error
                </ThemedText>
                <ThemedText type="caption" className="text-center text-slate-500 mb-6">
                    {error ? error.message : "No se pudieron obtener los detalles de la aeronave."}
                </ThemedText>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-brand-blue px-6 py-2.5 rounded-xl flex-row items-center" style={{ gap: 8 }}
                >
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    <ThemedText className="text-white font-semibold">Regresar</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const { basic_specs } = aircraft;

    return (
        <ThemedView className="flex-1 px-4 pt-2">
            {/* Header */}
            <AircraftDetailsHeader header="Aeronave" subtitle={`${basic_specs.registration} · ${basic_specs.model}`} />

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Title Section Card */}
                <AircraftDetailsTitleCard basic_specs={basic_specs} />

                {/* Tool Bar */}
                <AircraftToolBar
                    id={id}
                    basic_specs={basic_specs}
                />
            </ScrollView>
        </ThemedView>
    );
}
