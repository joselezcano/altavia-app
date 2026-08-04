import { Stack } from "expo-router";

export default function AircraftCalendarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="day-schedule" />
      <Stack.Screen name="event-recurrence" />
      <Stack.Screen name="edit-event-recurrence" />
    </Stack>
  );
}
