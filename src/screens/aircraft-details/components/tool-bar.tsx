import { ThemedText } from "@/components/themed-text";
import { USER_ROLE, useAuth } from "@/hooks/useAuth";
import type { AircraftSpecs } from "@/types/owner";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export function AircraftToolBar({
    id,
    basic_specs,
}: {
    id: string;
    basic_specs: AircraftSpecs["basic_specs"];
}) {
    const { role } = useAuth();
    const isOwner = role === USER_ROLE.OWNER;

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                {/* 1. Calendario */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "/aircrafts/details/calendar",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    style={styles.card}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconBox}>
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
                            pathname: "/aircrafts/details/base-airport",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    style={styles.card}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconBox}>
                        <Ionicons name="location" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Ubicación Base
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <View style={styles.row}>
                {/* 3. Pilotos */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "/aircrafts/details/pilots",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    style={styles.card}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconBox}>
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
                            pathname: "/aircrafts/details/aircraft-specs",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    style={styles.card}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconBox}>
                        <MaterialCommunityIcons name="airplane-cog" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Especificaciones
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <View style={styles.row}>
                {/* 5. Fotos */}
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "/aircrafts/details/photos",
                            params: {
                                id,
                                model: basic_specs.model,
                                registration: basic_specs.registration,
                            },
                        });
                    }}
                    style={styles.card}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconBox}>
                        <Ionicons name="images" size={28} color="#0f1e3d" />
                    </View>
                    <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                        Fotos
                    </ThemedText>
                </TouchableOpacity>

                {/* 6. Rentabilidad y Costos (Exclusivo para el rol OWNER) */}
                {isOwner ? (
                    <TouchableOpacity
                        onPress={() => {
                            router.push({
                                pathname: "/(owner)/finances",
                                params: {
                                    aircraftId: id,
                                },
                            });
                        }}
                        style={styles.card}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconBoxBlue}>
                            <MaterialCommunityIcons name="finance" size={28} color="#1540C9" />
                        </View>
                        <ThemedText className="text-sm font-semibold text-slate-700 text-center">
                            Rentabilidad y Costos
                        </ThemedText>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.invisibleCard} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        gap: 4,
    },
    row: {
        flexDirection: "row",
        gap: 24,
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    card: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
        elevation: 1,
        shadowColor: "#0f1e3d",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    invisibleCard: {
        flex: 1,
        opacity: 0,
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    iconBoxBlue: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: "#EEF3FE",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
});
