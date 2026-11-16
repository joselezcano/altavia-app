import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

/** Botón "Cerrar sesión". Componentes nativos: se usa dentro de la hoja de cuenta (<Modal>). */
export default function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <TouchableOpacity style={styles.button} onPress={signOut} activeOpacity={0.85} accessibilityRole="button">
      <Ionicons name="log-out-outline" size={19} color={BRAND_COLORS.navy} />
      <Text style={[styles.text, brandFont(700)]}>Cerrar sesión</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BRAND_COLORS.navy,
    backgroundColor: BRAND_COLORS.white,
    borderRadius: BRAND_RADII.input,
    paddingVertical: 13,
  },
  text: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.navy },
});
