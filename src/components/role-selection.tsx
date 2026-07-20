import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Role, useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

export default function RoleSelectionScreen() {
  const { roles, selectRole, signOut } = useAuth();

  const getRoleInfo = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return {
          title: "Administrador",
          description: "Acceso al panel de control de ALTAVIA",
          icon: "shield-checkmark-outline" as const,
        };
      case "OWNER":
        return {
          title: "Propietario",
          description: "Gestiona tu flota y disponibilidad",
          icon: "briefcase-outline" as const,
        };
      case "PILOT":
        return {
          title: "Piloto",
          description: "Consulta tus planes de vuelo asignados",
          icon: "airplane-outline" as const,
        };
      case "CLIENT":
        return {
          title: "Pasajero",
          description: "Cotiza y reserva tus vuelos privados",
          icon: "people-outline" as const,
        };
    }
  };

  return (
    <ThemedView className="flex-1 justify-center px-4 bg-brand-light ">
      <View className="mb-10 items-center">
        <ThemedText type="title" className="text-3xl text-brand-blue font-bold mb-2">
          Acceder como...
        </ThemedText>
        <ThemedText type="caption" className="text-center text-slate-500 max-w-xs">
          Detectamos múltiples roles asociados a tu cuenta. Elige con cuál deseas ingresar en esta sesión.
        </ThemedText>
      </View>

      <View className="space-y-4 gap-2">
        {roles.map((role) => {
          const info = getRoleInfo(role);
          return (
            <TouchableOpacity
              key={role}
              onPress={() => selectRole(role)}
              className="bg-brand-white border border-slate-200 rounded-2xl p-5 flex-row items-center shadow-sm active:bg-slate-50"
            >
              <View className="w-12 h-12 rounded-xl bg-brand-blue/5 justify-center items-center mr-4">
                <Ionicons name={info.icon} size={24} color="#0f1e3d" />
              </View>
              <View className="flex-1">
                <ThemedText className="font-bold text-lg text-brand-blue">
                  {info.title}
                </ThemedText>
                <ThemedText type="caption" className="text-slate-400 mt-0.5 text-xs">
                  {info.description}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#b89c50" />
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={signOut}
        className="mt-12 flex-row justify-center items-center py-3 bg-red-50 border border-red-200 rounded-xl"
      >
        <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
        <ThemedText className="text-red-600 font-bold text-sm">
          Cerrar Sesión
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}
