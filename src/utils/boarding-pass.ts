/**
 * Boarding pass y embarque con QR.
 *
 * Formato del QR: `altago:bp:v1:{reservationId}:{passengerId}:{boardingToken}`
 * - boardingToken: 18 bytes aleatorios criptográficos (expo-crypto) en base64url (24 caracteres).
 *   Se guarda en el ítem del manifiesto (`passengers[].boardingToken`) y solo lo pueden leer
 *   el cliente de la reserva y el staff (firestore.rules). Sin el token, no se puede armar un QR válido
 *   aunque se conozcan el ID de la reserva y del pasajero.
 * - Si cambian el nombre o el documento de un pasajero, el token se rota: un QR emitido antes
 *   (por ejemplo, una captura) deja de servir.
 * - El escáner del piloto vuelve a leer la reserva de Firestore y valida todo contra el servidor;
 *   el registro (boardedAt / boardedBy) se hace en una transacción para no pisar otros escaneos.
 */
import { db } from "@/config/firebase";
import type { PassengerManifestItem } from "@/types/all-roles";
import type {
    BoardingPrecheck,
    BoardingQrPayload,
    BoardingReservationSnapshot,
    BoardingScanResult,
} from "@/types/boarding";
import { getRandomBytes } from "expo-crypto";
import { doc, getDoc, runTransaction } from "firebase/firestore";

const QR_PREFIX = "altago:bp:v1";
const TOKEN_BYTES = 18;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Estados en los que se puede embarcar (vuelo confirmado o en curso). */
export const BOARDING_STATUSES = ["confirmed", "delayed", "in_flight"];

// ------------------------------------------------------------------ tokens

function toBase64Url(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        out += B64URL[b0 >> 2];
        out += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
        if (i + 1 < bytes.length) out += B64URL[((b1 & 15) << 2) | (b2 >> 6)];
        if (i + 2 < bytes.length) out += B64URL[b2 & 63];
    }
    return out;
}

/** Token aleatorio de embarque (18 bytes → 24 caracteres base64url). */
export function generateBoardingToken(): string {
    return toBase64Url(getRandomBytes(TOKEN_BYTES));
}

function generatePassengerId(): string {
    return `pax_${Date.now()}_${toBase64Url(getRandomBytes(3))}`;
}

/** Comparación sin cortocircuito (no filtra por tiempo cuántos caracteres coinciden). */
function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

// ------------------------------------------------------------------ QR

export function buildBoardingQrValue(reservationId: string, passenger: PassengerManifestItem): string | null {
    if (!passenger.id || !passenger.boardingToken) return null;
    return `${QR_PREFIX}:${reservationId}:${passenger.id}:${passenger.boardingToken}`;
}

export function parseBoardingQr(raw: string): BoardingQrPayload | null {
    const parts = (raw || "").trim().split(":");
    if (parts.length !== 6) return null;
    const [app, kind, version, reservationId, passengerId, token] = parts;
    if (`${app}:${kind}:${version}` !== QR_PREFIX) return null;
    if (!ID_PATTERN.test(reservationId) || !ID_PATTERN.test(passengerId) || !TOKEN_PATTERN.test(token)) return null;
    return { version: "v1", reservationId, passengerId, token };
}

// ------------------------------------------------------------------ manifiesto

/** Quita los `undefined` (Firestore no los acepta dentro de arrays). */
function cleanPassenger(p: PassengerManifestItem): PassengerManifestItem {
    const out: Record<string, unknown> = {};
    Object.entries(p).forEach(([k, v]) => {
        if (v !== undefined) out[k] = v;
    });
    return out as PassengerManifestItem;
}

function samePerson(a: PassengerManifestItem, b: PassengerManifestItem): boolean {
    const norm = (s?: string) => (s || "").trim().toUpperCase();
    return norm(a.fullName) === norm(b.fullName) && norm(a.documentNumber) === norm(b.documentNumber);
}

/** Completa id y boardingToken de los pasajeros que no los tienen. */
export function ensureBoardingFields(passengers: PassengerManifestItem[]): {
    passengers: PassengerManifestItem[];
    changed: boolean;
} {
    let changed = false;
    const list = passengers.map((p) => {
        if (p.id && p.boardingToken) return p;
        changed = true;
        return {
            ...p,
            id: p.id || generatePassengerId(),
            boardingToken: p.boardingToken || generateBoardingToken(),
        };
    });
    return { passengers: list, changed };
}

/**
 * Une el manifiesto editado con el que está en Firestore, conservando los datos de embarque:
 * - mismo pasajero (id) y misma persona → se mantiene el token y el embarque del servidor;
 * - cambió el nombre o el documento → token nuevo y sin embarque;
 * - pasajero nuevo → token nuevo.
 */
export function mergeManifestWithServer(
    local: PassengerManifestItem[],
    server: PassengerManifestItem[]
): PassengerManifestItem[] {
    const merged = local.map((p) => {
        const remote = p.id ? server.find((s) => s.id === p.id) : undefined;
        if (remote && samePerson(p, remote)) {
            return {
                ...p,
                boardingToken: remote.boardingToken || p.boardingToken,
                boardedAt: remote.boardedAt || p.boardedAt,
                boardedBy: remote.boardedBy || p.boardedBy,
            };
        }
        if (remote || p.boardingToken || p.boardedAt) {
            // Otra persona en el mismo lugar del manifiesto: el QR anterior no debe servir.
            return { ...p, boardingToken: generateBoardingToken(), boardedAt: undefined, boardedBy: undefined };
        }
        return p;
    });
    return ensureBoardingFields(merged).passengers.map(cleanPassenger);
}

/**
 * Guarda el manifiesto (lo usa PassengerManifestModal) en una transacción,
 * sin perder tokens ni embarques registrados mientras el modal estaba abierto.
 */
export async function saveManifestPreservingBoarding(
    reservationId: string,
    passengers: PassengerManifestItem[]
): Promise<PassengerManifestItem[]> {
    try {
        const ref = doc(db, "aircraft-reservation", reservationId);
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error("La reserva no existe.");
            const server: PassengerManifestItem[] = Array.isArray(snap.data().passengers) ? snap.data().passengers : [];
            const merged = mergeManifestWithServer(passengers, server);
            tx.update(ref, { passengers: merged });
            return merged;
        });
    } catch (error) {
        console.error("Error al guardar el manifiesto:", error);
        throw error;
    }
}

// ------------------------------------------------------------------ reserva

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === "function") return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

/** Pagada según el mismo criterio que firestore.rules: client_status 'confirmed' o paid_at. */
export function isPaidForBoarding(data: { client_status?: string; paid_at?: unknown }): boolean {
    return data.client_status === "confirmed" || !!data.paid_at;
}

export function isCanceled(data: { client_status?: string; internal_status?: string }): boolean {
    return data.client_status === "canceled" || data.internal_status === "canceled";
}

/** Arma la vista mínima a partir del documento crudo de Firestore o de un ClientReservationItem. */
export function toBoardingSnapshot(id: string, data: any): BoardingReservationSnapshot {
    const departures = [
        toDate(data?.schedule?.outbound_flight_departure_time),
        data?.schedule?.roundtrip ? toDate(data?.schedule?.return_flight_departure_time) : null,
    ].filter((d): d is Date => !!d);
    return {
        id,
        clientStatus: data?.client_status || "unpaid",
        internalStatus: data?.internal_status || "pending",
        paid: isPaidForBoarding(data || {}),
        passengers: Array.isArray(data?.passengers) ? data.passengers : [],
        departures,
    };
}

function sameLocalDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isFlightToday(departures: Date[], now: Date = new Date()): boolean {
    return departures.some((d) => sameLocalDay(d, now));
}

const REJECT_MESSAGES = {
    other_reservation: "Este boarding pass es de otra reserva.",
    unknown_passenger: "El pasajero no figura en el manifiesto de este vuelo.",
    token_mismatch: "El QR no es válido o fue reemplazado. Pedile al pasajero que abra de nuevo su boarding pass.",
    not_paid: "La reserva no está pagada.",
    canceled: "La reserva está cancelada.",
} as const;

function reject(
    reason: keyof typeof REJECT_MESSAGES,
    passenger?: PassengerManifestItem
): Extract<BoardingPrecheck, { ok: false }> {
    return { ok: false, result: { kind: "rejected", reason, message: REJECT_MESSAGES[reason], passenger } };
}

/** Valida un QR contra la reserva (no escribe nada). */
export function precheckBoarding(
    reservation: BoardingReservationSnapshot,
    payload: BoardingQrPayload,
    now: Date = new Date()
): BoardingPrecheck {
    if (payload.reservationId !== reservation.id) return reject("other_reservation");
    if (isCanceled({ client_status: reservation.clientStatus, internal_status: reservation.internalStatus })) {
        return reject("canceled");
    }
    if (!reservation.paid) return reject("not_paid");
    const passenger = reservation.passengers.find((p) => p.id === payload.passengerId);
    if (!passenger) return reject("unknown_passenger");
    if (!passenger.boardingToken || !safeEqual(passenger.boardingToken, payload.token)) {
        return reject("token_mismatch", passenger);
    }
    return {
        ok: true,
        passenger,
        isFlightToday: isFlightToday(reservation.departures, now),
        alreadyBoarded: !!passenger.boardedAt,
    };
}

/** Lee la reserva directo de Firestore (sin caché de TanStack) para validar un escaneo. */
export async function fetchBoardingSnapshot(reservationId: string): Promise<BoardingReservationSnapshot | null> {
    try {
        const snap = await getDoc(doc(db, "aircraft-reservation", reservationId));
        if (!snap.exists()) return null;
        return toBoardingSnapshot(snap.id, snap.data());
    } catch (error) {
        console.error("Error al leer la reserva para el embarque:", error);
        throw error;
    }
}

/**
 * Registra el embarque en una transacción: vuelve a validar token, pago y estado con el dato
 * del servidor y no pisa embarques hechos al mismo tiempo desde otro teléfono.
 */
export async function markPassengerBoarded(
    payload: BoardingQrPayload,
    uid: string
): Promise<BoardingScanResult> {
    try {
        const ref = doc(db, "aircraft-reservation", payload.reservationId);
        return await runTransaction(db, async (tx): Promise<BoardingScanResult> => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                return { kind: "rejected", reason: "not_found", message: "No se encontró la reserva." };
            }
            const data = snap.data();
            const check = precheckBoarding(toBoardingSnapshot(snap.id, data), payload);
            if (!check.ok) return check.result;
            if (check.alreadyBoarded) return { kind: "already_boarded", passenger: check.passenger };

            const boardedAt = new Date().toISOString();
            const passengers = (data.passengers as PassengerManifestItem[]).map((p) =>
                p.id === payload.passengerId ? { ...p, boardedAt, boardedBy: uid } : p
            );
            tx.update(ref, { passengers });
            return { kind: "boarded", passenger: { ...check.passenger, boardedAt, boardedBy: uid } };
        });
    } catch (error) {
        console.error("Error al registrar el embarque:", error);
        throw error;
    }
}

/**
 * Para la pantalla de boarding pass: devuelve los pasajeros con su token,
 * generándolo (y guardándolo en una transacción) la primera vez si la reserva está pagada.
 * Si no hay conexión para la transacción, usa la lectura normal (los que ya tenían token se muestran igual).
 */
export async function ensureBoardingTokensForReservation(reservationId: string): Promise<PassengerManifestItem[]> {
    const ref = doc(db, "aircraft-reservation", reservationId);
    try {
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return [];
            const data = snap.data();
            const current: PassengerManifestItem[] = Array.isArray(data.passengers) ? data.passengers : [];
            if (!isPaidForBoarding(data) || isCanceled(data)) return current;
            const { passengers, changed } = ensureBoardingFields(current);
            if (changed) {
                const cleaned = passengers.map(cleanPassenger);
                tx.update(ref, { passengers: cleaned });
                return cleaned;
            }
            return current;
        });
    } catch (error) {
        console.error("Error al preparar los boarding pass (se reintenta con lectura simple):", error);
        try {
            const snap = await getDoc(ref);
            if (!snap.exists()) return [];
            const data = snap.data();
            return Array.isArray(data.passengers) ? data.passengers : [];
        } catch (readError) {
            console.error("Error al leer los pasajeros de la reserva:", readError);
            throw readError;
        }
    }
}
