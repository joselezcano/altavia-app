import UserAvatar from "@/components/user-avatar";
import { BRAND_LOGO_ASPECT, BRAND_LOGOS } from "@/constants/brand";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { Drawer, DrawerContentScrollView, DrawerItemList } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminLayout() {
    const insets = useSafeAreaInsets();
    const { isWideScreen } = useResponsive();

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
                                source={BRAND_LOGOS.horizontalColor}
                                style={{ width: 168, height: 168 / BRAND_LOGO_ASPECT.horizontal }}
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
                    drawerType: isWideScreen ? "permanent" : "front",
                    drawerStyle: {
                        width: 280,
                        backgroundColor: "#FFFFFF",
                        borderRightWidth: isWideScreen ? 1 : 0,
                        borderRightColor: "#E2E8F0",
                    },
                    headerStyle: {
                        backgroundColor: "#030436", // brand.blue
                    },
                    headerTintColor: "#FFFFFF", // White text
                    headerTitleStyle: {
                        fontWeight: "bold",
                    },
                    drawerActiveTintColor: "#0165FF", // brand.gold
                    drawerInactiveTintColor: "#030436", // brand.blue
                    drawerLabelStyle: {
                        fontWeight: "bold",
                    },
                    headerLeft: isWideScreen ? () => null : undefined,
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
                        <View className="flex-row items-center" style={{ gap: 8 }}>
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
                        <View className="flex-row items-center" style={{ gap: 8 }}>
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
                name="new-booking"
                options={{
                    drawerLabel: "Nueva Reserva",
                    title: "Nueva Reserva",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="add-circle-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg">Despacho Telefónico</Text>
                        </View>
                    )
                }}
            />
            <Drawer.Screen
                name="quotes"
                options={{
                    drawerLabel: "Presupuestos",
                    title: "Presupuestos",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="document-text-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View style={styles.headerTitleRow}>
                            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.headerTitleText}>Presupuestos</Text>
                        </View>
                    )
                }}
            />
            {/* Detalle y edición del presupuesto: header propio con "volver" (ocultos del menú). */}
            <Drawer.Screen
                name="quote-details"
                options={{
                    drawerItemStyle: { display: "none" },
                    title: "Presupuesto",
                    headerShown: false,
                }}
            />
            <Drawer.Screen
                name="quote-edit"
                options={{
                    drawerItemStyle: { display: "none" },
                    title: "Editar presupuesto",
                    headerShown: false,
                }}
            />
            <Drawer.Screen
                name="reservations"
                options={{
                    drawerLabel: "Reservas y Cobros",
                    title: "Reservas y Cobros",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg">Reservas y Cobros</Text>
                        </View>
                    )
                }}
            />
            <Drawer.Screen
                name="users"
                options={{
                    drawerLabel: "Usuarios",
                    title: "Usuarios",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="people-outline" size={size} color={color} />
                    ),
                    headerTitle: () => (
                        <View style={styles.headerTitleRow}>
                            <Ionicons name="people-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.headerTitleText}>Usuarios</Text>
                        </View>
                    )
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
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg">Flota y Tarifas</Text>
                        </View>
                    )
                }}
            />
            <Drawer.Screen
                name="billing"
                options={{
                    drawerLabel: "Facturación",
                    title: "Facturación",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="receipt-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="business-plan"
                options={{
                    drawerLabel: "Plan de negocio",
                    title: "Plan de negocio",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="trending-up-outline" size={size} color={color} />
                    ),
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
    headerTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    headerTitleText: {
        color: "#FFFFFF",
        fontFamily: "NotoSans_700Bold",
        fontSize: 18,
    },
});
