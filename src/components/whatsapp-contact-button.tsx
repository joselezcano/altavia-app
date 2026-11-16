import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { WhatsAppContactButtonProps } from "@/types/components";
import { brandFont } from "@/utils/brand-fonts";
import { openAltaGoWhatsApp } from "@/utils/client-format";
import { showNotice } from "@/utils/dialogs";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

const WHATSAPP_GREEN = "#15803D"; // verde WhatsApp oscurecido: texto blanco con contraste 5:1

/** Botón "Consultar por WhatsApp" hacia el contacto comercial de AltaGo. */
export function WhatsAppContactButton({
    message,
    label = "Consultar por WhatsApp",
    variant = "solid",
    compact = false,
}: WhatsAppContactButtonProps) {
    const handlePress = async () => {
        const ok = await openAltaGoWhatsApp(message);
        if (!ok) showNotice("No se pudo abrir WhatsApp", "Revisá que WhatsApp esté instalado e intentá de nuevo.");
    };

    const containerStyle =
        variant === "solid" ? styles.solid : variant === "light" ? styles.light : styles.outline;
    const color = variant === "solid" ? "#FFFFFF" : variant === "light" ? "#FFFFFF" : BRAND_COLORS.navy;

    return (
        <TouchableOpacity
            onPress={handlePress}
            style={[styles.base, compact ? styles.compact : null, containerStyle]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name="logo-whatsapp" size={compact ? 16 : 18} color={variant === "outline" ? WHATSAPP_GREEN : color} />
            <Text style={[styles.text, brandFont(700), { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: BRAND_RADII.input,
    },
    compact: {
        paddingVertical: 9,
        paddingHorizontal: 12,
    },
    solid: {
        backgroundColor: WHATSAPP_GREEN,
    },
    outline: {
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
    },
    light: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
    },
    text: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.body - 1,
    },
});
