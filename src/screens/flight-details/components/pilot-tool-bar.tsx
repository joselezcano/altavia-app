import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    TouchableOpacity,
    View
} from "react-native";

export function PilotToolBar({
    handleCreateFlightPlan,
    aircraftId,
    fa_flight_id,
}: {
    handleCreateFlightPlan: () => void;
    aircraftId?: string;
    fa_flight_id: string | null;
}) {
    const router = useRouter()

    return (
        <View className="flex-row items-center gap-2 mb-4">
            {/* Plan de Vuelo Button */}
            <TouchableOpacity
                onPress={handleCreateFlightPlan}
                className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    Plan de Vuelo
                </ThemedText>
            </TouchableOpacity>

            {/* Aeronave Button */}
            <TouchableOpacity
                onPress={() => {
                    router.push({
                        pathname: "./aircraft-specs",
                        params: { id: aircraftId },
                    });
                }}
                className="bg-brand-blue py-3 px-4 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <Ionicons name="airplane-outline" size={18} color="#FFFFFF" />
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    Aeronave
                </ThemedText>
            </TouchableOpacity>

            {/* Clima Button (No Action) */}
            <TouchableOpacity
                onPress={() => { }}
                className="bg-brand-blue py-3 px-5 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <Ionicons name="partly-sunny-outline" size={18} color="#FFFFFF" />
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    Clima
                </ThemedText>
            </TouchableOpacity>

            {/* Tracking Button */}
            <TouchableOpacity
                onPress={() =>
                    router.push({
                        pathname: "/flights/flight-tracker",
                        params: { fa_flight_id: fa_flight_id ?? "" },
                    })
                }
                className="bg-brand-blue py-3 px-4 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <Ionicons name="location-outline" size={18} color="#FFFFFF" />
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    Tracking
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}