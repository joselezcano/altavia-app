import { AccountSheet } from "@/components/account/account-sheet";
import { BRAND_COLORS, BRAND_TYPE } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatarProps } from "@/types/components";
import { brandFont } from "@/utils/brand-fonts";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Avatar del usuario. Al tocarlo abre la hoja de cuenta, que es la misma para todos los roles.
 * `light`: círculo blanco con la inicial en navy (sobre fondos oscuros o fotos).
 */
export default function UserAvatar({ size = 44, showDetails = false, light = false }: UserAvatarProps) {
  const { user, userData } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName =
    `${userData?.firstName ?? ""} ${userData?.lastName ?? ""}`.trim() || user?.email?.split("@")[0] || "Usuario";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.trigger}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Abrir mi cuenta"
      >
        <View
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: size / 2 },
            light ? styles.circleLight : styles.circleDark,
          ]}
        >
          <Text style={[styles.initial, brandFont(700), { color: light ? BRAND_COLORS.navy : BRAND_COLORS.white }]}>
            {initial}
          </Text>
        </View>
        {showDetails && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, brandFont(700)]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.email, brandFont(400)]} numberOfLines={1}>{user?.email}</Text>
          </View>
        )}
      </TouchableOpacity>

      <AccountSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 12 },
  circle: { alignItems: "center", justifyContent: "center" },
  circleDark: { backgroundColor: BRAND_COLORS.navy },
  circleLight: { backgroundColor: BRAND_COLORS.white },
  initial: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body + 1 },
  name: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body - 1, color: BRAND_COLORS.navy },
  email: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.label, color: BRAND_COLORS.textMuted },
});
