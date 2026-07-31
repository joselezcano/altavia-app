import { db } from "@/config/firebase";
import { FlightPlanDoc } from "@/types/pilot";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export function useFlightPlanByReservation(reservationId: string | undefined) {
  return useQuery<FlightPlanDoc | null>({
    queryKey: ["flight-plan-reservation", reservationId],
    queryFn: async () => {
      if (!reservationId) return null;

      try {
        const q = query(
          collection(db, "flight-plans"),
          where("aircraft_reservation_id", "==", reservationId)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        return {
          id: docSnap.id,
          flight_plan: data.flight_plan,
          aircraft_reservation_id: data.aircraft_reservation_id,
          pilot_id: data.pilotId || data.pilot_id,
          status: data.status || "Pending",
          updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
          created_at: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date(),
        };
      } catch (error) {
        console.error("Error fetching flight plan by reservation:", error);
        return null;
      }
    },
    enabled: !!reservationId,
  });
}
