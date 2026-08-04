import { ThemedText } from "@/components/themed-text";
import type { AircraftSpecs } from "@/types/owner";
import { View } from "react-native";


export function AircraftDetailsTitleCard({
    basic_specs
}: {
    basic_specs: AircraftSpecs["basic_specs"]
}) {
    return (
        <View className="bg-brand-blue rounded-3xl p-5 mb-4 flex-row justify-between items-center">
            <View className="flex-1">
                <View className="mb-2">
                    <ThemedText className="font-bold text-xl text-white">
                        {basic_specs.model}
                    </ThemedText>
                </View>
                <View className="self-start bg-brand-gold px-4 py-1.5 rounded-full">
                    <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                        {basic_specs.registration}
                    </ThemedText>
                </View>
            </View>
        </View>
    );
}