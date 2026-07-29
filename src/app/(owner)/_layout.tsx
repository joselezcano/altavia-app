import UserAvatar from "@/components/user-avatar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Drawer, DrawerContentScrollView, DrawerItemList } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OwnerLayout() {
    const insets = useSafeAreaInsets();
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/altavia-app.firebasestorage.app/o/public%2Flogo%20altavista.jpeg?alt=media&token=7a326f0f-7ff4-4f20-a2c2-e1cb05c2d0b7";

    return (
        <>
            <StatusBar style="dark" />
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
                    headerShown: false, // Cabeceras transparentes dentro del cuerpo de la pantalla
                    drawerStyle: {
                        width: 280,
                    },
                    drawerActiveTintColor: "#C5A059", // brand.gold
                    drawerInactiveTintColor: "#0f1e3d", // brand.blue
                    drawerLabelStyle: {
                        fontWeight: "bold",
                    },
                }}
            >
                <Drawer.Screen
                    name="flights"
                    options={{
                        drawerLabel: "Vuelos",
                        title: "Vuelos",
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="paper-plane-outline" size={size} color={color} />
                        ),
                    }}
                />
                <Drawer.Screen
                    name="aircrafts"
                    options={{
                        drawerLabel: "Aeronaves",
                        title: "Aeronaves",
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="airplane-outline" size={size} color={color} />
                        ),
                    }}
                />
                <Drawer.Screen
                    name="pilots"
                    options={{
                        drawerLabel: "Pilotos",
                        title: "Pilotos",
                        drawerIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="account-tie-hat" size={size} color={color} />
                        ),
                    }}
                />
                <Drawer.Screen
                    name="test"
                    options={{
                        drawerItemStyle: { display: "none" },
                        drawerLabel: "Tests",
                        title: "Tests",
                        drawerIcon: ({ color, size }) => (
                            <Ionicons name="flask-outline" size={size} color={color} />
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
});
