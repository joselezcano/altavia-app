import { ThemedView } from "@/components/themed-view";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OwnerLayout() {
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
                        elevation: 0, // Remove shadow on Android for a cleaner look
                    },
                    tabBarActiveTintColor: "#0f1e3d", // brand-blue
                    tabBarInactiveTintColor: "#94A3B8", // brand-muted
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "Vuelos",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="paper-plane" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="aircrafts"
                    options={{
                        title: "Aeronaves",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="airplane" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="pilots"
                    options={{
                        title: "Pilotos",
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="account-tie-hat" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="test"
                    options={{
                        title: "Test",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="code-slash" size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </ThemedView>
    );
}
