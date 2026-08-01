import { ThemedText } from "@/components/themed-text";
import { View } from "react-native";


export const StatusCard = ({ departure_airport_code, arrival_airport_code, aircraft_registration, callsign, aircraft_model, status, status_color }: {
    departure_airport_code: string;
    arrival_airport_code: string;
    aircraft_registration: string;
    callsign: string;
    aircraft_model: string;
    status: string;
    status_color: string;
}) => {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm flex-row items-center justify-between">
            <View>
                <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                    {departure_airport_code || "N/A"} ➔ {arrival_airport_code || "N/A"}
                </ThemedText>
                <ThemedText type="caption" className="text-slate-500 text-xs mt-0.5 font-medium">
                    {aircraft_model || `Callsign: ${callsign}` || `${aircraft_registration}` || "N/A"}
                </ThemedText>
            </View>
            <View className={`px-3 py-1 rounded-full border ${status_color}`}>
                <ThemedText className="text-xs font-bold">
                    {status}
                </ThemedText>
            </View>
        </View>
    );
}