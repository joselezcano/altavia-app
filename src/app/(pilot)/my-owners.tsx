import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { usePilotDetails } from "@/hooks/usePilotDetails";
import { usePilotOwners, useUnlinkFromOwner } from "@/hooks/usePilotOwners";
import { PilotOwnerItem } from "@/types/pilot";
import { confirmAction } from "@/utils/dialogs";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

/**
 * "Mis propietarios" del piloto (ruta oculta del grupo pilot, se abre desde el avatar).
 * Permite desvincularse de un propietario: es una renuncia que las reglas permiten
 * al propio piloto (achicar owner_ids / managed_aircrafts / pilot_aircrafts).
 */
export default function MyOwnersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profileData, refreshProfileData } = useAuth();

  // Se lee el perfil actualizado (un propietario pudo vincularlo después del login);
  // mientras carga se usa el perfil en memoria.
  const { data: pilotProfile, isLoading: isLoadingProfile } = usePilotDetails(user?.uid);
  const ownerIds: string[] =
    pilotProfile?.owner_ids ?? (Array.isArray(profileData?.owner_ids) ? profileData.owner_ids : []);
  const isEncargado = pilotProfile?.isEncargado ?? profileData?.isEncargado === true;

  const { data: owners = [], isLoading: isLoadingOwners } = usePilotOwners(ownerIds);
  const isLoading = isLoadingProfile || isLoadingOwners;
  const unlinkMutation = useUnlinkFromOwner();
  const [unlinkingOwnerId, setUnlinkingOwnerId] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/flights");
  };

  const handleUnlink = async (owner: PilotOwnerItem) => {
    if (!user) return;

    const isLastOwner = ownerIds.length <= 1;
    const confirmed = await confirmAction({
      title: "Desvincularme",
      message:
        `Vas a dejar de volar para ${owner.displayName}. ` +
        "Se quitarán de tu lista las aeronaves de este propietario" +
        (isEncargado && isLastOwner ? " y dejarás de ser encargado" : "") +
        ". Solo el propietario puede volver a vincularte.",
      confirmText: "Desvincularme",
      destructive: true,
    });
    if (!confirmed) return;

    setUnlinkingOwnerId(owner.uid);
    try {
      await unlinkMutation.mutateAsync({ pilotUid: user.uid, ownerUid: owner.uid });
      // Actualiza el perfil en memoria (pestañas de encargado, flota a cargo, etc.)
      await refreshProfileData();
      Toast.show({
        type: "success",
        text1: "Desvinculación realizada",
        text2: `Ya no figurás como piloto de ${owner.displayName}.`,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo completar la desvinculación.");
    } finally {
      setUnlinkingOwnerId(null);
    }
  };

  const renderOwner = ({ item }: { item: PilotOwnerItem }) => {
    const isUnlinking = unlinkingOwnerId === item.uid;
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <View style={styles.ownerIcon}>
            <Ionicons name="briefcase-outline" size={20} color="#030436" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText className="font-bold text-base text-brand-blue" numberOfLines={1}>
              {item.displayName}
            </ThemedText>
            {item.email ? (
              <ThemedText type="caption" className="text-slate-500" numberOfLines={1}>
                {item.email}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleUnlink(item)}
          disabled={unlinkingOwnerId !== null}
          style={[styles.unlinkButton, unlinkingOwnerId !== null && styles.unlinkButtonDisabled]}
          activeOpacity={0.7}
        >
          {isUnlinking ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="person-remove-outline" size={16} color="#EF4444" />
              <ThemedText className="text-red-500 font-semibold text-sm">Desvincularme</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1 px-4" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Mis propietarios" subtitle="Mi perfil" onBack={goBack} withInset={false} />

      <ThemedText type="caption" className="text-slate-500 mb-4">
        Propietarios para los que volás. Si te desvinculás, dejarás de ver sus aeronaves.
      </ThemedText>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#030436" />
          <ThemedText className="text-slate-500 mt-2">Cargando propietarios...</ThemedText>
        </View>
      ) : owners.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={32} color="#94A3B8" />
          </View>
          <ThemedText type="subtitle" className="text-center mb-2 text-slate-700">
            Sin propietarios vinculados
          </ThemedText>
          <ThemedText type="caption" className="text-center text-slate-500">
            Un propietario puede vincularte desde su panel con tu correo electrónico.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={owners}
          renderItem={renderOwner}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    elevation: 1,
    shadowColor: "#030436",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ownerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  unlinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingVertical: 10,
  },
  unlinkButtonDisabled: {
    opacity: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
});
