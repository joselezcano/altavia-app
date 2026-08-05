import { LoadingCard } from "@/components/loading-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useFlightPlanDetails } from "@/hooks/useFlightPlanDetails";
import { AircraftFlightCard } from "@/screens/view-flight-plan/components/aircraft-flight-card";
import { AirportScheduleCard } from '@/screens/view-flight-plan/components/airports-schedule-card';
import { PilotCard } from "@/screens/view-flight-plan/components/pilot-card";
import { RoutePerformanceCard } from '@/screens/view-flight-plan/components/route-performance-card';
import { SecurityEmergencyCard } from "@/screens/view-flight-plan/components/security-emergency-card";
import { StatusCard } from '@/screens/view-flight-plan/components/status-card';
import { getStatusBadge } from "@/utils/flight-plan";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditButton } from "./components/edit-button";


export default function ViewFlightPlanScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        flightPlanId: string;
        aircraftModel: string;
    }>();

    const { data: plan, isLoading: isLoading } = useFlightPlanDetails(params.flightPlanId);

    const handleEdit = () => {
        if (!plan) return;
        router.push({
            pathname: "./create-flight-plan",
            params: {
                flightPlanId: plan.id,
                reservationId: plan.aircraft_reservation_id,
            },
        });
    };

    return (
        <ThemedView className="flex-1 bg-brand-light px-4" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 mt-2">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={20} color="#0f1e3d" />
                </TouchableOpacity>
                <View className="items-center">
                    <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[10px]">
                        Plan de Vuelo Registrado
                    </ThemedText>
                    <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                        Detalles del Plan
                    </ThemedText>
                </View>
                <View className="w-10" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {isLoading
                    ? <LoadingCard message="Cargando plan de vuelo..." />
                    : !plan ? (
                        <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
                            <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center mb-4 border border-rose-100">
                                <Ionicons name="alert-circle-outline" size={32} color="#e11d48" />
                            </View>
                            <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
                                Plan de Vuelo No Encontrado
                            </ThemedText>
                            <ThemedText className="text-slate-500 text-xs text-center mt-1 mb-6 px-4">
                                No fue posible recuperar la información de este plan de vuelo.
                            </ThemedText>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="bg-brand-blue px-5 py-3 rounded-xl flex-row items-center gap-2 shadow-md"
                                activeOpacity={0.8}
                            >
                                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                                <ThemedText className="text-sm font-bold text-white">Volver</ThemedText>
                            </TouchableOpacity>
                        </View>
                    ) : (() => {
                        const status = getStatusBadge(plan.status);
                        const fp = plan.flight_plan;
                        const ac = fp?.aircraft;
                        const fd = fp?.flight_details;
                        const dep = fp?.departure;
                        const arr = fp?.arrival;
                        const rt = fp?.route;
                        const perf = fp?.performance;
                        const em = fp?.emergency;
                        const plt = fp?.pilot;

                        return (
                            <View className="gap-4 mb-24">
                                {/* Status del Vuelo */}
                                <StatusCard
                                    departure_airport_code={fp?.departure?.icao}
                                    arrival_airport_code={fp?.arrival?.icao}
                                    aircraft_registration={ac?.registration}
                                    callsign={fd?.callsign}
                                    aircraft_model={params.aircraftModel}
                                    status_badge_label={status.label}
                                    status_badge_icon={status.icon}
                                    status_badge_icon_color={status.iconColor}
                                    status_badge_bg={status.badgeBg}
                                    status_badge_border={status.badgeBorder}
                                    status_badge_text_color={status.textColor}
                                />

                                {/* Aeronave y Detalles del Vuelo */}
                                <AircraftFlightCard
                                    registration={ac?.registration}
                                    type={ac?.type}
                                    wake_turbulence={ac?.wake_turbulence}
                                    transponder={ac?.transponder}
                                    equipment={ac?.equipment}
                                    callsign={fd?.callsign}
                                    flight_rules={fd?.flight_rules}
                                    flight_type={fd?.flight_type}
                                />

                                {/* Aeropuertos y Horarios */}
                                <AirportScheduleCard
                                    departure_airport_icao_code={dep?.icao}
                                    arrival_airport_icao_code={arr?.icao}
                                    departure_datetime_utc={dep?.datetime_utc}
                                    arrival_datetime_utc={arr?.datetime_utc}
                                    off_block_time={dep?.off_block_time}
                                    alternate_icao={arr?.alternate_icao}
                                />

                                {/* Ruta y Rendimiento */}
                                <RoutePerformanceCard
                                    cruising_speed_knots={rt?.cruising_speed_knots}
                                    cruising_altitude_feet={rt?.cruising_altitude_feet}
                                    waypoints={rt?.waypoints}
                                    encoded_route={rt?.encoded_route}
                                    eet_hours={perf?.eet_hours}
                                    eet_minutes={perf?.eet_minutes}
                                    fuel_hours={perf?.fuel_hours}
                                    fuel_minutes={perf?.fuel_minutes}
                                />

                                {/* Seguridad y Emergencia */}
                                <SecurityEmergencyCard
                                    pax_count={em?.pax_count}
                                    radio_equipment={em?.radio_equipment}
                                    survival_equipment={em?.survival_equipment}
                                    life_jacket_equipment={em?.life_jacket_equipment}
                                    dinghies_capacity={em?.dinghies_capacity}
                                />

                                {/* Datos del Piloto */}
                                <PilotCard
                                    name={plt?.name || ""}
                                    telephone={plt?.contact_info || ""}
                                    observations={plt?.observations || ""}
                                />
                            </View>
                        );
                    })()}
            </ScrollView>

            {/* Footer / Editar Plan Button */}
            {plan && <EditButton handleEdit={handleEdit} />}
        </ThemedView>
    );
}
