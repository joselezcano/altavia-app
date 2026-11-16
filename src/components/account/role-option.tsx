import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { ROLE_INFO } from "@/constants/roles";
import { RoleOptionProps } from "@/types/components";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Fila de rol. Es la misma en la pantalla de elección de rol, en la hoja de cuenta (avatar)
 * y en Perfil. Componentes nativos: se usa también dentro de <Modal>.
 */
export function RoleOption({ role, active = false, onPress }: RoleOptionProps) {
    const info = ROLE_INFO[role];
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={active}
            style={[styles.row, active ? styles.rowActive : null]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
        >
            <View style={[styles.iconBox, active ? styles.iconBoxActive : null]}>
                <Ionicons name={info.icon} size={22} color={active ? BRAND_COLORS.white : BRAND_COLORS.navy} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.title, brandFont(700)]}>{info.title}</Text>
                <Text style={[styles.description, brandFont(400)]} numberOfLines={1}>
                    {info.description}
                </Text>
            </View>
            {active ? (
                <View style={styles.currentPill}>
                    <Text style={[styles.currentText, brandFont(700)]}>Actual</Text>
                </View>
            ) : (
                <Ionicons name="chevron-forward" size={20} color={BRAND_COLORS.azur} />
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: BRAND_COLORS.white,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: BRAND_RADII.input,
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    rowActive: { borderColor: BRAND_COLORS.azur, backgroundColor: BRAND_COLORS.surfaceTint },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: BRAND_COLORS.surfaceTint,
        alignItems: "center",
        justifyContent: "center",
    },
    iconBoxActive: { backgroundColor: BRAND_COLORS.navy },
    title: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body + 1, color: BRAND_COLORS.navy },
    description: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary, color: BRAND_COLORS.textMuted, marginTop: 1 },
    currentPill: { backgroundColor: BRAND_COLORS.navy, borderRadius: BRAND_RADII.pill, paddingHorizontal: 10, paddingVertical: 4 },
    currentText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.label, color: BRAND_COLORS.white },
});
