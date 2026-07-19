// To calculate the straight-line (great-circle) distance between two airports,
// use the Haversine Formula. It computes the shortest distance over the Earth's
// curved surface using the exact latitude and longitude of each airport's
// reference point.

import { Airport } from "@/types/all-roles";

export const getDistanceBetweenAirports = (origin_airport: Airport | undefined, destination_airport: Airport | undefined, unit: 'km' | 'nm' | 'mi') => {
    if (!origin_airport || !destination_airport) {
        return 0;
    }

    // Radius of the Earth in kilometers or nautical miles or miles
    const R = unit === 'km' ? 6371 : unit === 'nm' ? 3440.1 : 3958.8;

    const dLat = (destination_airport.latitude_deg - origin_airport.latitude_deg) * (Math.PI / 180);
    const dLon = (destination_airport.longitude_deg - origin_airport.longitude_deg) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(origin_airport.latitude_deg * (Math.PI / 180)) *
        Math.cos(destination_airport.latitude_deg * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;

    // central angle
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    return distance;
}
