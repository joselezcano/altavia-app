import { useAuth } from "@/hooks/useAuth";
import { TouchableOpacity } from "react-native";
import { ThemedText } from "./themed-text";
import { Ionicons } from "@expo/vector-icons";

export default function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <TouchableOpacity 
      className="border border-red-200 bg-red-50 py-3 px-4 rounded-xl flex-row items-center justify-center active:bg-red-50" style={{ gap: 8 }} 
      onPress={signOut}
    >
      <Ionicons name="log-out-outline" size={18} color="#ef4444" />
      <ThemedText className="text-red-500 font-semibold text-sm">
        Cerrar Sesión
      </ThemedText>
    </TouchableOpacity>
  );
}
