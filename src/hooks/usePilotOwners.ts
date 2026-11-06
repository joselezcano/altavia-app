import { db } from "@/config/firebase";
import { PilotOwnerItem, UnlinkFromOwnerInput } from "@/types/pilot";
import { BaseUser } from "@/types/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

function ownerDisplayName(userData: BaseUser | null, uid: string): string {
  if (!userData) return "Propietario";
  if (userData.personType === "company" && userData.businessName) return userData.businessName;
  const fullName = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
  return fullName || userData.businessName || userData.email || `Propietario ${uid.slice(0, 6)}`;
}

/**
 * Nombre y email de los propietarios con los que trabaja un piloto (owner_ids).
 */
export function usePilotOwners(ownerIds: string[] | undefined) {
  const ids = Array.isArray(ownerIds) ? ownerIds : [];

  return useQuery<PilotOwnerItem[]>({
    queryKey: ["pilot-owners", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];

      try {
        const snaps = await Promise.all(ids.map((uid) => getDoc(doc(db, "users", uid))));
        return snaps.map((snap, index) => {
          const uid = ids[index];
          const userData = snap.exists() ? (snap.data() as BaseUser) : null;
          return {
            uid,
            displayName: ownerDisplayName(userData, uid),
            email: userData?.email || "",
          };
        });
      } catch (error) {
        console.error("Error al obtener los propietarios del piloto en usePilotOwners:", error);
        throw error;
      }
    },
    enabled: ids.length > 0,
  });
}

/**
 * El piloto se desvincula de un propietario (renuncia, permitido por las reglas):
 *  - saca al propietario de owner_ids;
 *  - saca de managed_aircrafts y pilot_aircrafts las aeronaves de ese propietario;
 *  - si no le queda ningún propietario, deja de ser encargado (isEncargado = false).
 */
export function useUnlinkFromOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pilotUid, ownerUid }: UnlinkFromOwnerInput) => {
      try {
        const pilotRef = doc(db, "pilots", pilotUid);
        const pilotSnap = await getDoc(pilotRef);
        if (!pilotSnap.exists()) {
          throw new Error("No se encontró tu perfil de piloto.");
        }

        const data = pilotSnap.data();
        const ownerIds: string[] = Array.isArray(data.owner_ids) ? data.owner_ids : [];
        const managed: string[] = Array.isArray(data.managed_aircrafts) ? data.managed_aircrafts : [];
        const piloted: string[] = Array.isArray(data.pilot_aircrafts) ? data.pilot_aircrafts : [];

        // Aeronaves de ese propietario
        const aircraftSnap = await getDocs(
          query(collection(db, "AircraftSpecs"), where("ownerId", "==", ownerUid))
        );
        const ownerAircraftIds = new Set(aircraftSnap.docs.map((d) => d.id));

        const remainingOwners = ownerIds.filter((id) => id !== ownerUid);
        const update: Record<string, any> = {
          owner_ids: remainingOwners,
          managed_aircrafts: managed.filter((id) => !ownerAircraftIds.has(id)),
          pilot_aircrafts: piloted.filter((id) => !ownerAircraftIds.has(id)),
          updated_at: serverTimestamp(),
        };

        if (remainingOwners.length === 0 && data.isEncargado === true) {
          update.isEncargado = false;
        }

        await updateDoc(pilotRef, update);
        return { remainingOwners: remainingOwners.length };
      } catch (error) {
        console.error("Error al desvincular al piloto del propietario:", error);
        throw error;
      }
    },
    onSuccess: (_result, { pilotUid, ownerUid }) => {
      queryClient.invalidateQueries({ queryKey: ["pilot-owners"] });
      queryClient.invalidateQueries({ queryKey: ["pilot-details", pilotUid] });
      queryClient.invalidateQueries({ queryKey: ["owner-pilots", ownerUid] });
      queryClient.invalidateQueries({ queryKey: ["managed-aircrafts"] });
    },
  });
}
