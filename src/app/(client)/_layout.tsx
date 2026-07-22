import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E2E8F0",
            elevation: 0, // Quita la sombra en Android para un look más limpio
          },
          tabBarActiveTintColor: "#0f1e3d", // brand-blue
          tabBarInactiveTintColor: "#94A3B8", // brand-muted
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Reservar",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="airplane" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="flights"
          options={{
            title: "Mis Vuelos",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="ticket" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        {/* Ocultamos la pantalla de TyC del menú de pestañas */}
        <Tabs.Screen
          name="terms"
          options={{
            href: null,
            tabBarStyle: { display: "none" }, // Oculta la barra inferior mientras lee los TyC
          }}
        />
        {/* Pantalla de detalles de aeronave */}
        <Tabs.Screen
          name="aircraft-details"
          options={{
            href: null,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Pantalla de resultados de búsqueda */}
        <Tabs.Screen
          name="search-results"
          options={{
            href: null,
            tabBarStyle: { display: "none" },
          }}
        />
      </Tabs>
    </ThemedView>
  );
}
