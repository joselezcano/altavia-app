import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


export function NotesCard({ notes }: { notes?: string }) {
    return (
        <ThemedView
            variant="card"
            className="p-5 mb-6 border border-slate-100"
        >
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="document-text" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Observaciones
                </ThemedText>
            </View>
            {notes ? (
                <ThemedText className="text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                    &quot;{notes}&quot;
                </ThemedText>
            ) : (
                <ThemedText className="text-slate-400 italic text-center py-2">
                    Sin observaciones registradas.
                </ThemedText>
            )}
        </ThemedView>
    );
}