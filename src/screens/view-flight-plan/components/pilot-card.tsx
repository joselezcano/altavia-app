import { ThemedText } from "@/components/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { DetailRow } from "./detail-row";


export const PilotCard = ({ name, telephone, observations }: { name: string; telephone: string; observations: string; }) => {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
                <MaterialCommunityIcons name="account-tie-hat" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Piloto
                </ThemedText>
            </View>
            <DetailRow label="Nombre" value={name} />
            <DetailRow label="Teléfono" value={telephone} />
            <DetailRow label="Observaciones" value={observations} />
        </View>
    );
}