import { ScreenHeader } from "@/components/screen-header";
import { FormNavigationButtons } from "@/components/form-navigation-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftTemplates } from "@/hooks/useAircraftTemplates";
import { USER_ROLE, useAuth } from "@/hooks/useAuth";
import { usePilotOwners } from "@/hooks/usePilotOwners";
import { FormStep1, fieldsToValidate1 } from "@/screens/aircraft-add/components/form-step-1";
import { FormStep2, fieldsToValidate2 } from "@/screens/aircraft-add/components/form-step-2";
import { FormStep3, fieldsToValidate3 } from "@/screens/aircraft-add/components/form-step-3";
import { FormStep4 } from "@/screens/aircraft-add/components/form-step-4";
import { AircraftSpecs, AircraftSpecsSchema } from "@/types/owner";
import { showNotice } from "@/utils/dialogs";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { AircraftTypeSuggestions } from "./components/suggestions";


// TODO: Guardar tipos nuevos de aeronaves para autocompletar en el futuro
export default function AddAircraftScreen() {
    const { user, role, profileData, refreshProfileData } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selector states
    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedTemplateName, setSelectedTemplateName] = useState("");
    const [isManualInput, setIsManualInput] = useState(false);

    // Alta por la encargada (rol PILOT): la aeronave se registra a nombre de uno de
    // sus propietarios (profileData.owner_ids), no a su nombre.
    const isEncargadaFlow = role === USER_ROLE.PILOT;
    const encargadaOwnerIds: string[] =
        isEncargadaFlow && Array.isArray(profileData?.owner_ids) ? profileData.owner_ids : [];
    const { data: encargadaOwners = [] } = usePilotOwners(encargadaOwnerIds);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
    const targetOwnerId: string | null = isEncargadaFlow
        ? selectedOwnerId ?? (encargadaOwnerIds.length === 1 ? encargadaOwnerIds[0] : null)
        : user?.uid ?? null;
    const ownerName = (uid: string) =>
        encargadaOwners.find((o) => o.uid === uid)?.displayName || "Propietario";

    const defaultValues: AircraftSpecs = {
        basic_specs: {
            model: "",
            type: "",
            registration: "",
            pax_count: 0
        },
        technical_specs: {
            equipment: [],
            transponder: "",
            flight_rules: "IFR",
            wake_turbulence_category: "L",
            fuel_capacity_gallons: 0
        },
        operating_specs: {
            cruise_speed_knots: 0,
            fuel_burn_rate_gph: 0,
            service_ceiling_feet: 0,
            max_takeoff_weight_lbs: 0,
            takeoff_distance_feet: 0,
            landing_distance_feet: 0,
            rate_of_climb_fpm: 0
        },
        emergency: {
            radio_equipment: [],
            survival_equipment: [],
            life_jacket_equipment: [],
            dinghies_capacity: {
                carried: false,
                number: 0,
                total_capacity: 0,
                covered: false,
                color: "",
            }
        },
    };

    const {
        control,
        handleSubmit,
        formState: { errors },
        trigger,
        setValue,
    } = useForm<AircraftSpecs>({
        resolver: zodResolver(AircraftSpecsSchema),
        defaultValues,
        mode: "onChange",
    });

    const { data: templates = [], isLoading } = useAircraftTemplates();

    const onSubmit = async (data: AircraftSpecs) => {
        if (!user) {
            Alert.alert("Error", "No tienes una sesión activa.");
            return;
        }

        if (isEncargadaFlow) {
            if (profileData?.isEncargado !== true) {
                Alert.alert("Sin permiso", "Solo un piloto encargado puede registrar aeronaves.");
                return;
            }
            if (!targetOwnerId) {
                Alert.alert(
                    "Propietario requerido",
                    encargadaOwnerIds.length === 0
                        ? "No estás vinculado a ningún propietario."
                        : "Elegí a nombre de qué propietario se registra la aeronave."
                );
                setCurrentStep(1);
                return;
            }
        }

        if (!targetOwnerId) {
            Alert.alert("Error", "No se pudo determinar el propietario de la aeronave.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Remove undefined values to prevent Firestore serialization crashes
            const cleanData = JSON.parse(JSON.stringify(data));

            // Save specifications into 'AircraftSpecs' collection with owner ID
            const newDocRef = await addDoc(collection(db, "AircraftSpecs"), {
                ...cleanData,
                ownerId: targetOwnerId,
                // Si la crea una encargada, el servidor (assignAircraftToCreator) se la agrega a managed_aircrafts.
                createdBy: user?.uid ?? null,
                createdAt: serverTimestamp(),
            });

            queryClient.invalidateQueries({ queryKey: ["owner-aircrafts", targetOwnerId] });

            if (isEncargadaFlow) {
                // La app no puede agregarla a managed_aircrafts (las reglas solo permiten renunciar):
                // lo hace el servidor al detectar que la creó una encargada de ese propietario.
                await showNotice(
                    "Aeronave registrada",
                    `${data.basic_specs.registration} quedó registrada a nombre de ${ownerName(targetOwnerId)} ` +
                    "y se agregó a tu flota a cargo."
                );
                await refreshProfileData();
                queryClient.invalidateQueries({ queryKey: ["managed-aircrafts"] });
                router.back();
                return;
            }

            Toast.show({
                type: "success",
                text1: "Aeronave Registrada",
                text2: `Matrícula: ${data.basic_specs.registration}`,
            });

            // Redirect directly to details to allow base airport and photos setup
            router.replace({
                pathname: "/aircrafts/details",
                params: { id: newDocRef.id },
            });
        } catch (error: any) {
            console.error("Error creating aircraft specification:", error);
            Alert.alert("Error", error.message || "No se pudo registrar la aeronave.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Always fill fieldsToValidate for all steps, except the last one.
    // Verify that fieldsToValidate.length + 1 = number of form steps
    const fieldsToValidate = [fieldsToValidate1, fieldsToValidate2, fieldsToValidate3];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 bg-brand-light"
            style={{ paddingTop: insets.top }}
        >
            <ThemedView className="flex-1 px-4">
                <ScreenHeader title="Registrar aeronave" subtitle={`Paso ${currentStep} de 4`} withInset={false} />

                {/* Step Indicator */}
                <View className="flex-row justify-between mb-6 px-2">
                    {[1, 2, 3, 4].map((step) => (
                        <View key={step} className="items-center flex-1">
                            <View
                                className={`w-8 h-8 rounded-full items-center justify-center font-bold ${currentStep === step
                                    ? "bg-brand-blue"
                                    : currentStep > step
                                        ? "bg-brand-gold"
                                        : "bg-slate-200"
                                    }`}
                            >
                                <ThemedText
                                    className={`text-sm font-bold ${currentStep >= step ? "text-white" : "text-slate-500"
                                        }`}
                                >
                                    {step}
                                </ThemedText>
                            </View>
                            <ThemedText className="text-[9px] text-slate-500 mt-1 text-center font-medium">
                                {step === 1 ? "Básicas" : step === 2 ? "Técnicas" : step === 3 ? "Operación" : "Seguridad"}
                            </ThemedText>
                        </View>
                    ))}
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                    {/* Propietario de la aeronave (solo alta por la encargada) */}
                    {currentStep === 1 && isEncargadaFlow && (
                        <View style={ownerStyles.card}>
                            <Text style={ownerStyles.label}>Propietario de la aeronave</Text>
                            {encargadaOwnerIds.length === 0 ? (
                                <Text style={ownerStyles.warning}>
                                    No estás vinculado a ningún propietario: no podés registrar aeronaves.
                                </Text>
                            ) : encargadaOwnerIds.length === 1 ? (
                                <Text style={ownerStyles.value}>{ownerName(encargadaOwnerIds[0])}</Text>
                            ) : (
                                <View style={ownerStyles.chipsRow}>
                                    {encargadaOwnerIds.map((uid) => {
                                        const isSelected = targetOwnerId === uid;
                                        return (
                                            <TouchableOpacity
                                                key={uid}
                                                onPress={() => setSelectedOwnerId(uid)}
                                                style={[ownerStyles.chip, isSelected && ownerStyles.chipSelected]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[ownerStyles.chipText, isSelected && ownerStyles.chipTextSelected]}>
                                                    {ownerName(uid)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                            <Text style={ownerStyles.hint}>
                                Al guardarla, queda a cargo tuyo automáticamente.
                            </Text>
                        </View>
                    )}

                    {/* Autocomplete Search Input */}
                    {currentStep === 1 && <AircraftTypeSuggestions
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        showSuggestions={showSuggestions}
                        setShowSuggestions={setShowSuggestions}
                        setIsManualInput={setIsManualInput}
                        setValue={setValue}
                        templates={templates}
                        setSelectedTemplateName={setSelectedTemplateName}
                    />}

                    {/* Show basic fields only if a template is applied or manual input is active */}

                    {/* STEP 1: Basic specs */}
                    {currentStep === 1 && (isManualInput || !!selectedTemplateName) && <FormStep1 control={control} errors={errors} />}

                    {/* STEP 2: Technical specs */}
                    {currentStep === 2 && <FormStep2 control={control} errors={errors} />}

                    {/* STEP 3: Operating specs */}
                    {currentStep === 3 && <FormStep3 control={control} errors={errors} />}

                    {/* STEP 4: Emergency & Safety Equipment */}
                    {currentStep === 4 && <FormStep4 control={control} errors={errors} />}


                    {/* Form Navigation Buttons */}
                    <FormNavigationButtons
                        currentStep={currentStep}
                        setCurrentStep={setCurrentStep}
                        isSubmitting={isSubmitting}
                        handleSubmit={handleSubmit(onSubmit)}
                        submitLabel="Guardar Flota"
                        submitIcon="save-outline"
                        fieldsToValidate={fieldsToValidate}
                        trigger={trigger}
                    />
                </ScrollView>
            </ThemedView>
        </KeyboardAvoidingView>
    );
}

const ownerStyles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#F1F5F9",
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        gap: 8,
    },
    label: {
        fontSize: 12,
        fontFamily: "NotoSans_700Bold",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 16,
        fontFamily: "NotoSans_700Bold",
        color: "#030436",
    },
    warning: {
        fontSize: 14,
        fontFamily: "NotoSans_600SemiBold",
        color: "#B91C1C",
    },
    hint: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: "#64748B",
    },
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#F8FAFC",
    },
    chipSelected: {
        backgroundColor: "#030436",
        borderColor: "#030436",
    },
    chipText: {
        fontSize: 13,
        fontFamily: "NotoSans_600SemiBold",
        color: "#334155",
    },
    chipTextSelected: {
        color: "#FFFFFF",
    },
});
