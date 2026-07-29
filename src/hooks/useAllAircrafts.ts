import { db } from "@/config/firebase";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";

export interface AdminAircraftSpecsDoc extends AircraftSpecs {
  id: string;
  assignedPilotId?: string | null;
  assignedPilotName?: string | null;
  ownerId?: string;
  pricePerMileOverride?: number | null;
}

export function useAllAircrafts() {
  return useQuery<AdminAircraftSpecsDoc[]>({
    queryKey: ["all-aircrafts"],
    queryFn: async () => {
      try {
        const q = collection(db, "AircraftSpecs");
        const snapshot = await getDocs(q);
        const list: AdminAircraftSpecsDoc[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            ...(data as AircraftSpecs),
            assignedPilotId: data.assignedPilotId || null,
            assignedPilotName: data.assignedPilotName || null,
            ownerId: data.ownerId,
            pricePerMileOverride: data.pricePerMileOverride || null,
          });
        });

        return list;
      } catch (error) {
        console.error("Error fetching all aircrafts in useAllAircrafts:", error);
        throw error;
      }
    },
  });
}
