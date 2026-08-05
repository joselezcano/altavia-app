import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, Dispatch, SetStateAction } from "react";
import { UseFormTrigger } from "react-hook-form";
import { ActivityIndicator, Alert, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "./themed-text";


export function FormNavigationButtons({
    currentStep,
    setCurrentStep,
    isSubmitting,
    handleSubmit,
    submitLabel,
    submitIcon,
    fieldsToValidate,
    trigger,
}: {
    currentStep: number;
    setCurrentStep: Dispatch<SetStateAction<number>>;
    isSubmitting: boolean;
    handleSubmit: () => void;
    submitLabel: string;
    submitIcon?: ComponentProps<typeof Ionicons>["name"];
    fieldsToValidate: string[][];
    trigger: UseFormTrigger<any>;

}) {
    const insets = useSafeAreaInsets();

    const handleNext = async () => {
        const isValid = await trigger(fieldsToValidate[currentStep - 1] as any);

        if (isValid) {
            setCurrentStep((prev) => prev + 1);
        } else {
            Alert.alert("Campos requeridos o inválidos", "Por favor corrige los errores antes de continuar.");
        }
    };

    return (
        <View
            style={{ paddingBottom: insets.bottom }}
            className="flex-row gap-3 mt-2 bg-brand-light">
            {currentStep > 1 && (
                <TouchableOpacity
                    onPress={() => setCurrentStep((prev) => prev - 1)}
                    disabled={isSubmitting}
                    className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center justify-center border border-slate-200"
                >
                    <ThemedText className="text-slate-700 font-bold">
                        Anterior
                    </ThemedText>
                </TouchableOpacity>
            )}

            {currentStep < fieldsToValidate.length + 1 ? (
                <TouchableOpacity
                    onPress={handleNext}
                    className="flex-1 bg-brand-blue py-3.5 rounded-xl items-center justify-center"
                >
                    <ThemedText className="text-white font-bold">
                        Siguiente
                    </ThemedText>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-brand-gold py-3.5 rounded-xl items-center justify-center flex-row gap-2"
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            {submitIcon && <Ionicons name={submitIcon} size={20} color="#FFFFFF" />}
                            <ThemedText className="text-white font-bold">
                                {submitLabel}
                            </ThemedText>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}