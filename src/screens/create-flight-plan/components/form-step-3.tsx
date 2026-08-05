import { CustomInput } from "@/components/custom-input";
import { ThemedText } from "@/components/themed-text";
import { EmergencyRadioSchema, LifeJacketSchema, SurvivalEquipmentSchema } from "@/types/owner";
import { FlightPlan } from "@/types/pilot";
import { Control, Controller, FieldErrors, useWatch } from "react-hook-form";
import {
    Switch,
    View
} from "react-native";


export const fieldsToValidate3 = [
    "flight_plan.performance.eet_hours",
    "flight_plan.performance.eet_minutes",
    "flight_plan.performance.fuel_hours",
    "flight_plan.performance.fuel_minutes",
    "flight_plan.emergency.pax_count",
    "flight_plan.emergency.radio_equipment",
    "flight_plan.emergency.survival_equipment",
    "flight_plan.emergency.life_jacket_equipment",
    "flight_plan.emergency.dinghies_capacity",
];


export function FormStep3({
    control,
    errors
}: {
    control: Control<FlightPlan>;
    errors: FieldErrors<FlightPlan>;
}) {
    const dinghiesCarried = useWatch({
        control,
        name: "flight_plan.emergency.dinghies_capacity.carried",
    });

    return (<View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
            3. Rendimiento y Seguridad
        </ThemedText>

        {/* Tiempo Estimado (EET) */}
        <View className="flex-row gap-3">
            <CustomInput
                control={control}
                label="EET Horas"
                name="flight_plan.performance.eet_hours"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            <CustomInput
                control={control}
                label="EET Minutos"
                name="flight_plan.performance.eet_minutes"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />
        </View>

        {/* Combustible a Bordo */}
        <View className="flex-row gap-3">
            <CustomInput
                control={control}
                label="Combustible Horas"
                name="flight_plan.performance.fuel_hours"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />

            <CustomInput
                control={control}
                label="Combustible Minutos"
                name="flight_plan.performance.fuel_minutes"
                integer={true}
                placeholder=""
                keyboardType="numeric"
                enableKeyboardSuggestions={false}
                errors={errors}
            />
        </View>

        {/* Cantidad de personas a bordo (Pax + pilotos) */}
        <CustomInput
            control={control}
            label="Personas a Bordo (POB)"
            name="flight_plan.emergency.pax_count"
            integer={true}
            placeholder=""
            keyboardType="numeric"
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Radio de Emergencia */}
        <CustomInput
            control={control}
            label="Radio de Emergencia"
            name="flight_plan.emergency.radio_equipment"
            enumSchema={EmergencyRadioSchema}
            enumSeparator=", "
            placeholder=""
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Equipos de Supervivencia */}
        <CustomInput
            control={control}
            label="Equipos de Supervivencia"
            name="flight_plan.emergency.survival_equipment"
            enumSchema={SurvivalEquipmentSchema}
            enumSeparator=", "
            placeholder=""
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Chalecos Salvavidas */}
        <CustomInput
            control={control}
            label="Chalecos Salvavidas"
            name="flight_plan.emergency.life_jacket_equipment"
            enumSchema={LifeJacketSchema}
            enumSeparator=", "
            placeholder=""
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* ¿Lleva Balsas Salvavidas? */}
        <View className="flex-row justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-2">
            <View className="flex-1 pr-4">
                <ThemedText className="font-bold text-sm text-brand-blue">¿Lleva balsas salvavidas?</ThemedText>
                <ThemedText type="caption" className="text-[11px] text-slate-500 mt-0.5">
                    Activar si el avión cuenta con balsas de emergencia a bordo.
                </ThemedText>
            </View>
            <Controller
                control={control}
                name="flight_plan.emergency.dinghies_capacity.carried"
                render={({ field: { onChange, value } }) => (
                    <Switch
                        value={value}
                        onValueChange={onChange}
                        trackColor={{ false: "#CBD5E1", true: "#0f1e3d" }}
                        thumbColor="#F1F5F9"
                    />
                )}
            />
        </View>

        {/* Detalles de Balsas */}
        {dinghiesCarried && (
            <View className="bg-white rounded-xl p-4 border border-slate-200 gap-3 mt-2">
                <ThemedText className="font-bold text-xs text-brand-blue uppercase tracking-wider">
                    Detalles de Balsas
                </ThemedText>

                {/* Cantidad de Balsas */}
                <CustomInput
                    control={control}
                    label="Cantidad de Balsas"
                    name="flight_plan.emergency.dinghies_capacity.number"
                    integer={true}
                    placeholder=""
                    keyboardType="numeric"
                    enableKeyboardSuggestions={false}
                    errors={errors}
                />

                {/* Capacidad Combinada Total (Personas) */}
                <CustomInput
                    control={control}
                    label="Capacidad Combinada Total (Personas)"
                    name="flight_plan.emergency.dinghies_capacity.total_capacity"
                    integer={true}
                    placeholder=""
                    keyboardType="numeric"
                    enableKeyboardSuggestions={false}
                    errors={errors}
                />

                {/* ¿Tienen cubierta de protección? */}
                <View className="flex-row justify-between items-center bg-white border border-slate-200 rounded-lg px-3 py-2 mt-2 mb-1">
                    <ThemedText type="caption" className="font-bold text-xs">¿Tienen cubierta de protección?</ThemedText>
                    <Controller
                        control={control}
                        name="flight_plan.emergency.dinghies_capacity.covered"
                        render={({ field: { onChange, value } }) => (
                            <Switch
                                value={value}
                                onValueChange={onChange}
                                trackColor={{ false: "#CBD5E1", true: "#0f1e3d" }}
                                thumbColor="#F1F5F9"
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                        )}
                    />
                </View>

                {/* Color de Balsas */}
                <CustomInput
                    control={control}
                    label="Color de Balsas"
                    name="flight_plan.emergency.dinghies_capacity.color"
                    uppercase={true}
                    placeholder=""
                    enableKeyboardSuggestions={false}
                    errors={errors}
                />
            </View>
        )}
    </View>
    );
}