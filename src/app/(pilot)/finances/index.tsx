import { LoadingCard } from "@/components/loading-card";
import { OwnerOperationalControlView } from "@/components/owner-operations/owner-operational-control-view";
import { PilotHeader } from "@/components/pilot-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { useManagedAircrafts } from "@/hooks/useManagedAircrafts";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Control Operativo (GIO) para la piloto-encargada.
 * Reutiliza la vista del propietario sobre las aeronaves que gestiona; los registros
 * se guardan a nombre del dueño de cada aeronave (ver canUseGio en firestore.rules).
 */
export default function PilotFinancesScreen() {
  const { user, profileData } = useAuth();
  const insets = useSafeAreaInsets();

  const isEncargado = profileData?.isEncargado === true;
  const managedIds: string[] = isEncargado ? profileData?.managed_aircrafts || [] : [];
  const { data: aircrafts = [], isLoading } = useManagedAircrafts(managedIds);

  const displayName =
    profileData?.firstName && profileData?.lastName
      ? `${profileData.firstName} ${profileData.lastName}`
      : user?.email || "Encargada";

  // La vista necesita el dueño de la aeronave; sin aeronaves con dueño no hay a quién imputar los registros.
  const aircraftsWithOwner = aircrafts.filter((a) => !!a.ownerId);
  const defaultOwnerUid = aircraftsWithOwner[0]?.ownerId || "";

  return (
    <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <PilotHeader title="Módulo Contable" subtitle="Control Operativo" />

        {isLoading ? (
          <LoadingCard message="Cargando aeronaves a cargo..." />
        ) : !isEncargado || aircraftsWithOwner.length === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ThemedText type="caption" style={{ textAlign: "center" }}>
              No tenés aeronaves a cargo. Pedile al propietario que te asigne una desde "Mis Pilotos".
            </ThemedText>
          </View>
        ) : (
          <OwnerOperationalControlView
            ownerUid={defaultOwnerUid}
            ownerDisplayName={displayName}
            aircrafts={aircraftsWithOwner}
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}
