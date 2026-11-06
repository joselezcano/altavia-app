import { FormNavigationButtons } from "@/components/form-navigation-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import { FormStep1, fieldsToValidate1 } from "@/screens/aircraft-add/components/form-step-1";
import { FormStep2, fieldsToValidate2 } from "@/screens/aircraft-add/components/form-step-2";
import { FormStep3, fieldsToValidate3 } from "@/screens/aircraft-add/components/form-step-3";
import { FormStep4 } from "@/screens/aircraft-add/components/form-step-4";
import { AircraftSpecs, AircraftSpecsSchema } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Toast from "react-native-toast-message";

const STEP_LABELS = ["Básicas", "Técnicas", "Operación", "Seguridad"];

/**
 * Edición de las especificaciones técnicas de una aeronave existente.
 * Reutiliza los pasos del formulario de alta. Solo actualiza las especificaciones:
 * nunca ownerId, pricing, fotos, base ni la tarifa (las reglas tampoco lo permitirían).
 * Pueden editar: el admin, el dueño de la aeronave y la encargada que la gestiona.
 */
export default function EditAircraftSpecsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: aircraft, isLoading } = useAircraftDetails(id);
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
        trigger,
        reset,
    } = useForm<AircraftSpecs>({
        resolver: zodResolver(AircraftSpecsSchema),
        mode: "onChange",
    });

    // Cargar los valores actuales en el formulario cuando llega la aeronave.
    useEffect(() => {
        if (aircraft) reset(aircraft as AircraftSpecs);
    }, [aircraft, reset]);

    const onSubmit = async (data: AircraftSpecs) => {
        if (!id) return;
        setIsSubmitting(true);
        try {
            // Solo las secciones de especificaciones (sin undefined, que Firestore rechaza).
            const payload = JSON.parse(
                JSON.stringify({
                    basic_specs: data.basic_specs,
                    technical_specs: data.technical_specs,
                    operating_specs: data.operating_specs,
                    emergency: data.emergency,
                    notes: data.notes ?? "",
                })
            );
            await updateDoc(doc(db, "AircraftSpecs", id), { ...payload, updatedAt: serverTimestamp() });

            queryClient.invalidateQueries({ queryKey: ["aircraft-details", id] });
            queryClient.invalidateQueries({ queryKey: ["owner-aircrafts"] });
            queryClient.invalidateQueries({ queryKey: ["managed-aircrafts"] });
            queryClient.invalidateQueries({ queryKey: ["all-aircrafts"] });

            Toast.show({ type: "success", text1: "Especificaciones actualizadas", text2: data.basic_specs.registration });
            router.back();
        } catch (error: any) {
            console.error("Error al actualizar las especificaciones de la aeronave:", error);
            Alert.alert("No se pudo guardar", error?.message || "Intentá nuevamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !aircraft) {
        return (
            <ThemedView className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#030436" />
            </ThemedView>
        );
    }

    const fieldsToValidate = [fieldsToValidate1, fieldsToValidate2, fieldsToValidate3];

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
            <ThemedView className="flex-1 px-4 pt-2">
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#030436" />
                        <Text style={styles.backText}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Editar {aircraft.basic_specs.registration}</Text>
                    <View style={{ width: 60 }} />
                </View>

                <View style={styles.stepsRow}>
                    {STEP_LABELS.map((label, idx) => {
                        const step = idx + 1;
                        const done = currentStep > step;
                        const active = currentStep === step;
                        return (
                            <TouchableOpacity
                                key={label}
                                style={styles.stepItem}
                                onPress={() => setCurrentStep(step)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.stepDot, active ? styles.stepDotActive : done ? styles.stepDotDone : null]}>
                                    <Text style={[styles.stepNumber, active || done ? styles.stepNumberOn : null]}>{step}</Text>
                                </View>
                                <ThemedText className="text-[9px] text-slate-500 mt-1 text-center font-medium">{label}</ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.flex}>
                    {currentStep === 1 && <FormStep1 control={control} errors={errors} />}
                    {currentStep === 2 && <FormStep2 control={control} errors={errors} />}
                    {currentStep === 3 && <FormStep3 control={control} errors={errors} />}
                    {currentStep === 4 && <FormStep4 control={control} errors={errors} />}

                    <FormNavigationButtons
                        currentStep={currentStep}
                        setCurrentStep={setCurrentStep}
                        isSubmitting={isSubmitting}
                        handleSubmit={handleSubmit(onSubmit)}
                        submitLabel="Guardar cambios"
                        submitIcon="save-outline"
                        fieldsToValidate={fieldsToValidate}
                        trigger={trigger}
                    />
                </ScrollView>
            </ThemedView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 8 },
    backBtn: { flexDirection: "row", alignItems: "center", padding: 4 },
    backText: { color: "#030436", fontWeight: "600", marginLeft: 4 },
    title: { color: "#030436", fontWeight: "700", fontSize: 17 },
    stepsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 8 },
    stepItem: { alignItems: "center", flex: 1 },
    stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#E2E8F0" },
    stepDotActive: { backgroundColor: "#030436" },
    stepDotDone: { backgroundColor: "#0165FF" },
    stepNumber: { fontSize: 13, fontWeight: "700", color: "#64748B" },
    stepNumberOn: { color: "#FFFFFF" },
});
