import { Airport } from '@/types/all-roles';
import tzlookup from '@photostructure/tz-lookup';

export const getAirportTimezone = (airport: Airport) => {
    return tzlookup(airport.latitude_deg, airport.longitude_deg);
}