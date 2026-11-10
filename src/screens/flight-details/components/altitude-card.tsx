import { ThemedText } from "@/components/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    View
} from "react-native";


export function AltitudeCard({
    serviceCeiling,
    altitudeOutbound,
    altitudeReturn,
}: {
    serviceCeiling: number | undefined;
    altitudeOutbound: number | undefined;
    altitudeReturn: number | undefined;
}) {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200" style={{ gap: 12 }}>
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                Altitud
            </ThemedText>

            {/* Techo de servicio */}
            <View className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                        <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#030436" />
                    </View>
                    <ThemedText className="text-xs font-medium text-slate-600">
                        Techo de servicio
                    </ThemedText>
                </View>
                <ThemedText className="text-xs font-bold text-slate-900">
                    {serviceCeiling ? `${serviceCeiling.toLocaleString("es-ES")} pies` : ""}
                </ThemedText>
            </View>

            {/* Altitud de vuelo */}
            <View className="bg-slate-50 p-4 rounded-2xl">
                <View>
                    <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                        Altitud de vuelo
                    </ThemedText>
                    <View className="pl-2 border-l-2 border-[rgba(1,101,255,0.4)]" style={{ gap: 4 }}>
                        <View className="flex-row items-center justify-between">
                            <ThemedText className="text-xs text-slate-500 font-medium">Ida:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                                {altitudeOutbound ? `${altitudeOutbound.toLocaleString("es-ES")} pies` : ""}
                            </ThemedText>
                        </View>
                        <View className="flex-row items-center justify-between mt-0.5">
                            <ThemedText className="text-xs text-slate-500 font-medium">Vuelta:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                                {altitudeReturn ? `${altitudeReturn.toLocaleString("es-ES")} pies` : ""}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}