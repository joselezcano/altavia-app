import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


export const StatusCard = ({ departure_airport_code, arrival_airport_code, aircraft_registration, callsign, aircraft_model, status_badge_label, status_badge_icon, status_badge_icon_color, status_badge_bg, status_badge_border, status_badge_text_color }: {
    departure_airport_code: string;
    arrival_airport_code: string;
    aircraft_registration: string;
    callsign: string;
    aircraft_model: string;
    status_badge_label: string;
    status_badge_icon: string;
    status_badge_icon_color: string;
    status_badge_bg: string;
    status_badge_border: string;
    status_badge_text_color: string;
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
            <View
                className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border ${status_badge_bg} ${status_badge_border}`}
            >
                <Ionicons
                    name={status_badge_icon as any}
                    size={14}
                    color={status_badge_icon_color}
                />
                <ThemedText className={`text-xs font-bold ${status_badge_text_color}`}>
                    {status_badge_label}
                </ThemedText>
            </View>
        </View>
    );
}

