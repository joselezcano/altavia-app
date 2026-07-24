import { db } from "@/config/firebase";
import { Airport, ClientReservationItem } from "@/types/all-roles";
import { AircraftSpecs } from "@/types/owner";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

export function useClientReservations(clientId: string | undefined) {
  return useQuery<ClientReservationItem[]>({
    queryKey: ["client-reservations", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const q = query(
        collection(db, "aircraft-reservation"),
        where("clientId", "==", clientId)
      );

      const snapshot = await getDocs(q);
      const items: ClientReservationItem[] = [];

      const specsCache = new Map<string, AircraftSpecs | null>();
      const airportCache = new Map<string, Airport | null>();

      const fetchAircraftSpecs = async (aircraftId?: string): Promise<AircraftSpecs | undefined> => {
        if (!aircraftId) return undefined;
        if (specsCache.has(aircraftId)) {
          return specsCache.get(aircraftId) || undefined;
        }
        try {
          const specDocRef = doc(db, "AircraftSpecs", aircraftId);
          const specSnap = await getDoc(specDocRef);
          if (specSnap.exists()) {
            const data = specSnap.data() as AircraftSpecs;
            specsCache.set(aircraftId, data);
            return data;
          }
        } catch (e) {
          console.error("Error al obtener datos de la aeronave:", e);
        }
        specsCache.set(aircraftId, null);
        return undefined;
      };

      const fetchAirport = async (ident?: string): Promise<Airport | undefined> => {
        if (!ident) return undefined;
        if (airportCache.has(ident)) {
          return airportCache.get(ident) || undefined;
        }
        try {
          // Attempt direct doc fetch first
          const airportDocRef = doc(db, "airports", ident);
          const airportSnap = await getDoc(airportDocRef);
          if (airportSnap.exists()) {
            const data = airportSnap.data() as Airport;
            airportCache.set(ident, data);
            return data;
          }

          // Fallback to query by ident field
          const airportQ = query(collection(db, "airports"), where("ident", "==", ident), limit(1));
          const querySnap = await getDocs(airportQ);
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data() as Airport;
            airportCache.set(ident, data);
            return data;
          }
        } catch (e) {
          console.error(`Error al obtener datos del aeropuerto ${ident}:`, e);
        }
        airportCache.set(ident, null);
        return undefined;
      };

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Convert Firestore Timestamps to standard Date objects
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

        const aircraftSpecs = await fetchAircraftSpecs(data.aircraftId);
        const originAirport = await fetchAirport(data.trip?.origin_airport_ident);
        const destinationAirport = await fetchAirport(data.trip?.destination_airport_ident);

        items.push({
          id: docSnap.id,
          aircraftId: data.aircraftId,
          clientId: data.clientId,
          price: data.price ?? 0,
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
          event_ids: data.event_ids || [],
          client_status: data.client_status || "unpaid",
          internal_status: data.internal_status || "pending",
          status_notes: data.status_notes || "",
          pilot_ids: data.pilot_ids || [],
          created_at,
          aircraftSpecs,
          originAirport,
          destinationAirport,
        });
      }

      // Sort by creation date or outbound departure time (newest first)
      items.sort((a, b) => {
        const timeA = a.schedule.outbound_flight_departure_time.getTime();
        const timeB = b.schedule.outbound_flight_departure_time.getTime();
        return timeB - timeA;
      });

      return items;
    },
    enabled: !!clientId,
  });
}

