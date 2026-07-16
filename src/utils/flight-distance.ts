// To calculate the straight-line (great-circle) distance between two airports,
// use the Haversine Formula. It computes the shortest distance over the Earth's
// curved surface using the exact latitude and longitude of each airport's
// reference point.

export const getDistanceBetweenAirports = (origin_airport_latitude: number, origin_airport_longitude: number, destination_airport_latitude: number, destination_airport_longitude: number, unit: 'km' | 'nm' | 'mi') => {
    const R = unit === 'km' ? 6371 : unit === 'nm' ? 3440.1 : 3958.8; // Radius of the Earth in kilometers or nautical miles or miles
    const dLat = (destination_airport_latitude - origin_airport_latitude) * (Math.PI / 180);
    const dLon = (destination_airport_longitude - origin_airport_longitude) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(origin_airport_latitude * (Math.PI / 180)) *
        Math.cos(destination_airport_latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // central angle
    const distance = R * c;
    return distance;
}
