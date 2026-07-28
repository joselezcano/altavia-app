import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AircraftSpecsDoc } from "@/hooks/useOwnerAircrafts";
import { usePilotAircrafts } from "@/hooks/usePilotAircrafts";
import { usePilotDetails } from "@/hooks/usePilotDetails";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ActivityIndicator,
    ScrollView,
    TouchableOpacity,
    View,
} from "react-native";

// Helper details row component
const DetailRow = ({ label, value }: { label: string; value: string }) => {
    return (
        <View className="flex-row justify-between py-2.5 border-b border-slate-100 items-start">
            <ThemedText type="caption" className="text-slate-500 font-medium mr-4">
                {label}
            </ThemedText>
            <ThemedText className="font-semibold text-slate-700 text-right flex-1">
                {value}
            </ThemedText>
        </View>
    );
};

export default function PilotDetailsScreen() {
    const router = useRouter();
    const { pilotUid } = useLocalSearchParams<{ pilotUid?: string }>();
    const uid = Array.isArray(pilotUid) ? pilotUid[0] : pilotUid;
    const { data: pilot, isLoading: isLoadingPilot, error } = usePilotDetails(uid);
    const { data: aircrafts = [], isLoading: isLoadingAircrafts } =
        usePilotAircrafts(pilot?.pilot_aircrafts);

    if (isLoadingPilot) {
        return (
            <ThemedView className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#0f1e3d" />
                <ThemedText className="text-slate-500 mt-2">
                    Cargando perfil del piloto...
                </ThemedText>
            </ThemedView>
        );
    }

    if (error || !pilot) {
        return (
            <ThemedView className="flex-1 px-4 justify-center items-center">
                <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
                    <Ionicons name="alert-circle" size={36} color="#EF4444" />
                </View>
                <ThemedText type="subtitle" className="text-center text-slate-800 mb-2">
                    Ocurrió un error
                </ThemedText>
                <ThemedText type="caption" className="text-center text-slate-500 mb-6">
                    {error ? error.message : "No se pudo encontrar el perfil del piloto."}
                </ThemedText>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-brand-blue px-6 py-2.5 rounded-xl flex-row items-center gap-2"
                >
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    <ThemedText className="text-white font-semibold">Regresar</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const profileName = `${pilot.user?.firstName || ""} ${pilot.user?.lastName || ""}`.trim() || "Piloto Registrado";
    const fullName = `${pilot.basic?.id_first_name || ""} ${pilot.basic?.id_last_name || ""}`.trim() || "Piloto Registrado";

    const formatDate = (d: any) => {
        if (!d) return "No especificada";
        const dateObj = typeof d?.toDate === "function" ? d.toDate() : new Date(d);
        if (isNaN(dateObj.getTime())) return "No especificada";
        return dateObj.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    const getLanguageLabel = (lang: string) => {
        switch (lang) {
            case "es":
                return "Español";
            case "en":
                return "Inglés";
            case "pt":
                return "Portugués";
            default:
                return "Otros";
        }
    };

    return (
        <ThemedView className="flex-1 px-4 pt-2">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 mt-2">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="flex-row items-center p-1"
                >
                    <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
                    <ThemedText className="font-semibold text-brand-blue ml-1">
                        Volver
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText className="font-bold text-brand-blue text-lg">
                    Perfil de Piloto
                </ThemedText>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Title Section Card */}
                <View className="bg-brand-blue rounded-3xl p-5 mb-4">
                    <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 pr-2">
                            <ThemedText className="font-bold text-xl text-white">
                                {profileName}
                            </ThemedText>
                            <ThemedText type="caption" className="text-slate-300 mt-0.5">
                                {pilot.user?.email}
                            </ThemedText>
                        </View>
                        {pilot.isEncargado && (
                            <View className="bg-brand-gold px-3 py-1 rounded-full">
                                <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                                    ENCARGADO
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </View>

                {/* 1. Datos Personales Card */}
                <ThemedView variant="card" className="p-5 mb-4 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="person" size={20} color="#0f1e3d" />
                        <ThemedText type="subtitle" className="font-bold text-brand-blue">
                            Identidad
                        </ThemedText>
                    </View>
                    <DetailRow label="Nombre Completo" value={fullName} />
                    <DetailRow
                        label="Tipo de Documento"
                        value={pilot.basic.id_type || "No especificado"}
                    />
                    <DetailRow
                        label="Número de Documento"
                        value={pilot.basic.id_number || "No especificado"}
                    />
                    <DetailRow
                        label="País de Expedición"
                        value={pilot.basic.id_country || "No especificado"}
                    />
                    <DetailRow
                        label="Nacionalidad"
                        value={pilot.basic.id_nationality || "No especificada"}
                    />
                    <DetailRow
                        label="Fecha de Nacimiento"
                        value={formatDate(pilot.basic.id_date_of_birth)}
                    />
                    <DetailRow
                        label="Teléfono"
                        value={pilot.basic.telephone || "No especificado"}
                    />
                </ThemedView>

                {/* 2. Información Aeronáutica Card */}
                <ThemedView variant="card" className="p-5 mb-4 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="ribbon" size={20} color="#0f1e3d" />
                        <ThemedText type="subtitle" className="font-bold text-brand-blue">
                            Licencia Aeronáutica
                        </ThemedText>
                    </View>
                    <DetailRow
                        label="Tipo de Licencia"
                        value={pilot.aeronautical.licence_type || "No especificado"}
                    />
                    <DetailRow
                        label="Número de Licencia"
                        value={pilot.aeronautical.pilot_licence || "No especificado"}
                    />
                    <DetailRow
                        label="Habilitaciones"
                        value={pilot.aeronautical.licence_permits || "Sin habilitaciones"}
                    />
                    <DetailRow
                        label="Emisor de Licencia"
                        value={pilot.aeronautical.licence_issuer || "No especificado"}
                    />
                </ThemedView>

                {/* 3. Información Adicional / Médica Card */}
                <ThemedView variant="card" className="p-5 mb-4 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="medkit" size={20} color="#0f1e3d" />
                        <ThemedText type="subtitle" className="font-bold text-brand-blue">
                            Más Información
                        </ThemedText>
                    </View>
                    <DetailRow
                        label="Certificado Médico (CMA)"
                        value={
                            pilot.other_information.aeronautical_medical_certificate ||
                            "No especificado"
                        }
                    />
                    <DetailRow
                        label="Horas de Vuelo Registradas"
                        value={
                            pilot.other_information.flight_hours !== undefined
                                ? `${pilot.other_information.flight_hours} hs`
                                : "No registradas"
                        }
                    />
                    <View className="py-2.5">
                        <ThemedText
                            type="caption"
                            className="text-slate-500 font-medium mb-1.5"
                        >
                            Idiomas
                        </ThemedText>
                        {pilot.other_information.languages?.length > 0 ? (
                            <View className="flex-row flex-wrap gap-1.5 mt-0.5">
                                {pilot.other_information.languages.map((lang) => (
                                    <View
                                        key={lang}
                                        className="bg-slate-100 border border-slate-200/65 px-2.5 py-1 rounded-md"
                                    >
                                        <ThemedText className="text-xs font-semibold text-slate-700">
                                            {getLanguageLabel(lang)}
                                        </ThemedText>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <ThemedText className="font-semibold text-slate-400 italic">
                                Ninguno registrado
                            </ThemedText>
                        )}
                    </View>
                </ThemedView>

                {/* 4. Read-Only List of Aircrafts the Pilot can fly */}
                <ThemedView variant="card" className="p-5 mb-6 border border-slate-100">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="airplane" size={20} color="#0f1e3d" />
                        <ThemedText type="subtitle" className="font-bold text-brand-blue">
                            Aeronaves que puede pilotar
                        </ThemedText>
                    </View>

                    {isLoadingAircrafts ? (
                        <View className="py-6 items-center">
                            <ActivityIndicator size="small" color="#0f1e3d" />
                            <ThemedText className="text-slate-500 text-xs mt-2">
                                Cargando aeronaves...
                            </ThemedText>
                        </View>
                    ) : aircrafts.length === 0 ? (
                        <View className="bg-slate-50 p-4 rounded-xl border border-slate-100 items-center py-6">
                            <Ionicons name="airplane-outline" size={28} color="#94A3B8" />
                            <ThemedText className="text-slate-500 italic text-center mt-2 text-sm">
                                Este piloto no tiene aeronaves asignadas para pilotar.
                            </ThemedText>
                        </View>
                    ) : (
                        <View className="gap-2.5 mt-1">
                            {aircrafts.map((ac: AircraftSpecsDoc) => (
                                <View
                                    key={ac.id}
                                    className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex-row justify-between items-center"
                                >
                                    <View className="flex-1 pr-2">
                                        <ThemedText className="font-bold text-brand-blue text-base">
                                            {ac.basic_specs.model}
                                        </ThemedText>
                                    </View>
                                    <View className="bg-brand-blue/10 px-3 py-1 rounded-full border border-brand-blue/20">
                                        <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
                                            {ac.basic_specs.registration}
                                        </ThemedText>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ThemedView>
            </ScrollView>
        </ThemedView>
    );
}
