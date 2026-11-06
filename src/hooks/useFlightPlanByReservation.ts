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
      if (!reservationId) return null;

      try {
        const q = query(
          collection(db, "flight-plans"),
          where("aircraft_reservation_id", "==", reservationId)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        // If origin and destination were passed, find the specific leg matching either ident or ICAO
        if (origin && destination) {
          const matchingDoc = snapshot.docs.find((docSnap) => {
            const data = docSnap.data() as any;
            const depIdent = data.airports?.origin_ident?.toUpperCase();
            const arrIdent = data.airports?.destination_ident?.toUpperCase();
            const depIcao = data.flight_plan?.departure?.icao?.toUpperCase();
            const arrIcao = data.flight_plan?.arrival?.icao?.toUpperCase();

            const targetDep = origin.toUpperCase();
            const targetArr = destination.toUpperCase();

            const matchesOrigin = depIdent === targetDep || depIcao === targetDep;
            const matchesDestination = arrIdent === targetArr || arrIcao === targetArr;

            return matchesOrigin && matchesDestination;
          });

          if (matchingDoc) {
            const data = matchingDoc.data();
            return {
              id: matchingDoc.id,
              flight_plan: data.flight_plan,
              aircraft_reservation_id: data.aircraft_reservation_id,
              airports: data.airports,
              pilot_id: data.pilot_id,
              status: data.status,
              updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
              created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at || new Date(),
            } as FlightPlanDoc;
          }
        }

        // If no specific match or no origin/destination passed, return the first one found
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();
        return {
          id: firstDoc.id,
          flight_plan: data.flight_plan,
          aircraft_reservation_id: data.aircraft_reservation_id,
          airports: data.airports,
          pilot_id: data.pilot_id,
          status: data.status,
          updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at || new Date(),
          created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at || new Date(),
        } as FlightPlanDoc;
      } catch (error) {
        console.error("Error fetching flight plan by reservation:", error);
        return null;
      }
    },
    enabled: !!reservationId,
  });
}
