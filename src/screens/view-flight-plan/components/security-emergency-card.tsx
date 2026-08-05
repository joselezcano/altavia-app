import { BadgesList } from "@/components/badges-list";
import { DetailRow } from "@/components/detail-row";
import { ThemedText } from "@/components/themed-text";
import { DinghiesCapacity, EmergencyRadioArray, LifeJacketArray, SurvivalEquipmentArray } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";


export const SecurityEmergencyCard = ({
    pax_count,
    radio_equipment,
    survival_equipment,
    life_jacket_equipment,
    dinghies_capacity
}: {
    pax_count: number;
    radio_equipment: EmergencyRadioArray;
    survival_equipment: SurvivalEquipmentArray;
    life_jacket_equipment: LifeJacketArray;
    dinghies_capacity: DinghiesCapacity;
}) => {
    return (
        <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="shield-checkmark-outline" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Seguridad y Emergencia
                </ThemedText>
            </View>
            <DetailRow label="Personas a Bordo (POB)" value={String(pax_count)} />
            <BadgesList label="Radio de Emergencia" items={radio_equipment} />
            <BadgesList label="Equipos de Supervivencia" items={survival_equipment} />
            <BadgesList label="Chalecos Salvavidas" items={life_jacket_equipment} />
            <DetailRow
                label="Lleva Balsas Salvavidas"
                value={dinghies_capacity.carried ? "Sí" : "No"}
            />
            {dinghies_capacity.carried && (
                <>
                    <DetailRow label="Cantidad de Balsas" value={String(dinghies_capacity.number)} />
                    <DetailRow label="Capacidad Total de Balsas" value={`${dinghies_capacity.total_capacity} personas`} />
                    <DetailRow label="Cubierta de Protección" value={dinghies_capacity.covered ? "Sí" : "No"} />
                    <DetailRow label="Color de Balsas" value={dinghies_capacity.color || ""} />
                </>
            )}
        </View>
    );
}