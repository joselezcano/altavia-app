import { db } from "@/config/firebase";
import { BaseUser, PilotProfile } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";

export interface FullPilotData extends PilotProfile, Omit<BaseUser, "uid" | "roles"> {}

export function useOwnerPilots(ownerUid: string | undefined) {
  return useQuery<FullPilotData[]>({
    queryKey: ["owner-pilots", ownerUid],
    queryFn: async () => {
      if (!ownerUid) return [];

      // 1. Fetch from 'pilots' collection where ownerId matches
      const pilotsQuery = query(
        collection(db, "pilots"),
        where("ownerId", "==", ownerUid)
      );
      const pilotsSnapshot = await getDocs(pilotsQuery);
      
      const pilotProfiles: PilotProfile[] = [];
      const pilotUids: string[] = [];
      
      pilotsSnapshot.forEach((doc) => {
        const data = doc.data();
        pilotProfiles.push({
          uid: doc.id,
          ownerId: data.ownerId,
          isEncargado: data.isEncargado || false,
          managed_aircrafts: data.managed_aircrafts || [],
        });
        pilotUids.push(doc.id);
      });

      if (pilotUids.length === 0) return [];

      // 2. Fetch corresponding base user info from 'users' collection
      // DocumentId IN query has a limit of 30, which is fine for this B2B scope.
      const usersQuery = query(
        collection(db, "users"),
        where(documentId(), "in", pilotUids)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      const usersMap: Record<string, BaseUser> = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = doc.data() as BaseUser;
      });

      // 3. Merge profiles with base user info
      return pilotProfiles.map((profile) => {
        const baseInfo = usersMap[profile.uid] || {
          firstName: "Piloto",
          lastName: "Registrado",
          email: "",
          roles: ["PILOT"],
          uid: profile.uid,
        };

        return {
          ...profile,
          firstName: baseInfo.firstName,
          lastName: baseInfo.lastName,
          email: baseInfo.email,
        };
      });
    },
    enabled: !!ownerUid,
  });
}
