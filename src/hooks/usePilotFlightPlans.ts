import { db } from "@/config/firebase";
import { FlightPlanDoc } from "@/types/pilot";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export function usePilotFlightPlans(pilotId: string | undefined) {
  return useQuery<FlightPlanDoc[]>({
    queryKey: ["pilot-flight-plans", pilotId],
    queryFn: async () => {
      if (!pilotId) return [];

      try {
        const q = query(
          collection(db, "flight-plans"),
          where("pilot_id", "==", pilotId)
        );

        const snapshot = await getDocs(q);
        const plans: FlightPlanDoc[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          plans.push({
            id: docSnap.id,
            flight_plan: data.flight_plan,
            aircraft_reservation_id: data.aircraft_reservation_id,
            airports: data.airports,
            pilot_id: data.pilot_id,
            status: data.status,
            updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
            created_at: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date(),
          });
        });

        // Sort flight plans by earliest flight departure UTC time (ascending)
        plans.sort((a, b) => {
          const timeA = a.flight_plan?.departure?.datetime_utc
            ? new Date(a.flight_plan.departure.datetime_utc).getTime()
            : 0;
          const timeB = b.flight_plan?.departure?.datetime_utc
            ? new Date(b.flight_plan.departure.datetime_utc).getTime()
            : 0;

          const dateA = !isNaN(timeA) && timeA > 0 ? timeA : Infinity;
          const dateB = !isNaN(timeB) && timeB > 0 ? timeB : Infinity;

          if (dateA !== dateB) {
            return dateA - dateB;
          }

          // Fallback to update date if departure dates are equal or missing
          const updatedA = a.updated_at instanceof Date ? a.updated_at.getTime() : 0;
          const updatedB = b.updated_at instanceof Date ? b.updated_at.getTime() : 0;
          return updatedA - updatedB;
        });

        return plans;
      } catch (error) {
        console.error("Error fetching pilot flight plans from Firestore:", error);
        return [];
      }
    },
    enabled: !!pilotId,
  });
}
