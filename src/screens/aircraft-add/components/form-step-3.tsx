import { CustomInput } from "@/components/custom-input";
import { ThemedText } from "@/components/themed-text";
import { AircraftSpecs } from "@/types/owner";
import { Control, FieldErrors } from "react-hook-form";
import {
    View
} from "react-native";


export const fieldsToValidate3 = [
    "operating_specs.cruise_speed_knots",
    "operating_specs.fuel_burn_rate_gph",
    "operating_specs.service_ceiling_feet",
    "operating_specs.max_takeoff_weight_lbs",
    "operating_specs.takeoff_distance_feet",
    "operating_specs.landing_distance_feet",
    "operating_specs.rate_of_climb_fpm",
];


export function FormStep3({
    control,
    errors
}: {
    control: Control<AircraftSpecs>;
    errors: FieldErrors<AircraftSpecs>;
}) {
    return (
        <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
            <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
                3. Especificaciones de Operación
            </ThemedText>

            {/* Velocidad de Crucero (Nudos) */}
            <CustomInput
                control={control}
                label="Velocidad de Crucero (Nudos)"
                name="operating_specs.cruise_speed_knots"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Régimen de Consumo de Combustible (GPH) */}
            <CustomInput
                control={control}
                label="Régimen de Consumo de Combustible (GPH)"
                name="operating_specs.fuel_burn_rate_gph"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Techo de Servicio (Pies) */}
            <CustomInput
                control={control}
                label="Techo de Servicio (Pies)"
                name="operating_specs.service_ceiling_feet"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Peso Máximo al Despegue (Libras) */}
            <CustomInput
                control={control}
                label="Peso Máximo al Despegue (Libras)"
                name="operating_specs.max_takeoff_weight_lbs"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Distancia de Despegue (Pies) */}
            <CustomInput
                control={control}
                label="Distancia de Despegue (Pies)"
                name="operating_specs.takeoff_distance_feet"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Distancia de Aterrizaje (Pies) */}
            <CustomInput
                control={control}
                label="Distancia de Aterrizaje (Pies)"
                name="operating_specs.landing_distance_feet"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            {/* Velocidad de Ascenso (Pies por Minuto) */}
            <CustomInput
                control={control}
                label="Velocidad de Ascenso (Pies por Minuto)"
                name="operating_specs.rate_of_climb_fpm"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />
        </View>
    );
}