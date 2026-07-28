import { db } from "@/config/firebase";
import { AircraftSpecsDoc } from "@/hooks/useOwnerAircrafts";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";

export function usePilotAircrafts(aircraftIds: string[] | undefined) {
  return useQuery<AircraftSpecsDoc[]>({
    queryKey: ["pilot-aircrafts", aircraftIds],
    queryFn: async () => {
      if (!aircraftIds || aircraftIds.length === 0) return [];

      const list: AircraftSpecsDoc[] = [];

      // Chunk array into groups of 30 due to Firestore 'in' query limit
      const chunkSize = 30;
      for (let i = 0; i < aircraftIds.length; i += chunkSize) {
        const chunk = aircraftIds.slice(i, i + chunkSize);
        const q = query(
          collection(db, "AircraftSpecs"),
          where(documentId(), "in", chunk)
        );
        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
          list.push({
            id: doc.id,
            ...(doc.data() as AircraftSpecs),
          });
        });
      }

      return list;
    },
    enabled: !!aircraftIds && aircraftIds.length > 0,
  });
}
