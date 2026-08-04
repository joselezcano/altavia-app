import { BadgesList } from "@/components/badges-list";
import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


const RADIO_EQUIPMENT_MAP: Record<string, string> = {
    N: "Nil (Ningún equipo)",
    S: "Estándar (VHF, VOR e ILS)",
    V: "VHF RTF (Voz VHF estándar)",
    Y: "VHF espaciado 8.33 kHz (Obligatorio en Europa)",
    H: "HF RTF (Voz HF para rutas de larga distancia)",
    U: "UHF RTF (Frecuencia militar UHF)",
    Z: "Otro equipo (Ver detalles en Item 18)",
    J1: "CPDLC ATN VDL Modo 2",
    J2: "CPDLC FANS 1/A HFDL",
    J3: "CPDLC FANS 1/A VDL Modo A",
    J4: "CPDLC FANS 1/A VDL Modo 2",
    J5: "CPDLC FANS 1/A SATCOM (Inmarsat)",
    J6: "CPDLC FANS 1/A SATCOM (MTSAT)",
    J7: "CPDLC FANS 1/A SATCOM (Iridium)",
    M1: "ATC Satvoice via Inmarsat",
    M2: "ATC Satvoice via MTSAT",
    M3: "ATC Satvoice via Iridium",
};

const SURVIVAL_EQUIPMENT_MAP: Record<string, string> = {
    P: "Polar (Clima ártico/nieve)",
    D: "Desert (Desierto y alta temperatura)",
    M: "Maritime (Marítimo y mar abierto)",
    J: "Jungle (Selva y vegetación densa)",
};

const LIFE_JACKETS_MAP: Record<string, string> = {
    L: "Luz de localización (Light)",
    F: "Fluoresceína (Marcador de color)",
    U: "Radio baliza UHF",
    V: "Radio transmisor VHF",
};


export const SecurityEmergencyCard = ({
    emergency,
}: {
    emergency: AircraftSpecs["emergency"];
}) => {
    return (
        <ThemedView
            variant="card"
            className="p-5 mb-4 border border-slate-100"
        >
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="shield-checkmark-outline" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Seguridad y Emergencia
                </ThemedText>
            </View>

            <BadgesList
                label="Equipamiento de Radio"
                items={emergency.radio_equipment}
                map={RADIO_EQUIPMENT_MAP}
            />
            <BadgesList
                label="Equipos de Supervivencia"
                items={emergency.survival_equipment}
                map={SURVIVAL_EQUIPMENT_MAP}
            />
            <BadgesList
                label="Chalecos Salvavidas"
                items={emergency.life_jacket_equipment}
                map={LIFE_JACKETS_MAP}
            />

            <View className="mt-4 pt-3 border-t border-slate-100">
                <ThemedText type="caption" className="font-bold text-brand-blue mb-2.5">
                    Balsas Salvavidas (Dinghies)
                </ThemedText>
                <DetailRow
                    label="Lleva Balsas"
                    value={emergency.dinghies_capacity.carried ? "Sí" : "No"}
                />
                {emergency.dinghies_capacity.carried && (
                    <>
                        <DetailRow label="Cantidad de Balsas" value={String(emergency.dinghies_capacity.number)} />
                        <DetailRow label="Capacidad Total de Balsas" value={`${emergency.dinghies_capacity.total_capacity} personas`} />
                        <DetailRow label="Cubierta de Protección" value={emergency.dinghies_capacity.covered ? "Sí" : "No"} />
                        <DetailRow label="Color de Balsas" value={emergency.dinghies_capacity.color || ""} />
                    </>
                )}
            </View>
        </ThemedView>
    );
}

