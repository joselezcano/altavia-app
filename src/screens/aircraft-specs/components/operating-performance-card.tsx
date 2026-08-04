import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


const formatUnit = (val: number | undefined | null, unit: string) => {
    return val !== undefined && val !== null ? `${val} ${unit}` : "";
};


export function OperatingPerformanceCard({
    operating_specs
}: {
    operating_specs: AircraftSpecs["operating_specs"];
}) {
    return (
        <ThemedView
            variant="card"
            className="p-5 mb-4 border border-slate-100"
        >
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="speedometer" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Rendimiento y Operación
                </ThemedText>
            </View>
            <DetailRow
                label="Velocidad de Crucero"
                value={formatUnit(operating_specs.cruise_speed_knots, "Nudos (TAS)")}
            />
            <DetailRow
                label="Consumo de Combustible"
                value={formatUnit(operating_specs.fuel_burn_rate_gph, "GPH (Galones por Hora)")}
            />
            <DetailRow
                label="Techo de Servicio"
                value={formatUnit(operating_specs.service_ceiling_feet, "Pies (Altitud Máxima)")}
            />
            <DetailRow
                label="Peso Máximo de Despegue (MTOW)"
                value={formatUnit(operating_specs.max_takeoff_weight_lbs, "Libras")}
            />
            <DetailRow
                label="Carrera de Despegue Requerida"
                value={formatUnit(operating_specs.takeoff_distance_feet, "Pies")}
            />
            <DetailRow
                label="Distancia de Aterrizaje Requerida"
                value={formatUnit(operating_specs.landing_distance_feet, "Pies")}
            />
            <DetailRow
                label="Régimen de Ascenso"
                value={formatUnit(operating_specs.rate_of_climb_fpm, "FPM (Pies por Minuto)")}
            />
        </ThemedView>
    );
}