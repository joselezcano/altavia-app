import SignOutButton from "@/components/sign-out-button";
import { Drawer, DrawerContentScrollView, DrawerItemList } from "expo-router/drawer";
import { StyleSheet, View } from "react-native";

export default function AdminLayout() {
    return (
        <Drawer
            drawerContent={(props) => (
                <DrawerContentScrollView
                    {...props}
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    {/* Main navigation list */}
                    <DrawerItemList {...props} />

                    {/* Spacer to push sign out button to the bottom */}
                    <View className="flex-grow" />

                    {/* Sign Out Button in the footer */}
                    <View style={styles.footerContainer}>
                        <SignOutButton />
                    </View>
                </DrawerContentScrollView>
            )}
            screenOptions={{
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
                }}
            />
            <Drawer.Screen
                name="request-flight"
                options={{
                    drawerLabel: "Solicitar Vuelo",
                    title: "Solicitar Vuelo",
                }}
            />
        </Drawer>
    );
}

const styles = StyleSheet.create({
    footerContainer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
});
