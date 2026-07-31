import { db } from "@/config/firebase";
import { FlightPlanDoc } from "@/types/pilot";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";

export function useFlightPlanDetails(flightPlanId: string | undefined) {
  return useQuery<FlightPlanDoc | null>({
    queryKey: ["flight-plan-details", flightPlanId],
    queryFn: async () => {
      if (!flightPlanId) return null;

      try {
        const docRef = doc(db, "flight-plans", flightPlanId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        const data = docSnap.data();
        return {
          id: docSnap.id,
          flight_plan: data.flight_plan,
          aircraft_reservation_id: data.aircraft_reservation_id,
          airports: data.airports,
          pilot_id: data.pilot_id,
          status: data.status,
          updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
          created_at: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date(),
        };
      } catch (error) {
        console.error("Error fetching flight plan details:", error);
        return null;
      }
    },
    enabled: !!flightPlanId,
  });
}
