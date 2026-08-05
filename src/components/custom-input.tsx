import { ThemedText } from "@/components/themed-text";
import { Control, Controller, FieldErrors, FieldValues, Path } from "react-hook-form";
import { TextInput, View } from "react-native";
import { z } from "zod";


interface CustomInputProps<T extends FieldValues> {
    control: Control<T>;
    label?: string;
    name: Path<T>;
    integer?: boolean;
    uppercase?: boolean;
    enumSchema?: z.ZodEnum<any>;
    enumSeparator?: string;
    route?: boolean;
    placeholder: string;
    maxLength?: number;
    multiline?: boolean;
    numberOfLines?: number;
    keyboardType?: "default" | "numeric";
    enableKeyboardSuggestions?: boolean;
    textContentType?: "username" | "password" | "emailAddress" | "name" | "telephoneNumber" | "none";
    errors: FieldErrors<T>;
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


export function CustomInput<T extends FieldValues>({ control, name, placeholder, maxLength, errors, label, integer, uppercase, enumSchema, enumSeparator, route, keyboardType = "default", enableKeyboardSuggestions = true, textContentType = "none", multiline = false, numberOfLines = 1 }: CustomInputProps<T>) {

    const getDisplayValue = (value: any): string => {
        const separator = route ? " " : ", ";
        if (Array.isArray(value)) {
            return value.join(enumSeparator || separator);
        } else if (typeof value === "string") {
            return value;
        } else if (typeof value === "number") {
            return String(value);
        } else {
            return "";
        }
    }

    const handleChange = (value: any, onChange: (...event: any[]) => void) => {
        if (integer) {
            onChangeInteger(value, onChange);
        } else if (uppercase) {
            onChangeUppercase(value, onChange);
        } else if (enumSchema) {
            onChangeEnum(value, enumSchema, onChange);
        } else if (route) {
            onChangeRoute(value, onChange);
        } else {
            onChange(value);
        }
    }

    const errorMessage = getErrorMessage(errors, name);

    return (
        <View>
            {label && <ThemedText type="caption" className="font-bold mb-1">{label}</ThemedText>}
            <Controller
                control={control}
                name={name}
                render={({ field: { onChange, value } }) => (
                    <TextInput
                        value={getDisplayValue(value)}
                        onChangeText={(value) => handleChange(value, onChange)}
                        placeholder={placeholder}
                        placeholderTextColor="#94A3B8"
                        maxLength={maxLength}
                        // No autocompletion or keyboard hints
                        autoCorrect={enableKeyboardSuggestions}
                        spellCheck={enableKeyboardSuggestions}
                        importantForAutofill={enableKeyboardSuggestions ? "auto" : "no"}
                        textContentType={textContentType ? textContentType : "none"}
                        keyboardType={keyboardType ? keyboardType : "default"}
                        multiline={multiline}
                        numberOfLines={numberOfLines}
                        style={multiline ? { height: 100, textAlignVertical: "top" } : {}}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                    />
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


function onChangeInteger(value: string, onChange: (...event: any[]) => void) {
    const parsed = parseInt(value, 10);
    onChange(isNaN(parsed) ? 0 : parsed);
}

function onChangeUppercase(value: string, onChange: (...event: any[]) => void) {
    onChange(value.toUpperCase())
}

function onChangeEnum(value: string, enumSchema: z.ZodEnum<any>, onChange: (...event: any[]) => void) {
    // Map val into letters
    const letters = value.split("").map((letter) => letter.toUpperCase());
    // Check that each letter complies with the schema
    const validParts = new Set(letters.filter((part) => enumSchema.safeParse(part).success));
    onChange([...validParts]);
}

function onChangeRoute(value: string, onChange: (...event: any[]) => void) {
    const waypoints = value.toLocaleUpperCase().replace(".", "").split(/\s+/).filter(Boolean);
    if (value.endsWith(" ")) {
        onChange(waypoints.concat(""));
    } else {
        onChange(waypoints);
    }
}
