import { Stack } from "expo-router";

export default function PilotsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="pilot-details" />
        </Stack>
    );
}
