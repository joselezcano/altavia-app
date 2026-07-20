import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PilotLayout() {
    const insets = useSafeAreaInsets();
    const { profileData } = useAuth();
    const isEncargado = profileData?.isEncargado === true;

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
                        elevation: 0, // Remove shadow on Android for a cleaner look
                    },
                    tabBarActiveTintColor: "#0f1e3d", // brand-blue
                    tabBarInactiveTintColor: "#94A3B8", // brand-muted
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "Flight Plan",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="paper-plane" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="manage-fleet"
                    options={{
                        title: "Mi Flota",
                        href: isEncargado ? undefined : null,
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="airplane" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="create-flight-plan"
                    options={{
                        href: null,
                        tabBarStyle: { display: "none" },
                    }}
                />
            </Tabs>
        </ThemedView>
    );
}
