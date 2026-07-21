import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
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
                    name="list-aircrafts"
                    options={{
                        title: "Aeronaves",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="airplane" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="add-aircraft"
                    options={{
                        href: null,
                        tabBarStyle: { display: "none" },
                    }}
                />
                <Tabs.Screen
                    name="aircraft-details"
                    options={{
                        href: null,
                        tabBarStyle: { display: "none" },
                    }}
                />
                <Tabs.Screen
                    name="aircraft-calendar"
                    options={{
                        href: null,
                        tabBarStyle: { display: "none" },
                    }}
                />
                <Tabs.Screen
                    name="event-recurrence"
                    options={{
                        href: null,
                        tabBarStyle: { display: "none" },
                    }}
                />
            </Tabs>
        </ThemedView>
    );
}
