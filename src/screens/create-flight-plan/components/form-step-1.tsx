import { ThemedText } from "@/components/themed-text";
import { EquipmentSchema, FlightRulesSchema, WakeTurbulenceCategorySchema } from "@/types/owner";
import { FlightPlan, FlightTypesSchema } from "@/types/pilot";
import { Control, FieldErrors } from "react-hook-form";
import {
    View
} from "react-native";
import { CustomInput } from "./custom-input";
import { SelectOneOption } from "./select-one-option";


export const fieldsToValidate1 = [
    "flight_plan.aircraft.registration",
    "flight_plan.aircraft.type",
    "flight_plan.aircraft.wake_turbulence",
    "flight_plan.aircraft.equipment",
    "flight_plan.aircraft.transponder",
    "flight_plan.flight_details.callsign",
    "flight_plan.flight_details.flight_rules",
    "flight_plan.flight_details.flight_type",
];


export function FormStep1({
    control,
    errors
}: {
    control: Control<FlightPlan>;
    errors: FieldErrors<FlightPlan>;
}) {
    return (
        <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                1. Especificaciones de la Aeronave
            </ThemedText>

            {/* Matrícula */}
            <CustomInput
                control={control}
                label="Matrícula (ej. ZPXYZ)"
                name="flight_plan.aircraft.registration"
                uppercase={true}
                placeholder=""
                maxLength={7}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Tipo de Aeronave */}
            <CustomInput
                control={control}
                label="Tipo de Aeronave [OACI] (ej. C172)"
                name="flight_plan.aircraft.type"
                uppercase={true}
                placeholder=""
                maxLength={4}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Turbulencia de Estela */}
            <SelectOneOption
                control={control}
                errors={errors}
                label="Turbulencia de Estela"
                name="flight_plan.aircraft.wake_turbulence"
                options={WakeTurbulenceCategorySchema.options}
            />

            {/* Equipamiento */}
            <CustomInput
                control={control}
                label="Equipamiento (1 o más letras)"
                name="flight_plan.aircraft.equipment"
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
                name="flight_plan.aircraft.transponder"
                uppercase={true}
                placeholder=""
                maxLength={1}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Indicativo de Llamada (Callsign) */}
            <CustomInput
                control={control}
                label="Indicativo de Llamada (Callsign)"
                name="flight_plan.flight_details.callsign"
                uppercase={true}
                placeholder=""
                maxLength={7}
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Reglas de vuelo */}
            <SelectOneOption
                control={control}
                errors={errors}
                label="Reglas de Vuelo"
                name="flight_plan.flight_details.flight_rules"
                options={FlightRulesSchema.options}
            />

            {/* Tipo de Vuelo */}
            <SelectOneOption
                control={control}
                errors={errors}
                label="Tipo de Vuelo"
                name="flight_plan.flight_details.flight_type"
                options={FlightTypesSchema.options}
            />
        </View>
    );
}