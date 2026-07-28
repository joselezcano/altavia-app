import { db } from "@/config/firebase";
import { AircraftSpecsDoc } from "@/hooks/useOwnerAircrafts";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";

export function useAircraftDetails(id: string | undefined) {
  return useQuery<AircraftSpecsDoc | null>({
    queryKey: ["aircraft-details", id],
    queryFn: async () => {
      if (!id) return null;

      const docRef = doc(db, "AircraftSpecs", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();

      return {
        id: docSnap.id,
        ...(data as AircraftSpecs),
      } as AircraftSpecsDoc;
    },
    enabled: !!id,
  });
}
