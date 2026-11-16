import { RoleOption } from "@/components/account/role-option";
import SignOutButton from "@/components/sign-out-button";
import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { roleLabel } from "@/constants/roles";
import { Role, useAuth } from "@/hooks/useAuth";
import { AccountMenuItem, AccountSheetProps } from "@/types/components";
import { brandFont } from "@/utils/brand-fonts";
import { usePilotOwnProfile } from "@/hooks/usePilotOwnProfile";
import { isPilotProfileComplete } from "@/utils/pilot-profile";
import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Accesos propios de cada rol. La hoja es la misma para todos; solo cambian estas opciones. */
function menuForRole(role: Role | null, pilotIncomplete: boolean): AccountMenuItem[] {
    switch (role) {
        case "PILOT":
            return [
                {
                    id: "pilot-profile",
                    label: "Mi perfil de piloto",
                    icon: "id-card-outline",
                    href: "/my-pilot-profile" as Href,
                    badge: pilotIncomplete ? "Incompleto" : undefined,
                },
                { id: "owners", label: "Mis propietarios", icon: "briefcase-outline", href: "/my-owners" as Href },
            ];
        case "CLIENT":
            return [{ id: "profile", label: "Mi perfil", icon: "person-circle-outline", href: "/(client)/profile" as Href }];
        default:
            return [];
    }
}

/**
 * Hoja de cuenta que se abre al tocar el avatar, igual para todos los roles:
 * datos del usuario, cambio de rol (si tiene varios), accesos del rol y cerrar sesión.
 * Solo componentes nativos con StyleSheet (regla de NativeWind dentro de <Modal>).
 */
export function AccountSheet({ visible, onClose }: AccountSheetProps) {
    const { user, userData, role, roles, selectRole } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const displayName =
        `${userData?.firstName ?? ""} ${userData?.lastName ?? ""}`.trim() || user?.email?.split("@")[0] || "Usuario";
    const initial = displayName.charAt(0).toUpperCase();
    const { data: pilotProfile, isFetched } = usePilotOwnProfile(role === "PILOT" ? user?.uid : undefined);
    const menu = menuForRole(role, role === "PILOT" && isFetched && !isPilotProfileComplete(pilotProfile));

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar">
                <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
                    <View style={styles.handle} />
                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                        <View style={styles.header}>
                            <View style={styles.avatar}>
                                <Text style={[styles.avatarText, brandFont(700)]}>{initial}</Text>
                            </View>
                            <Text style={[styles.name, brandFont(700)]} numberOfLines={1}>{displayName}</Text>
                            {!!user?.email && (
                                <Text style={[styles.email, brandFont(400)]} numberOfLines={1}>{user.email}</Text>
                            )}
                            <View style={styles.rolePill}>
                                <Text style={[styles.rolePillText, brandFont(700)]}>{roleLabel(role)}</Text>
                            </View>
                        </View>

                        {roles && roles.length > 1 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, brandFont(700)]}>Cambiar de perfil</Text>
                                <View style={{ gap: 8 }}>
                                    {roles.map((r) => (
                                        <RoleOption
                                            key={r}
                                            role={r}
                                            active={r === role}
                                            onPress={async () => {
                                                onClose();
                                                await selectRole(r);
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {menu.length > 0 && (
                            <View style={[styles.section, { gap: 8 }]}>
                                {menu.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => {
                                            onClose();
                                            router.push(item.href);
                                        }}
                                        style={styles.menuItem}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name={item.icon} size={20} color={BRAND_COLORS.navy} />
                                        <Text style={[styles.menuText, brandFont(600)]}>{item.label}</Text>
                                        {!!item.badge && (
                                            <View style={styles.badge}>
                                                <Text style={[styles.badgeText, brandFont(700)]}>{item.badge}</Text>
                                            </View>
                                        )}
                                        <Ionicons name="chevron-forward" size={18} color={BRAND_COLORS.azur} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={[styles.section, { gap: 10 }]}>
                            <SignOutButton />
                            <TouchableOpacity onPress={onClose} style={styles.cancel} activeOpacity={0.85}>
                                <Text style={[styles.cancelText, brandFont(600)]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,4,54,0.45)" },
    sheet: {
        backgroundColor: BRAND_COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
        maxHeight: "88%",
        width: "100%",
        maxWidth: 560,
        alignSelf: "center",
    },
    handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: BRAND_COLORS.border, alignSelf: "center", marginBottom: 16 },
    header: { alignItems: "center", marginBottom: 6 },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: BRAND_COLORS.navy,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    avatarText: { fontFamily: "NotoSans_700Bold", fontSize: 26, color: BRAND_COLORS.white },
    name: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.cardTitle + 1, color: BRAND_COLORS.navy },
    email: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.textMuted, marginTop: 2 },
    rolePill: {
        marginTop: 10,
        backgroundColor: BRAND_COLORS.surfaceTint,
        borderRadius: BRAND_RADII.pill,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    rolePillText: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.label,
        color: BRAND_COLORS.navy,
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    section: { marginTop: 18 },
    sectionTitle: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.label,
        color: BRAND_COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: BRAND_RADII.input,
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    menuText: { flex: 1, fontFamily: "NotoSans_600SemiBold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.navy },
    badge: { backgroundColor: BRAND_COLORS.azur, borderRadius: BRAND_RADII.pill, paddingHorizontal: 10, paddingVertical: 3 },
    badgeText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.label, color: BRAND_COLORS.white },
    cancel: { backgroundColor: BRAND_COLORS.backgroundAlt, borderRadius: BRAND_RADII.input, paddingVertical: 14, alignItems: "center" },
    cancelText: { fontFamily: "NotoSans_600SemiBold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.navy },
});
