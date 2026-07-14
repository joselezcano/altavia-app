import { useAuth } from "@/hooks/useAuth";
import { TouchableOpacity } from "react-native";
import { ThemedText } from "./themed-text";

export default function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <TouchableOpacity className="bg-red-500 p-2 rounded" onPress={signOut}>
      <ThemedText className="text-white font-bold text-lg">
        Cerrar Sesión
      </ThemedText>
    </TouchableOpacity>
  );
}
