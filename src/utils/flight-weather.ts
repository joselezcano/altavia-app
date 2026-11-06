import { Airport, ClientReservationItem } from "@/types/all-roles";
import {
    FlightWeatherRequest,
    OpenMeteoHourly,
    WeatherCodeInfo,
    WeatherLocation,
    WeatherPoint,
} from "@/types/weather";

/** Estados en los que se muestra el pronóstico (vuelo confirmado o demorado). */
export const WEATHER_STATUSES = ["confirmed", "delayed"];

/** Open-Meteo pronostica hasta 16 días; acá solo mostramos los próximos 7. */
export const WEATHER_MAX_DAYS_AHEAD = 7;

const KMH_PER_KNOT = 1.852;
/** Si la hora pedida queda más lejos que esto del pronóstico disponible, no se muestra. */
const MAX_HOUR_DISTANCE_MS = 90 * 60 * 1000;

const toValidDate = (value: unknown): Date | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value as any);
    return isNaN(d.getTime()) ? null : d;
};

/** La salida está en el futuro y dentro de los próximos 7 días. */
export function isWithinForecastWindow(departure: Date | null | undefined, now = Date.now()): boolean {
    const d = toValidDate(departure);
    if (!d) return false;
    const t = d.getTime();
    return t > now && t <= now + WEATHER_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
}

/** Ubicación de un aeropuerto para el pronóstico, o null si no tiene coordenadas válidas. */
export function airportToWeatherLocation(airport?: Airport | null, fallbackLabel?: string): WeatherLocation | null {
    if (!airport) return null;
    const latitude = Number(airport.latitude_deg);
    const longitude = Number(airport.longitude_deg);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude === 0 && longitude === 0) return null;
    const label =
        airport.iata_code?.trim() ||
        airport.icao_code?.trim() ||
        airport.ident ||
        fallbackLabel ||
        "";
    return { latitude, longitude, label };
}

/**
 * Pedido de pronóstico para un tramo puntual (lo usa la lista del piloto, que ya separa ida y vuelta).
 * Devuelve null si el vuelo no está confirmado/demorado, si sale en más de 7 días o ya salió,
 * o si faltan coordenadas.
 */
export function buildLegWeatherRequest(params: {
    internalStatus?: string;
    originAirport?: Airport | null;
    destinationAirport?: Airport | null;
    departureTime?: Date | null;
    arrivalTime?: Date | null;
}): FlightWeatherRequest | null {
    if (!params.internalStatus || !WEATHER_STATUSES.includes(params.internalStatus)) return null;
    const departure = toValidDate(params.departureTime);
    if (!departure || !isWithinForecastWindow(departure)) return null;
    const origin = airportToWeatherLocation(params.originAirport);
    const destination = airportToWeatherLocation(params.destinationAirport);
    if (!origin || !destination) return null;
    const arrival = toValidDate(params.arrivalTime);
    return {
        origin,
        destination,
        departureTime: departure,
        arrivalTime: arrival && arrival.getTime() > departure.getTime() ? arrival : null,
    };
}

/**
 * Pedido de pronóstico para una reserva completa: toma el próximo tramo que todavía no salió
 * (la ida o, si ya pasó, la vuelta de un ida y vuelta).
 */
export function buildReservationWeatherRequest(reservation?: ClientReservationItem | null): FlightWeatherRequest | null {
    if (!reservation) return null;
    const { schedule } = reservation;
    const outbound = buildLegWeatherRequest({
        internalStatus: reservation.internal_status,
        originAirport: reservation.originAirport,
        destinationAirport: reservation.destinationAirport,
        departureTime: schedule?.outbound_flight_departure_time,
        arrivalTime: schedule?.outbound_flight_arrival_time,
    });
    if (outbound) return outbound;

    const outboundDeparture = toValidDate(schedule?.outbound_flight_departure_time);
    const outboundAlreadyLeft = !!outboundDeparture && outboundDeparture.getTime() <= Date.now();
    if (schedule?.roundtrip && outboundAlreadyLeft) {
        return buildLegWeatherRequest({
            internalStatus: reservation.internal_status,
            originAirport: reservation.destinationAirport,
            destinationAirport: reservation.originAirport,
            departureTime: schedule.return_flight_departure_time,
            arrivalTime: schedule.return_flight_arrival_time,
        });
    }
    return null;
}

/** Clave estable de caché: coordenadas redondeadas a 2 decimales (~1 km). */
export function weatherLocationKey(location: WeatherLocation): [number, number] {
    return [Math.round(location.latitude * 100) / 100, Math.round(location.longitude * 100) / 100];
}

export function kmhToKnots(kmh: number | null | undefined): number | null {
    if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return null;
    return Math.round(kmh / KMH_PER_KNOT);
}

export function windCardinal(deg: number | null | undefined): string | null {
    if (deg === null || deg === undefined || !Number.isFinite(deg)) return null;
    const points = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    const normalized = ((deg % 360) + 360) % 360;
    return points[Math.round(normalized / 45) % 8];
}

/** Pronóstico del aeropuerto a la hora más cercana a `target` (o null si no hay datos cerca). */
export function pickWeatherPoint(hourly: OpenMeteoHourly | undefined, target: Date, label: string): WeatherPoint | null {
    if (!hourly?.time?.length) return null;
    const targetSec = target.getTime() / 1000;
    let bestIdx = -1;
    let bestDiff = Infinity;
    hourly.time.forEach((t, idx) => {
        const diff = Math.abs(t - targetSec);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = idx;
        }
    });
    if (bestIdx < 0 || bestDiff * 1000 > MAX_HOUR_DISTANCE_MS) return null;

    const at = <T,>(arr?: (T | null)[]) => (arr && arr[bestIdx] !== undefined ? arr[bestIdx] : null);
    const temperature = at(hourly.temperature_2m);
    const windSpeed = at(hourly.wind_speed_10m);
    const windGusts = at(hourly.wind_gusts_10m);
    const windDirection = at(hourly.wind_direction_10m);
    const isDay = at(hourly.is_day);

    return {
        label,
        time: new Date(hourly.time[bestIdx] * 1000),
        weatherCode: at(hourly.weather_code),
        isDay: isDay === null ? true : isDay === 1,
        temperatureC: temperature === null ? null : Math.round(temperature),
        precipitationProbability: at(hourly.precipitation_probability),
        windSpeedKmh: windSpeed === null ? null : Math.round(windSpeed),
        windSpeedKt: kmhToKnots(windSpeed),
        windGustsKmh: windGusts === null ? null : Math.round(windGusts),
        windGustsKt: kmhToKnots(windGusts),
        windDirectionDeg: windDirection === null ? null : Math.round(windDirection),
        windDirectionCardinal: windCardinal(windDirection),
    };
}

/** Ícono y descripción según el weathercode WMO de Open-Meteo. */
export function getWeatherCodeInfo(code: number | null, isDay = true): WeatherCodeInfo {
    if (code === null || code === undefined) {
        return { label: "Sin datos", icon: "weather-cloudy-alert", color: "#94A3B8" };
    }
    if (code === 0) {
        return isDay
            ? { label: "Despejado", icon: "weather-sunny", color: "#F59E0B" }
            : { label: "Despejado", icon: "weather-night", color: "#5B5D7A" };
    }
    if (code === 1 || code === 2) {
        return isDay
            ? { label: "Parcialmente nublado", icon: "weather-partly-cloudy", color: "#F59E0B" }
            : { label: "Parcialmente nublado", icon: "weather-night-partly-cloudy", color: "#5B5D7A" };
    }
    if (code === 3) return { label: "Nublado", icon: "weather-cloudy", color: "#64748B" };
    if (code === 45 || code === 48) return { label: "Niebla", icon: "weather-fog", color: "#64748B" };
    if (code >= 51 && code <= 57) return { label: "Llovizna", icon: "weather-rainy", color: "#0165FF" };
    if (code >= 61 && code <= 67) return { label: "Lluvia", icon: "weather-pouring", color: "#0165FF" };
    if (code >= 71 && code <= 77) return { label: "Nieve", icon: "weather-snowy", color: "#7AB4FF" };
    if (code >= 80 && code <= 82) return { label: "Chubascos", icon: "weather-pouring", color: "#0165FF" };
    if (code === 85 || code === 86) return { label: "Chubascos de nieve", icon: "weather-snowy-heavy", color: "#7AB4FF" };
    if (code === 95) return { label: "Tormenta", icon: "weather-lightning-rainy", color: "#7C3AED" };
    if (code === 96 || code === 99) return { label: "Tormenta con granizo", icon: "weather-hail", color: "#7C3AED" };
    return { label: "Variable", icon: "weather-cloudy", color: "#64748B" };
}
