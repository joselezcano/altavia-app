import { ThemedText } from "@/components/themed-text";
import type { AircraftSpecs } from "@/types/owner";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { TouchableOpacity, View } from "react-native";


export function AircraftToolBar({
    id,
    basic_specs,
}: {
    id: string;
    basic_specs: AircraftSpecs["basic_specs"];
}) {
    return (
        <View className="flex-col gap-1 mt-3">
            <View className="flex-row flex gap-8 px-4 mb-6">
                {/* 1. Calendario */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "./details/calendar",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    className="flex-1 bg-white p-3.5 rounded-2xl border border-slate-100 items-center justify-center shadow-sm"
                    activeOpacity={0.7}
                >
                    <View className="w-16 h-16 rounded-xl bg-slate-100 items-center justify-center mb-2">
                        <Ionicons name="calendar" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Calendario
                    </ThemedText>
                </TouchableOpacity>

                {/* 2. Ubicación Base */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "./details/base-airport",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    className="flex-1 bg-white p-3.5 rounded-2xl border border-slate-100 items-center justify-center shadow-sm"
                    activeOpacity={0.7}
                >
                    <View className="w-16 h-16 rounded-xl bg-slate-100 items-center justify-center mb-2">
                        <Ionicons name="location" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Ubicación Base
                    </ThemedText>
                </TouchableOpacity>
            </View>
            <View className="flex-row flex gap-8 px-4 mb-6">
                {/* 3. Pilotos */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "./details/pilots",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    className="flex-1 bg-white p-3.5 rounded-2xl border border-slate-100 items-center justify-center shadow-sm"
                    activeOpacity={0.7}
                >
                    <View className="w-16 h-16 rounded-xl bg-slate-100 items-center justify-center mb-2">
                        <MaterialCommunityIcons name="account-tie-hat" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Pilotos
                    </ThemedText>
                </TouchableOpacity>

                {/* 4. Especificaciones de la aeronave */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "./details/aircraft-specs",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    className="flex-1 bg-white p-3.5 rounded-2xl border border-slate-100 items-center justify-center shadow-sm"
                    activeOpacity={0.7}
                >
                    <View className="w-16 h-16 rounded-xl bg-slate-100 items-center justify-center mb-2">
                        <MaterialCommunityIcons name="airplane-cog" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Especificaciones
                    </ThemedText>
                </TouchableOpacity>
            </View>
            <View className="flex-row flex gap-8 px-4 mb-6">
                {/* 5. Fotos */}
                <TouchableOpacity
                    onPress={() => { }}
                    className="flex-1 bg-white p-3.5 rounded-2xl border border-slate-100 items-center justify-center shadow-sm"
                    activeOpacity={0.7}
                >
                    <View className="w-16 h-16 rounded-xl bg-slate-100 items-center justify-center mb-2">
                        <Ionicons name="images" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Fotos
                    </ThemedText>
                </TouchableOpacity>

                {/* 6. Button */}
                <TouchableOpacity
                    onPress={() => { }}
                    disabled
                    className="invisible flex-1 bg-white p-3.5 rounded-2xl border border-slate-100 items-center justify-center shadow-sm"
                    activeOpacity={0.7}
                >
                    <View className="w-16 h-16 rounded-xl bg-slate-100 items-center justify-center mb-2">
                        <Ionicons name="list" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Button
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
}