import { Stack } from "expo-router";

export default function PlansLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="view-flight-plan" />
    </Stack>
  );
}
