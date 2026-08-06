import { ThemedText } from "@/components/themed-text";
import { ClientReservationItem } from "@/types/all-roles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    TouchableOpacity,
    View
} from "react-native";

export function OwnerToolBar({
    reservation,
    outboundFlightPlanId,
    returnFlightPlanId,
    aircraftModel,
}: {
    reservation: ClientReservationItem;
    outboundFlightPlanId?: string;
    returnFlightPlanId?: string;
    aircraftModel?: string;
}) {
    const router = useRouter()

    return (
        <View className="flex-col gap-2">
            <View className="flex-row items-center gap-4 mb-2">
                {/* Tripulación Button */}
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "./assign-pilots",
                            params: {
                                reservationId: reservation.id,
                            },
                        })
                    }
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="account-tie-hat" size={20} color="#FFFFFF" />
                    <ThemedText className="text-sm font-bold text-white text-center" numberOfLines={1}>
                        Tripulación{reservation.pilot_ids && reservation.pilot_ids.length > 0 ? ` (${reservation.pilot_ids.length})` : ""}
                    </ThemedText>
                </TouchableOpacity>

                {/* Tracking de Vuelo Button */}
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "./flight-tracker",
                            params: { fa_flight_id: reservation.fa_flight_id ?? "" },
                        })
                    }
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                    <ThemedText className="text-sm font-bold text-white text-center" numberOfLines={1}>
                        Tracking
                    </ThemedText>
                </TouchableOpacity>
            </View>
            <View className="flex-row items-center gap-4 mb-2">
                {/* Plan de Vuelo (Ida) Button */}
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "./view-flight-plan",
                            params: {
                                flightPlanId: outboundFlightPlanId,
                                aircraftModel: aircraftModel,
                            },
                        })
                    }
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                    <ThemedText className="text-sm font-bold text-white text-center" numberOfLines={1}>
                        Plan de Vuelo (Ida)
                    </ThemedText>
                </TouchableOpacity>

                {/* Plan de Vuelo (Vuelta) Button */}
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "./view-flight-plan",
                            params: {
                                flightPlanId: returnFlightPlanId,
                                aircraftModel: aircraftModel,
                            },
                        })
                    }
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                    <ThemedText className="text-sm font-bold text-white text-center" numberOfLines={1}>
                        Plan de Vuelo (Vuelta)
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
}