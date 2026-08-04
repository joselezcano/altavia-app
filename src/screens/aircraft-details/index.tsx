import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { BasicSpecsCard } from "@/screens/aircraft-details/components/basic-specs";
import { NotesCard } from "@/screens/aircraft-details/components/notes-card";
import { OperatingPerformanceCard } from "@/screens/aircraft-details/components/operating-performance-card";
import { SecurityEmergencyCard } from "@/screens/aircraft-details/components/security-emergency-card";
import { TechnicalSpecsCard } from "@/screens/aircraft-details/components/technical-specs-card";
import { TitleCard } from "@/screens/aircraft-details/components/title-card";
import { ToolBar } from "@/screens/aircraft-details/components/tool-bar";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ActivityIndicator,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";


export default function AircraftDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: aircraft, isLoading, error } = useAircraftDetails(id);

    if (isLoading) {
        return (
            <ThemedView className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#0f1e3d" />
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
                    className="bg-brand-blue px-6 py-2.5 rounded-xl flex-row items-center gap-2"
                >
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    <ThemedText className="text-white font-semibold">Regresar</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const { basic_specs, technical_specs, operating_specs, emergency, notes } =
        aircraft;

    return (
        <ThemedView className="flex-1 px-4 pt-2">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 mt-2">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="flex-row items-center p-1"
                >
                    <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
                    <ThemedText className="font-semibold text-brand-blue ml-1">
                        Volver
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText className="font-bold text-brand-blue text-lg">
                    Detalle de Aeronave
                </ThemedText>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Title Section Card */}
                <TitleCard basic_specs={basic_specs} />

                {/* Tool Bar */}
                <ToolBar
                    id={id}
                    basic_specs={basic_specs}
                />

                {/* 1. Basic Specs Card */}
                <BasicSpecsCard
                    airport={aircraft.base_airport}
                    basic_specs={basic_specs}
                />

                {/* 2. Technical Specs Card */}
                <TechnicalSpecsCard technical_specs={technical_specs} />

                {/* 3. Operating/Performance Specs Card */}
                <OperatingPerformanceCard operating_specs={operating_specs} />

                {/* 4. Emergency Card */}
                <SecurityEmergencyCard emergency={emergency} />

                {/* 5. Notes/Observations Card */}
                <NotesCard notes={notes} />

            </ScrollView>
        </ThemedView>
    );
}
