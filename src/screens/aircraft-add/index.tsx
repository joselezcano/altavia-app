import { FormNavigationButtons } from "@/components/form-navigation-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftTemplates } from "@/hooks/useAircraftTemplates";
import { useAuth } from "@/hooks/useAuth";
import { FormStep1, fieldsToValidate1 } from "@/screens/aircraft-add/components/form-step-1";
import { FormStep2, fieldsToValidate2 } from "@/screens/aircraft-add/components/form-step-2";
import { FormStep3, fieldsToValidate3 } from "@/screens/aircraft-add/components/form-step-3";
import { FormStep4 } from "@/screens/aircraft-add/components/form-step-4";
import { AircraftSpecs, AircraftSpecsSchema } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { AircraftTypeSuggestions } from "./components/suggestions";


export default function AddAircraftScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selector states
    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedTemplateName, setSelectedTemplateName] = useState("");
    const [isManualInput, setIsManualInput] = useState(false);

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

        setIsSubmitting(true);
        try {
            // Remove undefined values to prevent Firestore serialization crashes
            const cleanData = JSON.parse(JSON.stringify(data));

            // Save specifications into 'AircraftSpecs' collection with owner ID
            await addDoc(collection(db, "AircraftSpecs"), {
                ...cleanData,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
            });

            Toast.show({
                type: "success",
                text1: "Aeronave Registrada",
                text2: `Matrícula: ${data.basic_specs.registration}`,
            });

            router.back();
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
                {/* Header */}
                <View className="flex-row items-center justify-between mb-4 mt-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="flex-row items-center p-1"
                    >
                        <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
                        <ThemedText className="font-semibold text-brand-blue ml-1">
                            Cancelar
                        </ThemedText>
                    </TouchableOpacity>
                    <ThemedText className="font-bold text-brand-blue text-lg">
                        Registrar Aeronave
                    </ThemedText>
                    <View style={{ width: 60 }} />
                </View>

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
