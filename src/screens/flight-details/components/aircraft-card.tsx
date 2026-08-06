import { ThemedText } from "@/components/themed-text";
import { StatusBadge } from "@/utils/flight-status";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Image,
    TouchableOpacity,
    View
} from "react-native";


export function AircraftCard({
    model,
    aircraftType,
    registration,
    status,
    onStatusChange,
    profilePhoto,
}: {
    model: string;
    aircraftType: string;
    registration: string;
    status: StatusBadge;
    onStatusChange?: () => void;
    profilePhoto?: string | null;
}) {
    const [imageError, setImageError] = useState(false);
    const showPhoto = Boolean(profilePhoto && !imageError);

    return (
        <View className="bg-brand-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Aircraft Profile Photo / Header Banner */}
            <View className="h-44 w-full bg-slate-900 relative justify-center items-center overflow-hidden">
                {showPhoto ? (
                    <Image
                        source={{ uri: profilePhoto! }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <View className="w-full h-full bg-brand-blue justify-center items-center relative">
                        {/* Decorative background glow rings */}
                        <View className="absolute w-36 h-36 rounded-full bg-white/5 -top-10 -right-10" />
                        <View className="absolute w-24 h-24 rounded-full bg-brand-gold/10 -bottom-6 -left-6" />
                        <View className="w-16 h-16 rounded-full bg-white/10 items-center justify-center border border-white/20">
                            <Ionicons name="airplane" size={32} color="#DAA520" />
                        </View>
                    </View>
                )}

                {/* Floating Top Pills */}
                <View className="absolute top-3 left-3 right-3 flex-row justify-between items-center">
                    {aircraftType ? (
                        <View className="bg-black/60 px-3 py-1 rounded-full border border-white/10">
                            <ThemedText className="text-white text-xs font-bold tracking-wider uppercase">
                                {aircraftType}
                            </ThemedText>
                        </View>
                    ) : (
                        <View />
                    )}

                    <View className="bg-brand-gold px-3 py-1 rounded-full shadow-sm">
                        <ThemedText className="text-brand-blue text-xs font-extrabold tracking-wider uppercase">
                            {registration}
                        </ThemedText>
                    </View>
                </View>
            </View>

            {/* Card Content Body */}
            <View className="p-5">
                <View className="flex-row items-start justify-between gap-3 mb-1">
                    <View className="flex-1">
                        <ThemedText className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            Aeronave
                        </ThemedText>
                        <ThemedText type="subtitle" className="text-brand-blue font-extrabold text-xl" numberOfLines={1}>
                            {model}
                        </ThemedText>
                    </View>
                </View>

                {/* Footer Action */}
                {onStatusChange && (
                    <View className="border-t border-slate-100 mt-4 pt-3 flex-row items-center justify-between">
                        <View className="flex-col items-center gap-3 mt-1">
                            <ThemedText className="text-xs text-slate-500 font-medium">
                                Estado del vuelo
                            </ThemedText>

                            {/* Status Badge */}
                            <View className={`${status.bg} border ${status.border} px-3 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-sm`}>
                                <Ionicons name={status.icon as any} size={13} className={status.text} color={status.iconColor} />
                                <ThemedText className={`text-xs font-bold ${status.text}`}>
                                    {status.label}
                                </ThemedText>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={onStatusChange}
                            className="shadow-sm bg-brand-blue px-4 py-2 rounded-full flex-row items-center gap-1.5"
                            activeOpacity={0.8}
                        >
                            <Ionicons name="pencil" size={12} color="#FFFFFF" />
                            <ThemedText className="text-sm font-bold text-white">
                                Cambiar estado
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}