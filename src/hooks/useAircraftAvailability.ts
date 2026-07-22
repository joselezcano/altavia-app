import { db } from "@/config/firebase";
import { AircraftAvailability, AircraftAvailabilityDoc } from "@/types/all-roles";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

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

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

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
          id: docSnap.id,
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

export function useAircraftAvailabilityItem(eventId: string | undefined) {
  return useQuery<AircraftAvailabilityDoc | null>({
    queryKey: ["aircraft-availability-item", eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const docRef = doc(db, "aircraft-availability", eventId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();

      const start_timestamp = data.start_timestamp
        ? (data.start_timestamp.toDate ? data.start_timestamp.toDate() : new Date(data.start_timestamp))
        : undefined;

      const end_timestamp = data.end_timestamp
        ? (data.end_timestamp.toDate ? data.end_timestamp.toDate() : new Date(data.end_timestamp))
        : undefined;

      const endsDate = data.recurrence?.ends?.date || null;

      return {
        ...(data as AircraftAvailability),
        id: docSnap.id,
        start_timestamp,
        end_timestamp,
        recurrence: {
          ...data.recurrence,
          ends: {
            ...data.recurrence?.ends,
            date: endsDate,
          },
        },
      } as AircraftAvailabilityDoc;
    },
    enabled: !!eventId,
  });
}

