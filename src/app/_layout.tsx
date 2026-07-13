import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth, USER_ROLE } from "@/hooks/useAuth";
import { QueryProvider } from "@/providers/query-providers";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { configureReanimatedLogger } from "react-native-reanimated";
import Toast from "react-native-toast-message";
import "../../global.css";

configureReanimatedLogger({ strict: false });
function RootLayoutNav() {
  const { user, role, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>
          Cargando datos del usuario...
        </ThemedText>
      </View>
    );
  }
  // if (user) signOut();
  const isAdmin = role === USER_ROLE.ADMIN;
  const isPilot = role === USER_ROLE.PILOT;
  const isClient = role === USER_ROLE.CLIENT;
  const isOwner = role === USER_ROLE.OWNER;
  console.log("RootLayoutNav - user:", user);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={user !== null}>
        <Stack.Protected guard={isAdmin}>
          <Stack.Screen name="(admin)" />
        </Stack.Protected>

        <Stack.Protected guard={isPilot}>
          <Stack.Screen name="(pilot)" />
        </Stack.Protected>

        <Stack.Protected guard={isOwner}>
          <Stack.Screen name="(owner)" />
        </Stack.Protected>

        <Stack.Protected guard={isClient}>
          <Stack.Screen name="(client)" />
        </Stack.Protected>
      </Stack.Protected>

      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryProvider>
      <AuthProvider>
        <RootLayoutNav />
        <StatusBar style="light" />
        <Toast />
      </AuthProvider>
    </QueryProvider>
  );
}

export default RootLayout;
