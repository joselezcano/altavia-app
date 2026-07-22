import { db } from "@/config/firebase";
import { AircraftAvailabilityDoc } from "@/types/all-roles";
import { FlightSearchForm } from "@/types/client";
import { AircraftSpecs } from "@/types/owner";
import { getDistanceBetweenAirports } from "@/utils/flight-distance";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface AircraftSpecsDoc extends AircraftSpecs {
  id: string;
}

export interface SearchResultItem {
  aircraft: AircraftSpecsDoc;
  flightDurationHours: number;
  distanceNm: number;
}

function isDateMatch(avail: AircraftAvailabilityDoc, targetDateStr: string): boolean {
  if (targetDateStr < avail.selected_date) return false;

  const start = new Date(avail.selected_date + "T00:00:00");
  const target = new Date(targetDateStr + "T00:00:00");
  const diffTime = target.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const period = avail.recurrence?.period || "none";
  const interval = avail.recurrence?.interval || 1;
  const endsType = avail.recurrence?.ends?.type || "never";
  const endsDate = avail.recurrence?.ends?.date || null;
  const endsOccurrences = avail.recurrence?.ends?.occurrences || 0;

  if (endsType === "date" && endsDate && targetDateStr > endsDate) {
    return false;
  }

  if (period === "none") {
    return targetDateStr === avail.selected_date;
  }

  if (period === "daily") {
    if (diffDays % interval !== 0) return false;
    if (endsType === "occurrences") {
      const occurrenceIndex = diffDays / interval;
      if (occurrenceIndex >= endsOccurrences) return false;
    }
    return true;
  }

  if (period === "weekly") {
    const weekdaysEng = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayName = weekdaysEng[target.getDay()];
    const daysOfWeek = avail.recurrence?.days_of_week || [];
    if (!daysOfWeek.includes(targetDayName as any)) return false;

    const startSun = new Date(start);
    startSun.setDate(start.getDate() - start.getDay());
    const targetSun = new Date(target);
    targetSun.setDate(target.getDate() - target.getDay());
    const diffWeeksTime = targetSun.getTime() - startSun.getTime();
    const diffWeeks = Math.round(diffWeeksTime / (1000 * 60 * 60 * 24 * 7));
    if (diffWeeks % interval !== 0) return false;

    if (endsType === "occurrences") {
      let occurrencesCount = 0;
      let current = new Date(start);
      while (current <= target) {
        const currentDayName = weekdaysEng[current.getDay()];
        if (daysOfWeek.includes(currentDayName as any)) {
          const currSun = new Date(current);
          currSun.setDate(current.getDate() - current.getDay());
          const wTime = currSun.getTime() - startSun.getTime();
          const wDiff = Math.round(wTime / (1000 * 60 * 60 * 24 * 7));
          if (wDiff % interval === 0) {
            occurrencesCount++;
          }
        }
        if (current.getTime() === target.getTime()) {
          break;
        }
        current.setDate(current.getDate() + 1);
      }
      if (occurrencesCount > endsOccurrences) return false;
    }
    return true;
  }

  if (period === "monthly") {
    if (start.getDate() !== target.getDate()) return false;
    const monthDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    if (monthDiff % interval !== 0) return false;
    if (endsType === "occurrences") {
      const occurrenceIndex = monthDiff / interval;
      if (occurrenceIndex >= endsOccurrences) return false;
    }
    return true;
  }

  if (period === "yearly") {
    if (start.getDate() !== target.getDate() || start.getMonth() !== target.getMonth()) return false;
    const yearDiff = target.getFullYear() - start.getFullYear();
    if (yearDiff % interval !== 0) return false;
    if (endsType === "occurrences") {
      const occurrenceIndex = yearDiff / interval;
      if (occurrenceIndex >= endsOccurrences) return false;
    }
    return true;
  }

  return false;
}

function checkFlightOverlap(
  unavailabilities: AircraftAvailabilityDoc[],
  flightStart: Date,
  flightEnd: Date
): boolean {
  for (const avail of unavailabilities) {
    if ((!avail.recurrence || avail.recurrence.period === "none") && avail.start_timestamp && avail.end_timestamp) {
      if (flightStart.getTime() < avail.end_timestamp.getTime() && flightEnd.getTime() > avail.start_timestamp.getTime()) {
        return true;
      }
    }

    let curDate = new Date(flightStart);
    curDate.setHours(0, 0, 0, 0);

    const endDateLimit = new Date(flightEnd);
    endDateLimit.setHours(23, 59, 59, 999);

    while (curDate <= endDateLimit) {
      const year = curDate.getFullYear();
      const monthStr = String(curDate.getMonth() + 1).padStart(2, "0");
      const dayStr = String(curDate.getDate()).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      if (isDateMatch(avail, dateStr)) {
        const [sH, sM] = (avail.start_time || "00:00").split(":").map(Number);
        let [eH, eM] = (avail.end_time || "23:59").split(":").map(Number);

        const availStart = avail.start_timestamp
          ? avail.start_timestamp
          : new Date(
            year,
            curDate.getMonth(),
            curDate.getDate(),
            avail.all_day ? 0 : sH,
            avail.all_day ? 0 : sM,
            0,
            0
          );
        const availEnd = avail.end_timestamp
          ? avail.end_timestamp
          : new Date(
            year,
            curDate.getMonth(),
            curDate.getDate(),
            avail.all_day ? 23 : eH === 24 ? 23 : eH,
            avail.all_day ? 59 : eH === 24 ? 59 : eM,
            59,
            999
          );

        if (flightStart.getTime() < availEnd.getTime() && flightEnd.getTime() > availStart.getTime()) {
          return true;
        }
      }

      curDate.setDate(curDate.getDate() + 1);
    }
  }

  return false;
}

export function useAvailableAircrafts(searchForm: FlightSearchForm | null) {
  return useQuery<SearchResultItem[]>({
    queryKey: ["available-aircrafts", searchForm],
    queryFn: async () => {
      if (
        !searchForm ||
        !searchForm.trip?.origin_airport ||
        !searchForm.trip?.destination_airport ||
        !searchForm.schedule?.outbound_flight_datetime_utc
      ) {
        return [];
      }

      const originIdent = searchForm.trip.origin_airport_ident;
      const requestedPax = searchForm.capacity?.passangers || 1;

      // First step: Get all AircraftSpecs
      const specsSnapshot = await getDocs(collection(db, "AircraftSpecs"));
      const candidateAircrafts: AircraftSpecsDoc[] = [];

      specsSnapshot.forEach((docSnap) => {
        const data = docSnap.data() as AircraftSpecs;
        // TODO: Check if pax count includes pilots in all forms.
        // Filter 1: Aircraft base airport same as origin airport and pax_count >= capacity requested
        if (
          data.base_airport?.ident === originIdent &&
          data.basic_specs &&
          data.basic_specs.pax_count >= requestedPax
        ) {
          candidateAircrafts.push({
            id: docSnap.id,
            ...data,
          });
        }
      });

      if (candidateAircrafts.length === 0) {
        return [];
      }

      // Second step: Get all unavailability docs for candidate airplanes
      const candidateIds = candidateAircrafts.map((ac) => ac.id);

      const availabilitiesByAircraft: Record<string, AircraftAvailabilityDoc[]> = {};
      candidateIds.forEach((id) => {
        availabilitiesByAircraft[id] = [];
      });

      const chunkSize = 10;
      for (let i = 0; i < candidateIds.length; i += chunkSize) {
        const chunk = candidateIds.slice(i, i + chunkSize);
        const qAvail = query(
          collection(db, "aircraft-availability"),
          where("aircraftId", "in", chunk)
        );
        const availSnap = await getDocs(qAvail);

        availSnap.forEach((docSnap) => {
          const data = docSnap.data();

          // We do not need to recalculate start and end timestamps.
          const start_timestamp = data.start_timestamp.toDate();

          const end_timestamp = data.end_timestamp.toDate();

          const docObj: AircraftAvailabilityDoc = {
            id: docSnap.id,
            ...data,
            start_timestamp,
            end_timestamp,
          } as AircraftAvailabilityDoc;

          if (availabilitiesByAircraft[data.aircraftId]) {
            availabilitiesByAircraft[data.aircraftId].push(docObj);
          }
        });
      }

      // Third & Fourth steps: Calculate flight time and check for unavailability overlaps
      const distanceNm = getDistanceBetweenAirports(
        searchForm.trip.origin_airport,
        searchForm.trip.destination_airport,
        "nm"
      );

      const finalResults: SearchResultItem[] = [];

      const outboundStart = new Date(searchForm.schedule.outbound_flight_datetime_utc);

      let returnStart: Date | null = null;
      if (searchForm.schedule.roundtrip && searchForm.schedule.return_flight_datetime_utc) {
        returnStart = new Date(searchForm.schedule.return_flight_datetime_utc);
      }

      for (const aircraft of candidateAircrafts) {
        // TODO: cruise_speed_knots must be mandatory in AircraftSpecs
        const cruiseSpeedKnots = aircraft.operating_specs?.cruise_speed_knots || 120;
        const durationHours = distanceNm / cruiseSpeedKnots;
        const durationMs = durationHours * 3600 * 1000;

        const outboundEnd = new Date(outboundStart.getTime() + durationMs);

        const unavails = availabilitiesByAircraft[aircraft.id] || [];

        // Check outbound flight schedule
        const outboundConflict = checkFlightOverlap(unavails, outboundStart, outboundEnd);
        if (outboundConflict) {
          continue;
        }

        // Check return flight schedule if roundtrip
        if (returnStart) {
          const returnEnd = new Date(returnStart.getTime() + durationMs);
          const returnConflict = checkFlightOverlap(unavails, returnStart, returnEnd);
          if (returnConflict) {
            continue;
          }
        }

        finalResults.push({
          aircraft,
          flightDurationHours: durationHours,
          distanceNm,
        });
      }

      return finalResults;
    },
    enabled:
      !!searchForm &&
      !!searchForm.trip?.origin_airport &&
      !!searchForm.trip?.destination_airport &&
      !!searchForm.schedule?.outbound_flight_datetime_utc,
  });
}
