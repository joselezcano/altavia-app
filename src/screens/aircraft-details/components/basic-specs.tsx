import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Airport } from "@/types/all-roles";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


const formatUnit = (val: number | undefined | null, unit: string) => {
    return val !== undefined && val !== null ? `${val} ${unit}` : "";
};

const formatValue = (val: string | number | undefined | null) => {
    return val !== undefined && val !== null ? String(val) : "";
};


export function BasicSpecsCard({ airport, basic_specs }: { airport?: Airport, basic_specs: AircraftSpecs["basic_specs"] }) {
    return (
        <ThemedView
            variant="card"
            className="p-5 mb-4 border border-slate-100"
        >
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="information-circle" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Especificaciones Básicas
                </ThemedText>
            </View>
            <DetailRow label="Modelo" value={formatValue(basic_specs.model)} />
            <DetailRow label="Tipo (ICAO)" value={formatValue(basic_specs.type)} />
            <DetailRow
                label="Matrícula"
                value={formatValue(basic_specs.registration)}
            />
            <DetailRow
                label="Aeropuerto Base / Origen"
                value={airport
                    ? `${airport.name} (${airport.iata_code || airport.icao_code})`
                    : "Sin especificar"
                }
            />
            <DetailRow
                label="Capacidad POB (Pax + Tripulación)"
                value={formatUnit(basic_specs.pax_count, "personas")}
            />
        </ThemedView>
    );
}