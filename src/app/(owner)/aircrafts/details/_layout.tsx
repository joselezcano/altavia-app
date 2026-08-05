import { Stack } from "expo-router";

export default function AircraftDetailsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="aircraft-specs" />
      <Stack.Screen name="base-airport" />
      <Stack.Screen name="photos" />
    </Stack>
  );
}
