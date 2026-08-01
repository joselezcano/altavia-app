import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

export const EditButton = ({ handleEdit }: { handleEdit: () => void }) => {
    return (
        <View className="p-4 bg-brand-light border-t border-slate-200">
            <TouchableOpacity
                onPress={handleEdit}
                className="bg-brand-gold py-4 px-6 rounded-2xl items-center justify-center flex-row gap-2 shadow-md"
                activeOpacity={0.8}
            >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                <ThemedText className="text-white font-bold text-base">
                    Editar Plan de Vuelo
                </ThemedText>
            </TouchableOpacity>
        </View>);
}