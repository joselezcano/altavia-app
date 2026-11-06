import { db } from "@/config/firebase";
import { Airport, ClientReservationItem } from "@/types/all-roles";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

export function useReservationDetails(reservationId: string | undefined) {
  return useQuery<ClientReservationItem | null>({
    queryKey: ["reservation-details", reservationId],
    queryFn: async () => {
      if (!reservationId) return null;

      try {
        const resDocRef = doc(db, "aircraft-reservation", reservationId);
        const resSnap = await getDoc(resDocRef);
        if (!resSnap.exists()) return null;

        const data = resSnap.data();

        const outbound_flight_departure_time = data.schedule?.outbound_flight_departure_time?.toDate
          ? data.schedule.outbound_flight_departure_time.toDate()
          : data.schedule?.outbound_flight_departure_time
            ? new Date(data.schedule.outbound_flight_departure_time)
            : new Date();

        const outbound_flight_arrival_time = data.schedule?.outbound_flight_arrival_time?.toDate
          ? data.schedule.outbound_flight_arrival_time.toDate()
          : data.schedule?.outbound_flight_arrival_time
            ? new Date(data.schedule.outbound_flight_arrival_time)
            : new Date();

        const return_flight_departure_time = data.schedule?.return_flight_departure_time?.toDate
          ? data.schedule.return_flight_departure_time.toDate()
          : data.schedule?.return_flight_departure_time
            ? new Date(data.schedule.return_flight_departure_time)
            : null;

        const return_flight_arrival_time = data.schedule?.return_flight_arrival_time?.toDate
          ? data.schedule.return_flight_arrival_time.toDate()
          : data.schedule?.return_flight_arrival_time
            ? new Date(data.schedule.return_flight_arrival_time)
            : null;

        const created_at = data.created_at?.toDate
          ? data.created_at.toDate()
          : data.created_at
            ? new Date(data.created_at)
            : undefined;

        const paid_at = data.paid_at?.toDate
          ? data.paid_at.toDate()
          : data.paid_at
            ? new Date(data.paid_at)
            : undefined;

        // Fetch Aircraft Specs
        let aircraftSpecs: AircraftSpecs | undefined;
        if (data.aircraftId) {
          try {
            const specDocRef = doc(db, "AircraftSpecs", data.aircraftId);
            const specSnap = await getDoc(specDocRef);
            if (specSnap.exists()) {
              aircraftSpecs = specSnap.data() as AircraftSpecs;
            }
          } catch (e) {
            console.error("Error fetching aircraft specs in useReservationDetails:", e);
          }
        }

        // Fetch Airport helper
        const fetchAirport = async (ident?: string): Promise<Airport | undefined> => {
          if (!ident) return undefined;
          try {
            const airportDocRef = doc(db, "airports", ident);
            const airportSnap = await getDoc(airportDocRef);
            if (airportSnap.exists()) {
              return airportSnap.data() as Airport;
            }

            const airportQ = query(collection(db, "airports"), where("ident", "==", ident), limit(1));
            const querySnap = await getDocs(airportQ);
            if (!querySnap.empty) {
              return querySnap.docs[0].data() as Airport;
            }
          } catch (e) {
            console.error(`Error fetching airport ${ident} in useReservationDetails:`, e);
          }
          return undefined;
        };

        const originAirport = await fetchAirport(data.trip?.origin_airport_ident);
        const destinationAirport = await fetchAirport(data.trip?.destination_airport_ident);

        return {
          id: resSnap.id,
          aircraftId: data.aircraftId,
          fa_flight_id: data.fa_flight_id || null,
          clientId: data.clientId,
          price: data.price ?? 0,
          estimated_price: data.estimated_price,
          currency: data.currency || "USD",
          distance_nm: data.distance_nm ?? 0,
          cruise_speed_knots: data.cruise_speed_knots ?? 120,
          trip: data.trip,
          schedule: {
            roundtrip: !!data.schedule?.roundtrip,
            outbound_flight_departure_time,
            outbound_flight_arrival_time,
            return_flight_departure_time,
            return_flight_arrival_time,
          },
          capacity: data.capacity,
          passengers: data.passengers || [],
          event_ids: data.event_ids || [],
          client_status: data.client_status || "unpaid",
          internal_status: data.internal_status || "pending",
          status_notes: data.status_notes || "",
          pilot_ids: data.pilot_ids || data.pilots_ids || [],
          created_at,
          paid_at,
          payment_method: data.payment_method,
          payment_transaction_id: data.payment_transaction_id,
          invoice_number: data.invoice_number,
          invoice_timbrado: data.invoice_timbrado,
          invoice_cdc: data.invoice_cdc,
          invoice_url: data.invoice_url,
          aircraftSpecs,
          originAirport,
          destinationAirport,
        } as ClientReservationItem;
      } catch (error) {
        console.error("Error fetching reservation details:", error);
        return null;
      }
    },
    enabled: !!reservationId,
  });
}
