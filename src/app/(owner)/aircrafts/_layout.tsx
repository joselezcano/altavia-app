import { Stack } from "expo-router";

export default function AircraftsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-aircraft" />
      <Stack.Screen name="aircraft-details" />
      <Stack.Screen name="aircraft-calendar" />
      <Stack.Screen name="day-schedule" />
      <Stack.Screen name="event-recurrence" />
      <Stack.Screen name="edit-event-recurrence" />
    </Stack>
  );
}
