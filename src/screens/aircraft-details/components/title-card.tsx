import { ThemedText } from "@/components/themed-text";
import { View } from "react-native";

export function AircraftDetailsTitleCard({
    title,
    model,
    registration,
}: {
    title: string;
    model: string;
    registration: string;
}) {
    return (
        <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center shadow-sm">
            <View className="flex-1 mr-4">
                <ThemedText className="font-bold text-xl text-white">
                    {model || "Aeronave"}
                </ThemedText>
                <ThemedText type="caption" className="text-slate-300 text-md mt-1 font-semibold">
                    {title}
                </ThemedText>
            </View>
            {registration && (
                <View className="bg-brand-gold px-4 py-1.5 rounded-full">
                    <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                        {registration}
                    </ThemedText>
                </View>
            )}
        </View>
    );
}