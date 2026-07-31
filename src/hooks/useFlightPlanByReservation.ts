import { db } from "@/config/firebase";
import { FlightPlanDoc } from "@/types/pilot";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export function useFlightPlanByReservation(
  reservationId: string | undefined,
  origin?: string,
  destination?: string
) {
  return useQuery<FlightPlanDoc | null>({
    queryKey: ["flight-plan-reservation", reservationId, origin, destination],
    queryFn: async () => {
      if (!reservationId || !origin || !destination) return null;

      try {
        const q = query(
          collection(db, "flight-plans"),
          where("aircraft_reservation_id", "==", reservationId)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const matchingDoc = snapshot.docs.find((docSnap) => {
          const data = docSnap.data() as FlightPlanDoc;
          const depIcao = data.airports?.origin_ident;
          const arrIcao = data.airports?.destination_ident;

          const matchesOrigin = depIcao === origin;
          const matchesDestination = arrIcao === destination;

          return matchesOrigin && matchesDestination;
        });

        if (!matchingDoc) return null;

        const data = matchingDoc.data();

        return {
          id: matchingDoc.id,
          flight_plan: data.flight_plan,
          aircraft_reservation_id: data.aircraft_reservation_id,
          airports: data.airports,
          pilot_id: data.pilot_id,
          status: data.status,
          updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
          created_at: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date(),
        } as FlightPlanDoc;
      } catch (error) {
        console.error("Error fetching flight plan by reservation:", error);
        return null;
      }
    },
    enabled: !!reservationId,
  });
}

