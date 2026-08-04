import { BadgesList } from "@/components/badges-list";
import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

export const RoutePerformanceCard = ({ cruising_speed_knots, cruising_altitude_feet, waypoints, encoded_route, eet_hours, eet_minutes, fuel_hours, fuel_minutes }: {
    cruising_speed_knots: number;
    cruising_altitude_feet: number;
    waypoints: string[];
    encoded_route: string[];
    eet_hours: number;
    eet_minutes: number;
    fuel_hours: number;
    fuel_minutes: number;
}) => {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="navigate-outline" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Ruta y Rendimiento
                </ThemedText>
            </View>
            <DetailRow
                label="Velocidad de Crucero"
                value={cruising_speed_knots ? `${cruising_speed_knots} nudos` : ""}
            />
            <DetailRow
                label="Altitud de Crucero"
                value={cruising_altitude_feet ? `${cruising_altitude_feet} pies` : ""}
            />
            <BadgesList label="Puntos de Ruta" items={waypoints} />
            <BadgesList label="Ruta Codificada" items={encoded_route} />
            <DetailRow
                label="Tiempo Estimado (EET)"
                value={`${eet_hours}h ${eet_minutes}m`}
            />
            <DetailRow
                label="Autonomía de Combustible"
                value={`${fuel_hours}h ${fuel_minutes}m`}
            />
        </View>
    );
}