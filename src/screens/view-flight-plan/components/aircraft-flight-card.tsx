import { ThemedText } from "@/components/themed-text";
import { BadgesList } from "@/screens/view-flight-plan/components/badges-list";
import { DetailRow } from "@/screens/view-flight-plan/components/detail-row";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";


export const AircraftFlightCard = ({ registration, type, wake_turbulence, transponder, equipment, callsign, flight_rules, flight_type }: {
    registration: string;
    type: string;
    wake_turbulence: string;
    transponder: string;
    equipment: string | string[] | null | undefined;
    callsign: string;
    flight_rules: string;
    flight_type: string;
}) => {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
                <MaterialCommunityIcons name="airplane" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Aeronave y Vuelo
                </ThemedText>
            </View>
            <DetailRow label="Matrícula" value={registration || ""} />
            <DetailRow label="Tipo de Aeronave" value={type || ""} />
            <DetailRow label="Estela Turbulenta" value={wake_turbulence || ""} />
            <DetailRow label="Transpondedor" value={transponder || ""} />
            <BadgesList label="Equipamiento" items={equipment} />
            <DetailRow label="Callsign" value={callsign || ""} />
            <DetailRow label="Reglas de Vuelo" value={flight_rules || ""} />
            <DetailRow label="Tipo de Vuelo" value={flight_type || ""} />
        </View>
    );
}