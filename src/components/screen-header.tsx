import { BRAND_COLORS } from "@/constants/brand";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScreenHeaderProps {
    title: string;
    /** Detalle debajo del título. */
    subtitle?: string;
    /** Botón o acción a la derecha (ej. "Nuevo"). */
    right?: ReactNode;
    /** Sobrescribe el comportamiento de "volver" (por defecto router.back()). */
    onBack?: () => void;
    /** Oculta el botón de volver (pantallas raíz de una pestaña). */
    hideBack?: boolean;
    /** Suma el área segura superior. Desactivar solo si el contenedor ya la aplica. */
    withInset?: boolean;
}

/**
 * Encabezado común de las pantallas internas: botón "atrás" encuadrado, título con el detalle
 * debajo y, si corresponde, una acción a la derecha. Respeta el área segura del dispositivo.
 * El contenedor padre aporta el padding horizontal (px-4).
 */
export function ScreenHeader({ title, subtitle, right, onBack, hideBack, withInset = true }: ScreenHeaderProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleBack = () => {
        if (onBack) onBack();
        else if (router.canGoBack()) router.back();
    };

    return (
        <View style={[styles.header, { paddingTop: withInset ? insets.top + 8 : 8 }]}>
            {!hideBack && (
                <TouchableOpacity onPress={handleBack} style={styles.iconButton} hitSlop={8} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={20} color={BRAND_COLORS.navy} />
                </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
                <Text style={[styles.title, brandFont(800)]} numberOfLines={1}>
                    {title}
                </Text>
                {!!subtitle && (
                    <Text style={[styles.subtitle, brandFont(400)]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {right}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 20,
        color: BRAND_COLORS.navy,
    },
    subtitle: {
        fontFamily: "NotoSans_400Regular",
        fontSize: 12,
        color: BRAND_COLORS.textMuted,
    },
});
