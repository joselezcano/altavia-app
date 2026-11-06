import { z } from "zod";

/**
 * Pronóstico del tiempo (Open-Meteo, https://api.open-meteo.com/v1/forecast).
 * Gratis y sin clave. Se pide por hora con `timeformat=unixtime` y `timezone=GMT`,
 * así se compara directo contra el instante (Date) de la salida/llegada del vuelo.
 */
export const OpenMeteoHourlySchema = z.object({
    time: z.array(z.number()),
    temperature_2m: z.array(z.number().nullable()).optional(),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    weather_code: z.array(z.number().nullable()).optional(),
    wind_speed_10m: z.array(z.number().nullable()).optional(),
    wind_direction_10m: z.array(z.number().nullable()).optional(),
    wind_gusts_10m: z.array(z.number().nullable()).optional(),
    is_day: z.array(z.number().nullable()).optional(),
});

export const OpenMeteoForecastResponseSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    hourly: OpenMeteoHourlySchema,
});

export type OpenMeteoHourly = z.infer<typeof OpenMeteoHourlySchema>;
export type OpenMeteoForecastResponse = z.infer<typeof OpenMeteoForecastResponseSchema>;

/** Punto geográfico (aeropuerto) para pedir el pronóstico. */
export interface WeatherLocation {
    latitude: number;
    longitude: number;
    /** Código corto para mostrar (IATA / ICAO / ident). */
    label: string;
}

/** Lo que necesita useFlightWeather para pedir el clima de un tramo. */
export interface FlightWeatherRequest {
    origin: WeatherLocation;
    destination: WeatherLocation;
    /** Salida del tramo: hora del pronóstico en origen. */
    departureTime: Date;
    /** Llegada estimada del tramo: hora del pronóstico en destino (si falta, se usa la salida). */
    arrivalTime?: Date | null;
}

/** Pronóstico de un aeropuerto a una hora puntual. */
export interface WeatherPoint {
    label: string;
    /** Instante (UTC) de la hora del pronóstico elegida. */
    time: Date;
    weatherCode: number | null;
    isDay: boolean;
    temperatureC: number | null;
    precipitationProbability: number | null;
    windSpeedKmh: number | null;
    windSpeedKt: number | null;
    windGustsKmh: number | null;
    windGustsKt: number | null;
    /** Dirección DESDE la que sopla el viento, en grados. */
    windDirectionDeg: number | null;
    /** Punto cardinal en español (N, NE, E, SE, S, SO, O, NO). */
    windDirectionCardinal: string | null;
}

export interface FlightWeather {
    origin: WeatherPoint | null;
    destination: WeatherPoint | null;
}

/** Descripción visual de un weathercode WMO. */
export interface WeatherCodeInfo {
    label: string;
    /** Nombre de ícono de MaterialCommunityIcons (familia weather-*). */
    icon: string;
    color: string;
}

export type FlightWeatherVariant = "compact" | "detail";
