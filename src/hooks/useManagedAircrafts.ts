import { db } from "@/config/firebase";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";

export interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
  assignedPilotId?: string | null;
  assignedPilotName?: string | null;
}

export function useManagedAircrafts(managedAircraftIds: string[] | undefined) {
  return useQuery<AircraftSpecsDoc[]>({
    queryKey: ["managed-aircrafts", managedAircraftIds],
    queryFn: async () => {
      if (!managedAircraftIds || managedAircraftIds.length === 0) return [];

      const q = query(
        collection(db, "AircraftSpecs"),
        where(documentId(), "in", managedAircraftIds)
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
    enabled: !!managedAircraftIds && managedAircraftIds.length > 0,
  });
}
