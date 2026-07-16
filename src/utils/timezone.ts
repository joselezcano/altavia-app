import { find } from 'geo-tz/dist/find-now';

export const getAirportTimezone = (latitude: number, longitude: number) => {
    return find(latitude, longitude);
}