import { ThemedText } from "@/components/themed-text";
import { ClientReservationItem } from "@/types/all-roles";
import {
    View
} from "react-native";


export function ScheduleCard({ reservation }: { reservation: ClientReservationItem }) {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-base mb-3">
                Itinerario
            </ThemedText>

            <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
                {/* Outbound Section */}
                <View>
                    <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                        Vuelo de Ida
                    </ThemedText>
                    <View className="gap-1 pl-2 border-l-2 border-brand-gold/40">
                        <View className="flex-row items-center justify-between">
                            <ThemedText className="text-xs text-slate-500 font-medium">Salida:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                                {reservation.schedule.outbound_flight_departure_time.toLocaleString("es-ES", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })} hs
                            </ThemedText>
                        </View>
                        <View className="flex-row items-center justify-between mt-0.5">
                            <ThemedText className="text-xs text-slate-500 font-medium">Llegada estimada:</ThemedText>
                            <ThemedText className="text-xs font-bold text-slate-800">
                                {reservation.schedule.outbound_flight_arrival_time.toLocaleString("es-ES", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })} hs
                            </ThemedText>
                        </View>
                    </View>
                </View>

                {/* Return Section if Roundtrip */}
                {reservation.schedule.roundtrip && (
                    <>
                        <View className="h-px bg-slate-200 my-1" />
                        <View>
                            <ThemedText className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-1.5">
                                Vuelo de Vuelta
                            </ThemedText>
                            <View className="gap-1 pl-2 border-l-2 border-brand-gold/40">
                                <View className="flex-row items-center justify-between">
                                    <ThemedText className="text-xs text-slate-500 font-medium">Salida:</ThemedText>
                                    <ThemedText className="text-xs font-bold text-slate-800">
                                        {reservation.schedule.return_flight_departure_time
                                            ? `${reservation.schedule.return_flight_departure_time.toLocaleString("es-ES", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })} hs`
                                            : "N/A"}
                                    </ThemedText>
                                </View>
                                <View className="flex-row items-center justify-between mt-0.5">
                                    <ThemedText className="text-xs text-slate-500 font-medium">Llegada estimada:</ThemedText>
                                    <ThemedText className="text-xs font-bold text-slate-800">
                                        {reservation.schedule.return_flight_arrival_time
                                            ? `${reservation.schedule.return_flight_arrival_time.toLocaleString("es-ES", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })} hs`
                                            : "N/A"}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}