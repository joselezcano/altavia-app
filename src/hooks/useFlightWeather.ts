import {
    FlightWeather,
    FlightWeatherRequest,
    OpenMeteoForecastResponse,
    OpenMeteoForecastResponseSchema,
    WeatherLocation,
} from "@/types/weather";
import { pickWeatherPoint, WEATHER_MAX_DAYS_AHEAD, weatherLocationKey } from "@/utils/flight-weather";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const HOURLY_VARIABLES = [
    "temperature_2m",
    "precipitation_probability",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "is_day",
].join(",");

/** Pronóstico horario (8 días, para cubrir los próximos 7 completos) de un punto. */
export async function fetchOpenMeteoForecast(latitude: number, longitude: number): Promise<OpenMeteoForecastResponse> {
    const url =
        `${OPEN_METEO_URL}?latitude=${latitude}&longitude=${longitude}` +
        `&hourly=${HOURLY_VARIABLES}` +
        `&wind_speed_unit=kmh&timeformat=unixtime&timezone=GMT&forecast_days=${WEATHER_MAX_DAYS_AHEAD + 1}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Open-Meteo respondió ${response.status}`);
        }
        const json = await response.json();
        const parsed = OpenMeteoForecastResponseSchema.safeParse(json);
        if (!parsed.success) {
            throw new Error("Respuesta de Open-Meteo con formato inesperado");
        }
        return parsed.data;
    } catch (error) {
        console.warn("No se pudo obtener el pronóstico de Open-Meteo:", error);
        throw error;
    }
}

const forecastQuery = (location: WeatherLocation | null) => {
    const [lat, lon] = location ? weatherLocationKey(location) : [0, 0];
    return {
        queryKey: ["open-meteo-forecast", lat, lon],
        queryFn: () => fetchOpenMeteoForecast(lat, lon),
        enabled: !!location,
        staleTime: 1000 * 60 * 45, // 45 minutos
        gcTime: 1000 * 60 * 120,
        retry: 1,
    };
};

/**
 * Clima en origen (a la hora de salida) y destino (a la hora de llegada estimada) de un tramo.
 * Una consulta por aeropuerto (coordenadas redondeadas), así varias cards que comparten
 * aeropuerto usan la misma respuesta en caché.
 * Si `request` es null (vuelo no confirmado, a más de 7 días, sin coordenadas) no consulta nada.
 * Ante un error devuelve `data: null`: la UI simplemente no muestra el bloque.
 */
export function useFlightWeather(request: FlightWeatherRequest | null) {
    // Consultas sin duplicados: TanStack avisa "Duplicate Queries" si dos tienen la misma clave
    // (vuelo sin clima → sin consultas; mismo aeropuerto en origen y destino → una sola).
    const originKey = request ? weatherLocationKey(request.origin).join(",") : null;
    const destinationKey = request ? weatherLocationKey(request.destination).join(",") : null;
    const locations: WeatherLocation[] = [];
    if (request) {
        locations.push(request.origin);
        if (destinationKey !== originKey) locations.push(request.destination);
    }
    const results = useQueries({ queries: locations.map((loc) => forecastQuery(loc)) });

    const empty = { data: undefined, isLoading: false } as const;
    const originResult = results[0] ?? empty;
    const destinationResult = destinationKey === originKey ? originResult : results[1] ?? empty;
    const departureMs = request?.departureTime.getTime();
    const arrivalMs = request?.arrivalTime?.getTime();

    const data = useMemo<FlightWeather | null>(() => {
        if (!request || departureMs === undefined) return null;
        const origin = originResult.data
            ? pickWeatherPoint(originResult.data.hourly, new Date(departureMs), request.origin.label)
            : null;
        const destination = destinationResult.data
            ? pickWeatherPoint(destinationResult.data.hourly, new Date(arrivalMs ?? departureMs), request.destination.label)
            : null;
        if (!origin && !destination) return null;
        return { origin, destination };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [originResult.data, destinationResult.data, departureMs, arrivalMs, request?.origin.label, request?.destination.label]);

    return {
        data,
        isLoading: !!request && (originResult.isLoading || destinationResult.isLoading),
    };
}
