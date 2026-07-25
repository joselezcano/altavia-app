import { db } from "@/config/firebase";
import { FlightCurrentPosition, FlightMapWithID } from "@/types/aeroapi";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

function toMillis(val: any): number {
  if (!val) return 0;
  if (typeof val?.toDate === "function") return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number") return val;
  if (typeof val === "string") return new Date(val).getTime();
  if (val?.seconds !== undefined) return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  return 0;
}

export interface FlightTrackerData {
  positionData: FlightCurrentPosition | null;
  mapBase64Image: string;
}

export function useFlightTracker(fa_flight_id: string | undefined) {
  return useQuery<FlightTrackerData>({
    queryKey: ["flight-tracker", fa_flight_id],
    queryFn: async () => {
      if (!fa_flight_id || !fa_flight_id.trim()) {
        return { positionData: null, mapBase64Image: "" };
      }

      const positionQuery = query(
        collection(db, "flight-current-position"),
        where("fa_flight_id", "==", fa_flight_id)
      );
      const positionSnap = await getDocs(positionQuery);

      if (positionSnap.empty) {
        return { positionData: null, mapBase64Image: "" };
      }

      let latestPositionDoc: FlightCurrentPosition | null = null;
      let maxPositionTimestamp = -1;

      positionSnap.docs.forEach((docSnap) => {
        const fp = docSnap.data() as FlightCurrentPosition;
        const ts = toMillis(fp.last_position?.timestamp);
        if (ts > maxPositionTimestamp) {
          maxPositionTimestamp = ts;
          latestPositionDoc = fp;
        }
      });

      if (!latestPositionDoc) {
        return { positionData: null, mapBase64Image: "" };
      }

      let mapBase64Image = "";
      try {
        const mapQuery = query(
          collection(db, "flight-maps"),
          where("fa_flight_id", "==", fa_flight_id)
        );
        const mapSnap = await getDocs(mapQuery);

        let latestMapDoc: FlightMapWithID | null = null;
        let maxMapCreatedAt = -1;

        mapSnap.docs.forEach((docSnap) => {
          const fm = docSnap.data() as FlightMapWithID;
          const ts = toMillis(fm.createdAt);
          if (ts > maxMapCreatedAt) {
            maxMapCreatedAt = ts;
            latestMapDoc = fm;
          }
        });

        if (latestMapDoc && (latestMapDoc as FlightMapWithID).map) {
          mapBase64Image = (latestMapDoc as FlightMapWithID).map;
        }
      } catch (e) {
        console.error("Error fetching flight map:", e);
      }

      return {
        positionData: latestPositionDoc,
        mapBase64Image,
      };
    },
    enabled: !!fa_flight_id && fa_flight_id.trim().length > 0,
  });
}
