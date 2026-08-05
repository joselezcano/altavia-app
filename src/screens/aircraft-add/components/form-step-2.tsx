import { CustomInput } from "@/components/custom-input";
import { SelectOneOption } from "@/components/select-one-option";
import { ThemedText } from "@/components/themed-text";
import { AircraftSpecs, EquipmentSchema, FlightRulesSchema, WakeTurbulenceCategorySchema } from "@/types/owner";
import { Control, FieldErrors } from "react-hook-form";
import {
    View
} from "react-native";


export const fieldsToValidate2 = [
    "technical_specs.flight_rules",
    "technical_specs.wake_turbulence_category",
    "technical_specs.equipment",
    "technical_specs.transponder",
    "technical_specs.fuel_capacity_gallons",
];


export function FormStep2({
    control,
    errors
}: {
    control: Control<AircraftSpecs>;
    errors: FieldErrors<AircraftSpecs>;
}) {
    return (
        <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                2. Especificaciones Técnicas
            </ThemedText>

            {/* Reglas de vuelo */}
            <SelectOneOption
                control={control}
                errors={errors}
                label="Reglas de Vuelo"
                name="technical_specs.flight_rules"
                options={FlightRulesSchema.options}
            />

            {/* Turbulencia de Estela */}
            <SelectOneOption
                control={control}
                errors={errors}
                label="Turbulencia de Estela"
                name="technical_specs.wake_turbulence_category"
                options={WakeTurbulenceCategorySchema.options}
            />

            {/* Equipamiento */}
            <CustomInput
                control={control}
                label="Equipamiento (1 o más letras)"
                name="technical_specs.equipment"
                enumSchema={EquipmentSchema}
                enumSeparator=", "
                placeholder=""
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Transpondedor */}
            <CustomInput
                control={control}
                label="Transpondedor (1 letra)"
                name="technical_specs.transponder"
                uppercase={true}
                placeholder=""
                maxLength={1}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Capacidad de Combustible Usable (Galones) */}
            <CustomInput
                control={control}
                label="Capacidad de Combustible Usable (Galones)"
                name="technical_specs.fuel_capacity_gallons"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />
        </View>
    );
}