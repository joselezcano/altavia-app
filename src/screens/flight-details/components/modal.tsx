import { ThemedText } from "@/components/themed-text";
import { getStatusBadge, INTERNAL_STATUS_DEFINITIONS } from "@/utils/flight-status";
import { Ionicons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";

export function FlightStatusModal({
    isStatusModalVisible,
    setIsStatusModalVisible,
    selectedStatus,
    setSelectedStatus,
    handleUpdateStatus,
    isUpdatingStatus,
}: {
    isStatusModalVisible: boolean;
    setIsStatusModalVisible: (visible: boolean) => void;
    selectedStatus: string;
    setSelectedStatus: (status: string) => void;
    handleUpdateStatus: () => void;
    isUpdatingStatus: boolean;
}) {
    return (
        <Modal
            visible={isStatusModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsStatusModalVisible(false)}
        >
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 max-h-[85%] border-t border-slate-200">
                    {/* Modal Header */}
                    <View className="flex-row items-center justify-between mb-4 border-b border-slate-100 pb-3">
                        <View>
                            <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[10px]">
                                Gestión de Operación
                            </ThemedText>
                            <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                                Cambiar Estado del Vuelo
                            </ThemedText>
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsStatusModalVisible(false)}
                            className="p-1.5 rounded-full bg-slate-100"
                        >
                            <Ionicons name="close" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Options List */}
                    <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                        <View className="gap-3 py-1">
                            {INTERNAL_STATUS_DEFINITIONS.map((def) => {
                                const badge = getStatusBadge(def.id);
                                const isSelected = selectedStatus === def.id;

                                return (
                                    <TouchableOpacity
                                        key={def.id}
                                        onPress={() => setSelectedStatus(def.id)}
                                        activeOpacity={0.8}
                                        className={`p-4 rounded-2xl border ${isSelected
                                            ? "border-brand-blue bg-blue-50/50"
                                            : "border-slate-200 bg-white"
                                            }`}
                                    >
                                        <View className="flex-row items-center justify-between mb-1.5">
                                            <View className={`${badge.bg} border ${badge.border} px-2.5 py-1 rounded-full flex-row items-center gap-1.5`}>
                                                <Ionicons name={badge.icon as any} size={12} color={badge.iconColor} />
                                                <ThemedText className={`text-xs font-bold ${badge.text}`}>
                                                    {def.label}
                                                </ThemedText>
                                            </View>
                                            <View
                                                className={`w-5 h-5 rounded-full border items-center justify-center ${isSelected
                                                    ? "border-brand-blue bg-brand-blue"
                                                    : "border-slate-300 bg-white"
                                                    }`}
                                            >
                                                {isSelected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                                            </View>
                                        </View>

                                        <ThemedText className="text-xs text-slate-500 font-medium leading-5 mt-1">
                                            {def.hint}
                                        </ThemedText>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Modal Actions */}
                    <View className="flex-row items-center gap-3 pt-2">
                        <TouchableOpacity
                            onPress={() => setIsStatusModalVisible(false)}
                            className="flex-1 py-3.5 rounded-xl border border-slate-300 items-center justify-center bg-white"
                            activeOpacity={0.8}
                            disabled={isUpdatingStatus}
                        >
                            <ThemedText className="text-xs font-bold text-slate-700">Cancelar</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleUpdateStatus}
                            className="flex-1 py-3.5 rounded-xl bg-brand-blue items-center justify-center shadow-sm flex-row gap-2"
                            activeOpacity={0.8}
                            disabled={isUpdatingStatus}
                        >
                            {isUpdatingStatus ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <ThemedText className="text-xs font-bold text-white">Guardar Estado</ThemedText>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}