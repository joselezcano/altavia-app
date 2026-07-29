import UserAvatar from "@/components/user-avatar";
import { Ionicons } from "@expo/vector-icons";
import { Drawer, DrawerContentScrollView, DrawerItemList } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminLayout() {
    const insets = useSafeAreaInsets();
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/altavia-app.firebasestorage.app/o/public%2Flogo%20altavista.jpeg?alt=media&token=7a326f0f-7ff4-4f20-a2c2-e1cb05c2d0b7";

    return (
        <>
            <StatusBar style="light" />
            <Drawer
                drawerContent={(props) => (
                    <DrawerContentScrollView
                        {...props}
                        contentContainerStyle={{ flexGrow: 1 }}
                        style={{ paddingTop: insets.top }}
                    >
                        {/* Cabecera del Panel con Logo */}
                        <View className="items-center py-5 border-b border-slate-100 mb-4 px-4">
                            <Image
                                source={{ uri: logoUrl }}
                                style={{ width: 180, height: 50 }}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Lista de Navegación Principal */}
                        <DrawerItemList {...props} />

                        {/* Espaciador para empujar el pie de página */}
                        <View className="flex-grow" />

                        {/* Pie de página con el Avatar Reutilizable */}
                        <View style={styles.footerContainer}>
                            <UserAvatar showDetails={true} size={40} />
                        </View>
                    </DrawerContentScrollView>
                )}
                screenOptions={{
                    drawerStyle: {
                        width: 280,
                    },
                    headerStyle: {
                        backgroundColor: "#0f1e3d", // brand.blue
                    },
                    headerTintColor: "#FFFFFF", // White text
                    headerTitleStyle: {
                        fontWeight: "bold",
                    },
                    drawerActiveTintColor: "#C5A059", // brand.gold
                    drawerInactiveTintColor: "#0f1e3d", // brand.blue
                    drawerLabelStyle: {
                        fontWeight: "bold",
                    },
                }}
            >
            <Drawer.Screen
                name="index"
                options={{
                    drawerLabel: "Dashboard",
                    title: "Dashboard",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="pie-chart-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="pie-chart-outline" size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg">Dashboard</Text>
                        </View>
                    )
                }}
            />
            <Drawer.Screen
                name="templates/index"
                options={{
                    drawerLabel: "Aeronaves",
                    title: "Aeronaves",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="airplane-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="airplane-outline" size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg">Aeronaves</Text>
                        </View>
                    )
                }}
            />
            <Drawer.Screen
                name="templates/add"
                options={{
                    drawerItemStyle: { display: "none" },
                    title: "Nueva Plantilla",
                }}
            />
            <Drawer.Screen
                name="request-flight"
                options={{
                    drawerItemStyle: { display: "none" },
                    drawerLabel: "Solicitar Vuelo",
                    title: "Solicitar Vuelo",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="paper-plane-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="fleet-pricing"
                options={{
                    drawerLabel: "Control de Flota",
                    title: "Flota y Tarifas",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="cash-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg">Flota y Tarifas</Text>
                        </View>
                    )
                }}
            />
        </Drawer>
        </>
    );
}

const styles = StyleSheet.create({
    footerContainer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
});
