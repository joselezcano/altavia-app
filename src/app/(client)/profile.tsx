import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ProfileScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center p-4">
      <ThemedText className="text-xl font-bold text-brand-blue">
        Mi Perfil
      </ThemedText>
      <ThemedText className="text-slate-500 mt-2 text-center">
        Página de perfil del cliente en construcción.
      </ThemedText>
    </ThemedView>
  );
}
