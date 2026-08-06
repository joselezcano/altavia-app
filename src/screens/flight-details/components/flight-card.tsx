import { ThemedText } from "@/components/themed-text";
import { ClientReservationItem } from "@/types/all-roles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactElement } from "react";
import {
    View
} from "react-native";


export function FlightCard({
    reservation,
    distanceKm,
    flightDurationHoursOutbound,
    flightDurationHoursReturn,
    paxCapacity,
}: {
    reservation: ClientReservationItem;
    distanceKm: string | undefined;
    flightDurationHoursOutbound: number | undefined;
    flightDurationHoursReturn: number | undefined;
    paxCapacity: number | undefined;
}) {
    const formatFlightTime = (hours: number) => {
        if (!hours || isNaN(hours) || hours <= 0) return "N/A";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} h`;
        return `${h} h ${m} min`;
    };

    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm gap-3">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-1">
                Vuelo
            </ThemedText>

            {/* Pasajeros solicitados */}
            <CardRow
                icon={<Ionicons name="people-outline" size={18} color="#0f1e3d" />}
                title="Pasajeros solicitados"
                value={`${reservation.capacity.passangers} pasajero(s)`}
            />

            {/* Capacidad de asientos */}
            <CardRow
                icon={<MaterialCommunityIcons name="seat-passenger" size={18} color="#0f1e3d" />}
                title="Capacidad de asientos"
                value={paxCapacity ? `${paxCapacity} asientos` : ""}
            />

            {/* Distancia del viaje */}
            <CardRow
                icon={<Ionicons name="navigate-outline" size={18} color="#0f1e3d" />}
                title="Distancia del viaje"
                value={distanceKm ? `${distanceKm} km` : ""}
            />

            {flightDurationHoursOutbound === flightDurationHoursReturn
                ? (
                    <>
                        {/* Tiempo de vuelo (Ida y Vuelta) */}
                        < CardRow
                            icon={<Ionicons name="time-outline" size={18} color="#0f1e3d" />}
                            title="Tiempo de vuelo"
                            value={flightDurationHoursOutbound ? formatFlightTime(flightDurationHoursOutbound) : ""}
                        />
                    </>
                ) : (
                    <>
                        {/* Tiempo de vuelo (Ida) */}
                        <CardRow
                            icon={<Ionicons name="time-outline" size={18} color="#0f1e3d" />}
                            title="Tiempo de vuelo (Ida)"
                            value={flightDurationHoursOutbound ? formatFlightTime(flightDurationHoursOutbound) : ""}
                        />

                        {/* Tiempo de vuelo (Vuelta) */}
                        <CardRow
                            icon={<Ionicons name="time-outline" size={18} color="#0f1e3d" />}
                            title="Tiempo de vuelo (Vuelta)"
                            value={flightDurationHoursReturn ? formatFlightTime(flightDurationHoursReturn) : ""}
                        />
                    </>
                )}
        </View>
    );
}


export function CardRow({
    icon,
    title,
    value
}: {
    icon: ReactElement;
    title: string;
    value: string;
}) {
    return (
        <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
            <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
                    {icon}
                </View>
                <ThemedText className="text-xs font-medium text-slate-600">
                    {title}
                </ThemedText>
            </View>
            <ThemedText className="text-xs font-bold text-slate-900">
                {value}
            </ThemedText>
        </View>
    );
}