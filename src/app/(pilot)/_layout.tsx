import { ThemedView } from "@/components/themed-view";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PilotLayout() {
    const insets = useSafeAreaInsets();
    const { profileData } = useAuth();
    const { isWideScreen } = useResponsive();
    const isEncargado = profileData?.isEncargado === true;

    return (
        <ThemedView
            style={{
                flex: 1,
            }}
        >
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
                    name="flights"
                    options={{
                        title: "Mis Vuelos",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="paper-plane" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="plans"
                    options={{
                        title: "Mis Planes",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="document-text" size={size} color={color} />
                        ),
                    }}
                />

                <Tabs.Screen
                    name="aircrafts"
                    options={{
                        title: "Mi Flota",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="airplane" size={size} color={color} />
                        ),
                    }}
                />

                {/* Control Operativo (GIO): solo pilotos encargados */}
                <Tabs.Screen
                    name="finances"
                    options={{
                        title: "Contable",
                        href: isEncargado ? undefined : null,
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="calculator" size={size} color={color} />
                        ),
                    }}
                />

                {/* Mis propietarios: ruta oculta, se abre desde el avatar */}
                <Tabs.Screen
                    name="my-owners"
                    options={{
                        title: "Mis propietarios",
                        href: null,
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
        maxWidth: 600,
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

