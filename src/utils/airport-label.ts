import { Airport } from "@/types/all-roles";

/**
 * Código corto de un aeropuerto para las cards de vuelos.
 * Cliente / owner: IATA primero (más conocido). Piloto: ICAO primero (el que usa en el FPL).
 */
export function airportShortCode(
    airport?: Airport | null,
    fallbackIdent?: string,
    prefer: "iata" | "icao" = "iata"
): string {
    const iata = airport?.iata_code?.trim();
    const icao = airport?.icao_code?.trim();
    const first = prefer === "icao" ? icao || iata : iata || icao;
    return first || airport?.ident || fallbackIdent || "—";
}

/** Ciudad (o nombre) del aeropuerto, para la línea chica debajo del código. */
export function airportCityName(airport?: Airport | null): string {
    return airport?.municipality?.trim() || airport?.name || "";
}
