import { ThemedText } from "@/components/themed-text";
import { FlightPlan } from "@/types/pilot";
import { Control, Controller, FieldErrors, Path } from "react-hook-form";
import {
    TouchableOpacity,
    View
} from "react-native";


interface SelectOneOptionProps {
    control: Control<FlightPlan>
    errors: FieldErrors<FlightPlan>
    label: string
    name: Path<FlightPlan>
    options: string[]
}


export function SelectOneOption({ control, errors, label, name, options }: SelectOneOptionProps) {
    return (
        <View>
            <ThemedText type="caption" className="font-bold mb-1.5">{label}</ThemedText>
            <Controller
                control={control}
                name={name}
                render={({ field: { onChange, value } }) => (
                    <View className="flex-row gap-2">
                        {options.map((level) => (
                            <TouchableOpacity
                                key={level}
                                onPress={() => onChange(level)}
                                className={`flex-1 py-2.5 rounded-lg border items-center ${value === level
                                    ? "bg-brand-blue border-brand-blue"
                                    : "bg-slate-50 border-slate-200"
                                    }`}
                            >
                                <ThemedText
                                    className={`font-semibold ${value === level ? "text-white" : "text-slate-600"
                                        }`}
                                >
                                    {level}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            />
            {errors.flight_plan?.aircraft?.wake_turbulence && (
                <ThemedText className="text-red-500 text-xs mt-1">
                    {errors.flight_plan.aircraft.wake_turbulence.message}
                </ThemedText>
            )}
        </View>
    );
}