import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";

export function AircraftDetailsHeader({ header }: { header: string }) {
    const router = useRouter();

    return (
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
                {header}
            </ThemedText>
            <View style={{ width: 60 }} />
        </View>
    );
}