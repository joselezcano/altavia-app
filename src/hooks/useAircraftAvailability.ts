import { db } from "@/config/firebase";
import { AircraftAvailability } from "@/types/all-roles";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface AircraftAvailabilityDoc extends AircraftAvailability {
  id: string;
}

export function useAircraftAvailability(aircraftId: string | undefined) {
  return useQuery<AircraftAvailabilityDoc[]>({
    queryKey: ["aircraft-availability", aircraftId],
    queryFn: async () => {
      if (!aircraftId) return [];

      const q = query(
        collection(db, "aircraft-availability"),
        where("aircraftId", "==", aircraftId)
      );
      const snapshot = await getDocs(q);
      const list: AircraftAvailabilityDoc[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Convert Firestore Timestamps to standard JS Date objects
        const start_timestamp = data.start_timestamp
          ? (data.start_timestamp.toDate ? data.start_timestamp.toDate() : new Date(data.start_timestamp))
          : undefined;

        const end_timestamp = data.end_timestamp
          ? (data.end_timestamp.toDate ? data.end_timestamp.toDate() : new Date(data.end_timestamp))
          : undefined;

        const endsDate = data.recurrence?.ends?.date || null;

        list.push({
          ...(data as AircraftAvailability),
          id: doc.id,
          start_timestamp,
          end_timestamp,
          recurrence: {
            ...data.recurrence,
            ends: {
              ...data.recurrence?.ends,
              date: endsDate,
            },
          },
        } as AircraftAvailabilityDoc);
      });

      return list;
    },
    enabled: !!aircraftId,
  });
}
