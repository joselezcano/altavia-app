import { db } from "@/config/firebase";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
}

export function useOwnerAircrafts(ownerUid: string | undefined) {
  return useQuery<AircraftSpecsDoc[]>({
    queryKey: ["owner-aircrafts", ownerUid],
    queryFn: async () => {
      if (!ownerUid) return [];

      try {
        const q = query(
          collection(db, "AircraftSpecs"),
          where("ownerId", "==", ownerUid)
        );
        const snapshot = await getDocs(q);
        const list: AircraftSpecsDoc[] = [];

        snapshot.forEach((doc) => list.push({
          id: doc.id,
          ...(doc.data() as AircraftSpecs)
        }));

        return list;
      } catch (error) {
        console.error("Error fetching owner aircrafts in useOwnerAircrafts:", error);
        throw error;
      }
    },
    enabled: !!ownerUid,
  });
}
