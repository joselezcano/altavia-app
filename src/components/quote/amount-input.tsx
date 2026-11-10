import { BRAND_COLORS, BRAND_RADII } from "@/constants/brand";
import { AmountInputProps } from "@/types/quote-ui";
import { brandFont } from "@/utils/brand-fonts";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

const parse = (t: string) => {
    const n = parseFloat(t.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};
const format = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0");

/**
 * Input de monto en USD. Guarda el texto mientras se escribe (para permitir "12." o vacío)
 * y avisa el número; si el valor cambia desde afuera (ej. "usar sugerido" o un recálculo),
 * se actualiza el texto durante el render (sin useEffect).
 */
export function AmountInput({ value, onChange, placeholder = "0", large = false, editable = true }: AmountInputProps) {
    const [text, setText] = useState(format(value));
    const [lastValue, setLastValue] = useState(value);

    if (value !== lastValue) {
        setLastValue(value);
        if (Math.abs(parse(text) - value) > 0.004) setText(format(value));
    }

    return (
        <View style={[styles.wrapper, large ? styles.wrapperLarge : null, !editable ? styles.wrapperDisabled : null]}>
            <Text style={[styles.prefix, large ? styles.prefixLarge : null, brandFont(700)]}>USD</Text>
            <TextInput
                value={text}
                editable={editable}
                onChangeText={(val) => {
                    const clean = val.replace(/[^0-9.,]/g, "");
                    setText(clean);
                    onChange(parse(clean));
                }}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                style={[styles.input, large ? styles.inputLarge : null, brandFont(700)]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        minWidth: 120,
    },
    wrapperLarge: {
        borderWidth: 2,
        borderColor: BRAND_COLORS.azur,
        borderRadius: BRAND_RADII.input,
        paddingHorizontal: 14,
    },
    wrapperDisabled: {
        backgroundColor: "#F1F5F9",
    },
    prefix: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
        color: "#94A3B8",
        marginRight: 6,
    },
    prefixLarge: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 14,
    },
    input: {
        fontFamily: "NotoSans_400Regular",
        flex: 1,
        fontSize: 14,
        color: BRAND_COLORS.navy,
        paddingVertical: 7,
        textAlign: "right",
    },
    inputLarge: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 20,
        paddingVertical: 10,
    },
});
