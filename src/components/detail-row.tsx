import { ThemedText } from "@/components/themed-text";
import { View } from "react-native";


export const DetailRow = ({ label, value }: { label: string; value: string }) => {
    return (
        <View className="flex-row justify-between py-2.5 border-b border-slate-100 items-start">
            <ThemedText type="caption" className="text-slate-500 font-medium mr-4">
                {label}
            </ThemedText>
            <ThemedText className="font-semibold text-slate-700 text-right flex-1">
                {value || "-"}
            </ThemedText>
        </View>
    );
};