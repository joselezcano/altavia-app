import { ThemedText } from "@/components/themed-text";
import { Control, Controller, FieldErrors, FieldValues, Path } from "react-hook-form";
import {
    TouchableOpacity,
    View
} from "react-native";


interface SelectOneOptionProps<T extends FieldValues> {
    control: Control<T>
    errors: FieldErrors<T>
    label: string
    name: Path<T>
    options: string[]
}

function getErrorMessage(errors: Record<string, any>, path: string): string | undefined {
    const keys = path.split(".");
    let current: any = errors;
    for (const key of keys) {
        if (!current) return undefined;
        current = current[key];
    }
    return current?.message as string | undefined;
}


export function SelectOneOption<T extends FieldValues>({ control, errors, label, name, options }: SelectOneOptionProps<T>) {
    const errorMessage = getErrorMessage(errors, name);
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
            {errorMessage && (
                <ThemedText className="text-red-500 text-xs mt-1">
                    {errorMessage}
                </ThemedText>
            )}
        </View>
    );
}