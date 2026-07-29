import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  
  // Identify if we are on the home tab
  // pathname can be '/' when it is the default route
  const isHome = pathname === "/" || pathname === "/(client)" || pathname === "/(client)/" || pathname === "/(client)/index";
  return (
    <ThemedView
      style={{
        flex: 1,
        paddingTop: isHome ? 0 : insets.top,
      }}
    >
      <StatusBar style={isHome ? "light" : "dark"} />
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
            title: "Inicio",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="book"
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
        {/* Pantalla de detalles de vuelo */}
        <Tabs.Screen
          name="flight-details"
          options={{
            href: null,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Pantalla de seguimiento de vuelo */}
        <Tabs.Screen
          name="flight-tracker"
          options={{
            href: null,
            tabBarStyle: { display: "none" },
          }}
        />
      </Tabs>
    </ThemedView>
  );
}
