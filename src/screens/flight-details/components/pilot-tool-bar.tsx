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
    hasFlightPlan = false,
    onOpenManifest,
    passengerCount = 0,
}: {
    handleCreateFlightPlan: () => void;
    aircraftId?: string;
    fa_flight_id: string | null;
    hasFlightPlan?: boolean;
    onOpenManifest?: () => void;
    passengerCount?: number;
}) {
    const router = useRouter();

    return (
        <View className="flex-row items-center gap-2 mb-4">
            {/* Plan de Vuelo Button */}
            <TouchableOpacity
                onPress={handleCreateFlightPlan}
                className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <View className="flex-row items-center">
                    <Ionicons name="document-text-outline" size={17} color="#FFFFFF" />
                    {hasFlightPlan && (
                        <View className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
                    )}
                </View>
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    {hasFlightPlan ? "Ver FPL DINAC" : "Crear FPL DINAC"}
                </ThemedText>
            </TouchableOpacity>

            {/* Manifiesto Pasajeros Button */}
            {onOpenManifest && (
                <TouchableOpacity
                    onPress={onOpenManifest}
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="people-outline" size={17} color="#FFFFFF" />
                    <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                        Pasajeros {passengerCount > 0 ? `(${passengerCount})` : ""}
                    </ThemedText>
                </TouchableOpacity>
            )}

            {/* Aeronave Button */}
            <TouchableOpacity
                onPress={() => {
                    router.push({
                        pathname: "./aircraft-specs",
                        params: { id: aircraftId },
                    });
                }}
                className="bg-brand-blue py-3 px-3 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <Ionicons name="airplane-outline" size={17} color="#FFFFFF" />
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    Aeronave
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
                className="bg-brand-blue py-3 px-3 rounded-xl items-center justify-center gap-1 shadow-sm"
                activeOpacity={0.8}
            >
                <Ionicons name="location-outline" size={17} color="#FFFFFF" />
                <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    Tracking
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}