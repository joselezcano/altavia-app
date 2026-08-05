import { CustomInput } from "@/components/custom-input";
import { ThemedText } from "@/components/themed-text";
import { AircraftSpecs } from "@/types/owner";
import { Control, FieldErrors } from "react-hook-form";
import {
    View
} from "react-native";


export const fieldsToValidate1 = [
    "basic_specs.model",
    "basic_specs.type",
    "basic_specs.registration",
    "basic_specs.pax_count",
];


export function FormStep1({
    control,
    errors
}: {
    control: Control<AircraftSpecs>;
    errors: FieldErrors<AircraftSpecs>;
}) {
    return (
        <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                1. Especificaciones Básicas
            </ThemedText>

            {/* Modelo de Avión */}
            <CustomInput
                control={control}
                label="Modelo de Avión"
                name="basic_specs.model"
                placeholder=""
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Tipo de Aeronave */}
            <CustomInput
                control={control}
                label="Tipo de Aeronave [OACI] (ej. C172)"
                name="basic_specs.type"
                uppercase={true}
                placeholder=""
                maxLength={4}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Matrícula */}
            <CustomInput
                control={control}
                label="Matrícula (ej. ZPXYZ)"
                name="basic_specs.registration"
                uppercase={true}
                placeholder=""
                maxLength={7}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Cantidad de personas a bordo (Pax + pilotos) */}
            <CustomInput
                control={control}
                label="Personas a Bordo (POB)"
                name="basic_specs.pax_count"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />
        </View>
    );
}