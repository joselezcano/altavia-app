import type { PassengerManifestItem } from "@/types/all-roles";

/** Contenido decodificado del QR del boarding pass (`altago:bp:v1:{reservationId}:{passengerId}:{token}`). */
export interface BoardingQrPayload {
    version: "v1";
    reservationId: string;
    passengerId: string;
    token: string;
}

/** Motivos por los que un QR no habilita el embarque. */
export type BoardingRejectReason =
    | "invalid_format" // no es un QR de AltaGo
    | "other_reservation" // QR válido pero de otra reserva
    | "unknown_passenger" // el pasajero no está en el manifiesto
    | "token_mismatch" // token distinto (QR viejo, editado o falsificado)
    | "not_paid" // la reserva no está pagada
    | "canceled" // la reserva está cancelada
    | "not_found" // no se pudo leer la reserva
    | "error"; // error de red / permisos

/** Resultado de validar (y eventualmente registrar) un escaneo. */
export type BoardingScanResult =
    | { kind: "boarded"; passenger: PassengerManifestItem }
    | { kind: "already_boarded"; passenger: PassengerManifestItem }
    | { kind: "rejected"; reason: BoardingRejectReason; message: string; passenger?: PassengerManifestItem };

/** Validación previa al registro: ok (con aviso si el vuelo no es hoy) o rechazo. */
export type BoardingPrecheck =
    | { ok: true; passenger: PassengerManifestItem; isFlightToday: boolean; alreadyBoarded: boolean }
    | { ok: false; result: Extract<BoardingScanResult, { kind: "rejected" }> };

/** Datos que muestra la pantalla de boarding pass. */
export interface BoardingPassData {
    reservationId: string;
    passengers: PassengerManifestItem[];
}

/** Vista mínima de la reserva para validar un embarque (se arma desde Firestore o desde la caché). */
export interface BoardingReservationSnapshot {
    id: string;
    clientStatus: string;
    internalStatus: string;
    paid: boolean;
    passengers: PassengerManifestItem[];
    /** Salidas del vuelo (ida y, si es ida y vuelta, vuelta). */
    departures: Date[];
}
