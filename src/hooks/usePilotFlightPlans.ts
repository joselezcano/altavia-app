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
          where("pilotId", "==", pilotId)
        );

        const snapshot = await getDocs(q);
        const plans: FlightPlanDoc[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          plans.push({
            id: docSnap.id,
            flight_plan: data.flight_plan,
            aircraft_reservation_id: data.aircraft_reservation_id,
            pilot_id: data.pilotId,
            status: data.status || "Pending",
            updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
            created_at: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date(),
          });
        });

        // Sort flight plans by creation date (newest first)
        plans.sort((a, b) => {
          const timeA = a.created_at instanceof Date ? a.created_at.getTime() : 0;
          const timeB = b.created_at instanceof Date ? b.created_at.getTime() : 0;
          return timeB - timeA;
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
