import type { Airport, ClientReservationItem } from "./all-roles";
import type { FlightQuote } from "./pricing";

/** Un tramo a bloquear en el calendario de la aeronave (aircraft-availability). */
export interface ReservationLegBlock {
    start: Date;
    end: Date;
    /** Zona horaria del aeropuerto de salida del tramo (vacío = hora del dispositivo). */
    timezone?: string;
    notes: string;
}

/**
 * Datos de la edición de una reserva.
 * - Sin pagar: ruta, fechas, ida/vuelta, pasajeros y precio (con su cotización).
 * - Pagada: solo fechas y horas (route/quote/price/passengers quedan undefined).
 */
export interface ReservationEditInput {
    reservation: ClientReservationItem;
    isPaid: boolean;
    roundtrip: boolean;
    outboundStart: Date;
    outboundEnd: Date;
    returnStart: Date | null;
    returnEnd: Date | null;
    origin?: Airport;
    destination?: Airport;
    distanceNm?: number;
    cruiseSpeedKnots?: number;
    passengers?: number;
    price?: number;
    quote?: FlightQuote;
}

/** Pantallas del stack de vuelos que existen en (owner)/flights y (pilot)/flights. */
export type RoleFlightScreen =
    | "flight-details"
    | "assign-pilots"
    | "create-flight-plan"
    | "view-flight-plan"
    | "edit-reservation"
    | "new-booking"
    | "boarding-scanner";

/** Ruta armada en tiempo de ejecución (se castea a Href en utils/role-routes). */
export interface RoleRoute {
    pathname: string;
    params?: Record<string, string>;
}
