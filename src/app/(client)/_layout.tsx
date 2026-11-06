import { ThemedView } from "@/components/themed-view";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/hooks/useAuth";
import { useClientReservations } from "@/hooks/useClientReservations";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ClientLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isWideScreen } = useResponsive();
  const { data: reservations = [] } = useClientReservations(user?.uid);

  const pendingPaymentsCount = reservations.filter(
    (r) => r.internal_status === "awaiting_payment"
  ).length;

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
          tabBarStyle: isWideScreen ? styles.wideTabBar : styles.mobileTabBar,
          tabBarActiveTintColor: "#0f1e3d", // brand-blue
          tabBarInactiveTintColor: "#94A3B8", // brand-muted
          tabBarLabelStyle: {
            fontWeight: "600",
            fontSize: isWideScreen ? 12 : 11,
          },
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
            tabBarBadge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: "#C5A059",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: "bold",
            },
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

const styles = StyleSheet.create({
  mobileTabBar: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E2E8F0",
    elevation: 0,
  },
  wideTabBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    height: 68,
    paddingBottom: 10,
    paddingTop: 8,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: "#0F1E3D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
});

