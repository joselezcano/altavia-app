import { RoleOption } from "@/components/account/role-option";
import SignOutButton from "@/components/sign-out-button";
import { BRAND_COLORS, BRAND_LOGO_ASPECT, BRAND_LOGOS, BRAND_TYPE } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { brandFont } from "@/utils/brand-fonts";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Pantalla de elección de rol al ingresar con una cuenta que tiene varios roles. */
export default function RoleSelectionScreen() {
  const { roles, selectRole } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={BRAND_LOGOS.verticalColor}
            style={{ width: 140, height: 140 / BRAND_LOGO_ASPECT.vertical, marginBottom: 24 }}
            resizeMode="contain"
            accessibilityLabel="AltaGo"
          />
          <Text style={[styles.title, brandFont(800)]}>¿Cómo querés ingresar?</Text>
          <Text style={[styles.subtitle, brandFont(400)]}>
            Tu cuenta tiene más de un perfil. Elegí con cuál entrar; después podés cambiarlo desde tu avatar.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {roles.map((role) => (
            <RoleOption key={role} role={role} onPress={() => selectRole(role)} />
          ))}
        </View>

        <View style={{ marginTop: 28 }}>
          <SignOutButton />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND_COLORS.backgroundAlt },
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 520, alignSelf: "center" },
  header: { alignItems: "center", marginBottom: 28 },
  title: { fontFamily: "NotoSans_800ExtraBold", fontSize: BRAND_TYPE.screenTitle + 2, color: BRAND_COLORS.navy, textAlign: "center" },
  subtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: BRAND_TYPE.body - 1,
    color: BRAND_COLORS.textMuted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 340,
  },
});
