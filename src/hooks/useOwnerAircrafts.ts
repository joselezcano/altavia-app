import { db } from "@/config/firebase";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
  assignedPilotId?: string | null;
  assignedPilotName?: string | null;
}

export function useOwnerAircrafts(ownerUid: string | undefined) {
  return useQuery<AircraftSpecsDoc[]>({
    queryKey: ["owner-aircrafts", ownerUid],
    queryFn: async () => {
      if (!ownerUid) return [];

      const q = query(
        collection(db, "AircraftSpecs"),
        where("ownerId", "==", ownerUid)
      );
      const snapshot = await getDocs(q);
      const list: AircraftSpecsDoc[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          ...(data as AircraftSpecs),
          assignedPilotId: data.assignedPilotId || null,
          assignedPilotName: data.assignedPilotName || null,
        });
      });

      return list;
    },
    enabled: !!ownerUid,
  });
}
