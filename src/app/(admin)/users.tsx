import { useAllUsers, useRoleProfileIds, useToggleUserRole } from "@/hooks/useAdminUsers";
import { AdminManagedRole, AdminUsersRoleFilter } from "@/types/admin";
import { BaseUser } from "@/types/user";
import { confirmAction, showNotice } from "@/utils/dialogs";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

const ROLE_FILTERS: { id: AdminUsersRoleFilter; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "OWNER", label: "Propietarios" },
  { id: "PILOT", label: "Pilotos" },
  { id: "CLIENT", label: "Clientes" },
  { id: "ADMIN", label: "Admin" },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OWNER: "Propietario",
  PILOT: "Piloto",
  CLIENT: "Cliente",
};

const MANAGED_ROLES: AdminManagedRole[] = ["OWNER", "PILOT"];

// Minúsculas y sin tildes, para comparar búsquedas.
function normalize(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function displayName(u: BaseUser): string {
  const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return fullName || u.businessName || u.email || "Usuario sin nombre";
}

export default function AdminUsersScreen() {
  const { data: users = [], isLoading, isRefetching, refetch, error } = useAllUsers();
  const { data: profileIds } = useRoleProfileIds();
  const toggleRoleMutation = useToggleUserRole();

  const pilotProfileSet = useMemo(() => new Set(profileIds?.pilotIds || []), [profileIds]);
  const ownerProfileSet = useMemo(() => new Set(profileIds?.ownerIds || []), [profileIds]);

  // ¿Tiene el rol en `roles` pero le falta el documento pilots/{uid} u owners/{uid}?
  const isMissingProfile = (u: BaseUser, role: AdminManagedRole) => {
    if (!profileIds || !(u.roles || []).includes(role)) return false;
    return role === "PILOT" ? !pilotProfileSet.has(u.uid) : !ownerProfileSet.has(u.uid);
  };

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUsersRoleFilter>("ALL");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const countsByRole = useMemo(() => {
    const counts: Record<string, number> = { ALL: users.length };
    users.forEach((u) => (u.roles || []).forEach((r) => (counts[r] = (counts[r] || 0) + 1)));
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = normalize(search.trim());
    const qDigits = q.replace(/[^0-9a-z]/g, "");

    return users.filter((u) => {
      if (roleFilter !== "ALL" && !(u.roles || []).includes(roleFilter)) return false;
      if (!q) return true;

      const docs = [u.documentNumber, u.taxId, u.representativeDoc].filter(Boolean) as string[];
      return (
        normalize(`${u.firstName || ""} ${u.lastName || ""}`).includes(q) ||
        normalize(u.businessName).includes(q) ||
        normalize(u.email).includes(q) ||
        docs.some(
          (d) =>
            normalize(d).includes(q) ||
            (qDigits.length > 0 && normalize(d).replace(/[^0-9a-z]/g, "").includes(qDigits))
        )
      );
    });
  }, [users, search, roleFilter]);

  const handleToggleRole = async (u: BaseUser, role: AdminManagedRole) => {
    const roles = u.roles || [];
    const hasRole = roles.includes(role);
    const name = displayName(u);
    const roleLabel = ROLE_LABELS[role];

    const confirmed = await confirmAction(
      hasRole
        ? {
            title: `Quitar rol ${roleLabel}`,
            message:
              `${name} dejará de tener el rol ${roleLabel}. Su perfil de ${roleLabel.toLowerCase()} ` +
              "no se borra (se conserva la historia)." +
              (roles.length === 1 ? " Al quedar sin roles, ingresará como Cliente." : ""),
            confirmText: "Quitar",
            destructive: true,
          }
        : {
            title: `Agregar rol ${roleLabel}`,
            message:
              `¿Dar el rol ${roleLabel} a ${name}?` +
              (role === "PILOT"
                ? " Después un propietario podrá vincularlo con su correo desde \"Mis Pilotos\"."
                : ""),
            confirmText: "Agregar",
          }
    );
    if (!confirmed) return;

    setPendingKey(`${u.uid}-${role}`);
    try {
      await toggleRoleMutation.mutateAsync({ uid: u.uid, role, add: !hasRole });
      Toast.show({
        type: "success",
        text1: hasRole ? "Rol quitado" : "Rol agregado",
        text2: `${name}: ${roleLabel}`,
      });
    } catch (err: any) {
      await showNotice("Error", err?.message || "No se pudieron actualizar los roles del usuario.");
    } finally {
      setPendingKey(null);
    }
  };

  // Crea el perfil de rol faltante (el rol ya estaba en `roles`).
  const handleCreateProfile = async (u: BaseUser, role: AdminManagedRole) => {
    setPendingKey(`${u.uid}-${role}-profile`);
    try {
      await toggleRoleMutation.mutateAsync({ uid: u.uid, role, add: true });
      Toast.show({
        type: "success",
        text1: "Perfil creado",
        text2: `${displayName(u)}: perfil de ${ROLE_LABELS[role]}`,
      });
    } catch (err: any) {
      await showNotice("Error", err?.message || "No se pudo crear el perfil.");
    } finally {
      setPendingKey(null);
    }
  };

  const renderUser = ({ item }: { item: BaseUser }) => {
    const roles = item.roles || [];
    const docText = item.documentNumber || item.taxId;
    const missingProfiles = MANAGED_ROLES.filter((role) => isMissingProfile(item, role));

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName(item).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nameText} numberOfLines={1}>
              {displayName(item)}
            </Text>
            {item.email ? (
              <Text style={styles.subText} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
            {docText ? <Text style={styles.subText}>Doc/RUC: {docText}</Text> : null}
          </View>
        </View>

        {/* Roles actuales */}
        <View style={styles.badgesRow}>
          {roles.length === 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Sin roles</Text>
            </View>
          ) : (
            roles.map((r) => (
              <View
                key={r}
                style={[styles.badge, (r === "OWNER" || r === "PILOT") && styles.badgeHighlight]}
              >
                <Text
                  style={[styles.badgeText, (r === "OWNER" || r === "PILOT") && styles.badgeTextHighlight]}
                >
                  {ROLE_LABELS[r] || r}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Rol sin documento de perfil (datos viejos) */}
        {missingProfiles.map((role) => {
          const isPending = pendingKey === `${item.uid}-${role}-profile`;
          return (
            <View key={role} style={styles.warningRow}>
              <Ionicons name="warning-outline" size={16} color="#B45309" />
              <Text style={styles.warningText}>
                Tiene el rol {ROLE_LABELS[role]} pero le falta su perfil.
              </Text>
              <TouchableOpacity
                onPress={() => handleCreateProfile(item, role)}
                disabled={pendingKey !== null}
                style={styles.warningButton}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#B45309" />
                ) : (
                  <Text style={styles.warningButtonText}>Crear perfil</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Agregar / quitar OWNER y PILOT */}
        <View style={styles.actionsRow}>
          {MANAGED_ROLES.map((role) => {
            const hasRole = roles.includes(role);
            const isPending = pendingKey === `${item.uid}-${role}`;
            return (
              <TouchableOpacity
                key={role}
                onPress={() => handleToggleRole(item, role)}
                disabled={pendingKey !== null}
                style={[
                  styles.actionButton,
                  hasRole ? styles.actionButtonRemove : styles.actionButtonAdd,
                  pendingKey !== null && !isPending && styles.actionButtonDisabled,
                ]}
                activeOpacity={0.7}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color={hasRole ? "#EF4444" : "#FFFFFF"} />
                ) : (
                  <>
                    <Ionicons
                      name={hasRole ? "remove-circle-outline" : "add-circle-outline"}
                      size={16}
                      color={hasRole ? "#EF4444" : "#FFFFFF"}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        hasRole ? styles.actionButtonTextRemove : styles.actionButtonTextAdd,
                      ]}
                    >
                      {hasRole ? `Quitar ${ROLE_LABELS[role]}` : ROLE_LABELS[role]}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Administración</Text>
        <Text style={styles.headerTitle}>Usuarios y Roles</Text>
      </View>

      {/* Búsqueda */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, email o documento"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtro por rol */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {ROLE_FILTERS.map((f) => {
            const isSelected = roleFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setRoleFilter(f.id)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {f.label} ({countsByRole[f.id] || 0})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#030436" />
          <Text style={styles.emptyText}>Cargando usuarios...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
          <Text style={styles.emptyText}>No se pudieron cargar los usuarios.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#030436" />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyText}>No hay usuarios que coincidan con la búsqueda.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 14,
  },
  headerEyebrow: {
    fontSize: 11,
    color: "#0165FF",
    fontWeight: "bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#030436",
    marginTop: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#030436",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#030436",
    borderColor: "#030436",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#030436",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#030436",
  },
  subText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  badgeHighlight: {
    backgroundColor: "#FBF6EC",
    borderWidth: 1,
    borderColor: "#E9D9B4",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  badgeTextHighlight: {
    color: "#A88540",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
  },
  warningButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonAdd: {
    backgroundColor: "#030436",
    borderColor: "#030436",
  },
  actionButtonRemove: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FECACA",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionButtonTextAdd: {
    color: "#FFFFFF",
  },
  actionButtonTextRemove: {
    color: "#EF4444",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#030436",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
});
