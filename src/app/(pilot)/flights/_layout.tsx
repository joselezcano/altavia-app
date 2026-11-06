import { Stack } from "expo-router";

export default function FlightsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="flight-details" />
            <Stack.Screen name="flight-tracker" />
            <Stack.Screen name="create-flight-plan" />
            <Stack.Screen name="view-flight-plan" />
            <Stack.Screen name="new-booking" />
            <Stack.Screen name="reservations" />
            <Stack.Screen name="assign-pilots" />
            <Stack.Screen name="edit-reservation" />
        </Stack>
    );
}
