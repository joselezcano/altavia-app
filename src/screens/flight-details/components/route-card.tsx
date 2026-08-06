import { ThemedText } from "@/components/themed-text";
import { ClientReservationItem } from "@/types/all-roles";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    View
} from "react-native";


export function RouteCard({ reservation }: { reservation: ClientReservationItem }) {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-3">
                Ruta
            </ThemedText>

            <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <View className="gap-3">
                    {/* Origen Row */}
                    <View className="flex-row items-center gap-2">
                        <View className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                        <View className="flex-1">
                            <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                                Origen
                            </ThemedText>
                            <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                                {reservation.originAirport?.name || reservation.trip.origin_airport_ident}
                            </ThemedText>
                        </View>
                    </View>

                    {/* Connector line & icon */}
                    <View className="flex-row items-center gap-2 pl-0.5 my-0.5">
                        <View className="w-0.5 h-6 bg-slate-300 ml-0.5" />
                        <View className="flex-row items-center gap-1.5 ml-3">
                            <MaterialCommunityIcons name="airplane-takeoff" size={14} color="#C5A059" />
                            {reservation.schedule.roundtrip && (
                                <ThemedText className="text-xs font-medium text-brand-gold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    Ida y Vuelta
                                </ThemedText>
                            )}
                        </View>
                    </View>

                    {/* Destino Row */}
                    <View className="flex-row items-center gap-2">
                        <View className="w-2.5 h-2.5 rounded-full bg-brand-blue" />
                        <View className="flex-1">
                            <ThemedText className="text-sm uppercase tracking-wider font-bold text-slate-400">
                                Destino
                            </ThemedText>
                            <ThemedText className="text-sm font-medium text-brand-blue" numberOfLines={2}>
                                {reservation.destinationAirport?.name || reservation.trip.destination_airport_ident}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}