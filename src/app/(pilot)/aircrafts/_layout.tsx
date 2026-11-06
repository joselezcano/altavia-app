import { Stack } from "expo-router";

export default function AircraftsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-aircraft" />
    </Stack>
  );
}
