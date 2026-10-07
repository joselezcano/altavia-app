import { ThemedView } from "@/components/themed-view";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AircraftDetailsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="aircraft-specs" />
        <Stack.Screen name="base-airport" />
        <Stack.Screen name="photos" />
      </Stack>
    </ThemedView>
  );
}
