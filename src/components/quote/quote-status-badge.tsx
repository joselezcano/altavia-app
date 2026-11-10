import { BRAND_RADII } from "@/constants/brand";
import { QuoteStatusBadgeProps } from "@/types/quote-ui";
import { brandFont } from "@/utils/brand-fonts";
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABEL } from "@/utils/quote-format";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/** Etiqueta de estado del presupuesto (Borrador, Enviado, Aceptado…). */
export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
    const c = QUOTE_STATUS_COLORS[status];
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.text, { color: c.fg }, brandFont(700)]}>{QUOTE_STATUS_LABEL[status]}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BRAND_RADII.pill,
    },
    text: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 11,
    },
});
