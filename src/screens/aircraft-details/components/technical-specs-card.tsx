import { BadgesList } from "@/components/badges-list";
import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


const FLIGHT_RULES_MAP: Record<string, string> = {
    IFR: "IFR (Reglas de Vuelo por Instrumentos)",
    VFR: "VFR (Reglas de Vuelo Visual)",
    Y: "Y (IFR primero, luego VFR)",
    Z: "Z (VFR primero, luego IFR)",
};

const WAKE_TURBULENCE_MAP: Record<string, string> = {
    L: "L (Ligera - ≤ 7,000 kg)",
    M: "M (Media - 7,000 a 136,000 kg)",
    H: "H (Pesada - ≥ 136,000 kg)",
    J: "J (Super - Airbus A380-800)",
};

const TRANSPONDER_MAP: Record<string, string> = {
    A: "Modo A (sin altitud)",
    C: "Modo A/C (con altitud de presión)",
    S: "Modo S (altitud e identificación)",
    E: "Modo S con Extended Squitter (ADS-B Out)",
    H: "Modo S con Enhanced Surveillance",
    L: "Modo S con Enhanced Surveillance & Extended Squitter (ADS-B Out)",
    I: "Modo S con ACID (sin altitud de presión)",
    P: "Modo S con altitud de presión (sin ACID)",
    X: "Modo S sin ACID ni altitud de presión",
};

const EQUIPMENT_MAP: Record<string, string> = {
    D: "DME instalado",
    F: "ADF instalado",
    G: "GNSS instalado",
    I: "ILS instalado",
    O: "VOR / Örn instalado",
    P: "TACAN instalado",
    R: "Radioaltímetro instalado",
    S: "Transponder Modo S instalado",
    T: "Transponder Modo A/C instalado",
    U: "SSR Transponder Modo S instalado",
    X: "Transponder Modo X instalado",
    Z: "Sin ADS-B Out",
};

const formatUnit = (val: number | undefined | null, unit: string) => {
    return val !== undefined && val !== null ? `${val} ${unit}` : "";
};


export function TechnicalSpecsCard({ technical_specs }: { technical_specs: AircraftSpecs["technical_specs"] }) {
    return (
        <ThemedView
            variant="card"
            className="p-5 mb-4 border border-slate-100"
        >
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="settings" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Especificaciones Técnicas
                </ThemedText>
            </View>
            <DetailRow
                label="Reglas de Vuelo"
                value={
                    technical_specs.flight_rules
                        ? FLIGHT_RULES_MAP[technical_specs.flight_rules] ||
                        technical_specs.flight_rules
                        : ""
                }
            />
            <DetailRow
                label="Estela Turbulenta"
                value={
                    technical_specs.wake_turbulence_category
                        ? WAKE_TURBULENCE_MAP[technical_specs.wake_turbulence_category] ||
                        technical_specs.wake_turbulence_category
                        : ""
                }
            />
            <DetailRow
                label="Capacidad Combustible Usable"
                value={formatUnit(technical_specs.fuel_capacity_gallons, "Galones")}
            />
            <DetailRow
                label="Transpondedor"
                value={
                    technical_specs.transponder
                        ? TRANSPONDER_MAP[technical_specs.transponder] ||
                        technical_specs.transponder
                        : ""
                }
            />
            <BadgesList
                label="Equipamiento OACI"
                items={technical_specs.equipment}
                map={EQUIPMENT_MAP}
            />
        </ThemedView>
    );
}