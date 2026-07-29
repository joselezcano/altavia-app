import { db } from "@/config/firebase";
import { OwnerReservationItem } from "@/types/all-roles";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";

export function useOwnerReservations() {
  return useQuery<OwnerReservationItem[]>({
    queryKey: ["owner-flights-all"],
    queryFn: async () => {
      try {
        const snap = await getDocs(collection(db, "aircraft-reservation"));
        return snap.docs.map(doc => {
          const data = doc.data();

          // Normalize Firestore timestamps
          const outboundTime = data.schedule?.outbound_flight_departure_time?.toDate
            ? data.schedule.outbound_flight_departure_time.toDate()
            : data.schedule?.outbound_flight_departure_time
            ? new Date(data.schedule.outbound_flight_departure_time)
            : new Date();

          return {
            id: doc.id,
            ...data,
            outboundTime,
          } as OwnerReservationItem;
        });
      } catch (error) {
        console.error("Error fetching owner reservations in useOwnerReservations:", error);
        throw error;
      }
    }
  });
}
