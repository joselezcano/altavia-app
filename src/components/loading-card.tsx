import { ThemedText } from "@/components/themed-text";
import { ActivityIndicator, View } from "react-native";

export const LoadingCard = ({ message }: { message: string }) => (
    <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6">
        <ActivityIndicator size="large" color="#030436" />
        <ThemedText className="text-slate-500 font-medium mt-3 text-center text-sm">
            {message}
        </ThemedText>
    </View>
);