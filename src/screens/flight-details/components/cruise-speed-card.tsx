import { ThemedText } from "@/components/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    View
} from "react-native";


export function CruiseSpeedCard({
    cruiseSpeedAircraft,
    cruiseSpeedOutbound,
    cruiseSpeedReturn,
}: {
    cruiseSpeedAircraft: number | undefined;
    cruiseSpeedOutbound: number | undefined;
    cruiseSpeedReturn: number | undefined;
}) {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm gap-3">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                Velocidad
            </ThemedText>

            {/* Velocidad de crucero del avión */}
            <View className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                        <MaterialCommunityIcons name="speedometer" size={18} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                        Velocidad de crucero del avión
                    </ThemedText>
                </View>
                <ThemedText className="text-xs font-bold text-slate-900">
                    {cruiseSpeedAircraft ? `${cruiseSpeedAircraft} nudos` : ""}
                </ThemedText>
            </View>

            {/* Velocidad de vuelo */}
            <View className="bg-slate-50 p-4 rounded-2xl">
                <View>
                    <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                        Velocidad de vuelo
                    </ThemedText>
                    <View className="gap-1 pl-2 border-l-2 border-brand-gold/40">
                        <View className="flex-row items-center justify-between">
                            <ThemedText className="text-xs text-slate-500 font-medium">Ida:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                                {cruiseSpeedOutbound ? `${cruiseSpeedOutbound} nudos` : ""}
                            </ThemedText>
                        </View>
                        <View className="flex-row items-center justify-between mt-0.5">
                            <ThemedText className="text-xs text-slate-500 font-medium">Vuelta:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                                {cruiseSpeedReturn ? `${cruiseSpeedReturn} nudos` : ""}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}