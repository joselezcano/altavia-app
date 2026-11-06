import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { USER_ROLE, useAuth } from "@/hooks/useAuth";
import { AircraftDetailsHeader } from "@/screens/aircraft-details/components/header";
import { AircraftDetailsTitleCard } from "@/screens/aircraft-details/components/title-card";
import { BasicSpecsCard } from "@/screens/aircraft-specs/components/basic-specs";
import { NotesCard } from "@/screens/aircraft-specs/components/notes-card";
import { OperatingPerformanceCard } from "@/screens/aircraft-specs/components/operating-performance-card";
import { SecurityEmergencyCard } from "@/screens/aircraft-specs/components/security-emergency-card";
import { TechnicalSpecsCard } from "@/screens/aircraft-specs/components/technical-specs-card";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";


export default function AircraftSpecsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: aircraft, isLoading, error } = useAircraftDetails(id);
    const { user, role, profileData } = useAuth();

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

    // Mismo criterio que firestore.rules: admin, dueño o encargada que la gestiona.
    const canEdit =
        role === USER_ROLE.ADMIN ||
        (role === USER_ROLE.OWNER && !!user?.uid && aircraft.ownerId === user.uid) ||
        (role === USER_ROLE.PILOT &&
            profileData?.isEncargado === true &&
            Array.isArray(profileData?.managed_aircrafts) &&
            profileData.managed_aircrafts.includes(id));

    return (
        <ThemedView className="flex-1 px-4 pt-2">
            {/* Header */}
            <AircraftDetailsHeader header="Especificaciones" />

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Title Section Card */}
                <AircraftDetailsTitleCard
                    title="Especificaciones de la Aeronave"
                    model={basic_specs.model}
                    registration={basic_specs.registration}
                />

                {canEdit && (
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: "/aircrafts/details/edit-specs", params: { id } })}
                        style={editStyles.button}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                        <Text style={editStyles.text}>Editar especificaciones</Text>
                    </TouchableOpacity>
                )}

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

const editStyles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#030436",
        borderRadius: 14,
        paddingVertical: 12,
        marginBottom: 16,
        gap: 8,
    },
    text: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
