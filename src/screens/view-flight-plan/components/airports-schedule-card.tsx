import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


export const AirportScheduleCard = ({
    departure_airport_icao_code,
    arrival_airport_icao_code,
    departure_datetime_utc,
    arrival_datetime_utc,
    off_block_time,
    alternate_icao,
}: {
    departure_airport_icao_code: string | undefined;
    arrival_airport_icao_code: string | undefined;
    departure_datetime_utc: string | undefined;
    arrival_datetime_utc: string | undefined;
    off_block_time: string | undefined;
    alternate_icao: string | undefined;
}) => {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="time-outline" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Aeropuertos y Horarios
                </ThemedText>
            </View>
            <DetailRow label="Origen (OACI)" value={departure_airport_icao_code || ""} />
            <DetailRow label="Fecha de Salida (UTC)" value={departure_datetime_utc?.split('T')[0] || ""} />
            <DetailRow label="Hora de Salida (UTC)" value={departure_datetime_utc?.split('T')[1].split('Z')[0].split('.')[0] || ""} />
            <DetailRow label="Fuera de Calzos (UTC)" value={off_block_time ? `${off_block_time} (HHMM)` : ""} />
            <DetailRow label="Destino (OACI)" value={arrival_airport_icao_code || ""} />
            <DetailRow label="Fecha de Llegada (UTC)" value={arrival_datetime_utc?.split('T')[0] || ""} />
            <DetailRow label="Hora de Llegada (UTC)" value={arrival_datetime_utc?.split('T')[1].split('Z')[0].split('.')[0] || ""} />
            <DetailRow label="Alternativo (OACI)" value={alternate_icao || ""} />
        </View>
    );
}