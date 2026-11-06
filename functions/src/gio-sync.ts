/**
 * Sincronización reserva → planilla de GIO (Control Operativo).
 *
 * Cuando una reserva queda confirmada (pagada), se crea automáticamente su fila en
 * `owner_operational_flights/res_{reservationId}` a nombre del dueño de la aeronave.
 * Los datos que vienen de la reserva (fecha, cliente, ruta, pasajeros, precio) se
 * mantienen sincronizados y quedan bloqueados en la app. El resto (horas reales,
 * combustible, piloto, tasas, foto del plan) lo completan el owner o la encargada;
 * si quedan vacíos, GIO usa los valores de Ajustes.
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

const FLIGHTS = "owner_operational_flights";
const SYNC_STATUSES = ["confirmed", "delayed", "in_flight", "completed"];

export const gioFlightDocId = (reservationId: string) => `res_${reservationId}`;

function isoDateInAsuncion(ts: Timestamp | Date | undefined | null): string {
  const date = ts instanceof Timestamp ? ts.toDate() : ts instanceof Date ? ts : new Date();
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(date);
}

async function airportLabel(ident: string | undefined): Promise<string> {
  if (!ident) return "";
  try {
    const snap = await getFirestore().collection("airports").where("ident", "==", ident).limit(1).get();
    const a = snap.docs[0]?.data();
    return (a?.municipality || a?.name || ident) as string;
  } catch {
    return ident;
  }
}

async function clientLabel(clientId: string | undefined): Promise<string> {
  if (!clientId) return "";
  try {
    const u = (await getFirestore().collection("users").doc(clientId).get()).data();
    if (!u) return "";
    if (u.personType === "company" && u.businessName) return u.businessName as string;
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || (u.email as string) || "";
  } catch {
    return "";
  }
}

export const syncReservationToGio = onDocumentWritten("aircraft-reservation/{reservationId}", async (event) => {
  const after = event.data?.after?.data();
  if (!after) return; // reserva eliminada: no se toca la planilla

  const reservationId = event.params.reservationId;
  const isPaid = after.client_status === "confirmed" || !!after.paid_at;
  if (!isPaid || !SYNC_STATUSES.includes(after.internal_status)) return;

  const db = getFirestore();
  try {
    const aircraftSnap = await db.collection("AircraftSpecs").doc(after.aircraftId).get();
    const aircraft = aircraftSnap.data();
    const ownerId = aircraft?.ownerId as string | undefined;
    if (!ownerId) {
      console.warn(`[syncReservationToGio] La aeronave ${after.aircraftId} no tiene ownerId; no se crea fila GIO.`);
      return;
    }

    const roundtrip = after.schedule?.roundtrip === true;
    const [origin, destination] = await Promise.all([
      airportLabel(after.trip?.origin_airport_ident),
      airportLabel(after.trip?.destination_airport_ident),
    ]);
    const ruta = [origin, destination, roundtrip ? origin : null].filter(Boolean).join(" – ");

    // Datos que manda la reserva (bloqueados en la app).
    const locked = {
      ownerId,
      aircraftId: after.aircraftId,
      aircraftRegistration: aircraft?.basic_specs?.registration || "",
      aircraftModel: aircraft?.basic_specs?.model || "",
      reservationId,
      fecha: isoDateInAsuncion(after.schedule?.outbound_flight_departure_time),
      cliente: await clientLabel(after.clientId),
      ruta,
      pasajeros: Number(after.capacity?.passangers) || (after.passengers?.length ?? 0),
      noches: Number(after.overnight_nights) || 0,
      precio: Number(after.price) || 0,
      moneda: "USD",
      cobrado: true,
      updatedAt: new Date().toISOString(),
    };

    const ref = db.collection(FLIGHTS).doc(gioFlightDocId(reservationId));
    const existing = await ref.get();
    if (existing.exists) {
      await ref.set(locked, { merge: true });
      return;
    }

    // Horas facturables de la cotización (incluye reposicionamiento y regreso vacío). En reservas
    // viejas sin ese dato: distancia / velocidad crucero por tramo. Se corrigen con el Hobbs real.
    let horas = Number(after.billable_hours) || 0;
    if (!horas) {
      const legs = roundtrip ? 2 : 1;
      const dist = Number(after.distance_nm) || 0;
      const speed = Number(after.cruise_speed_knots) || 0;
      horas = dist > 0 && speed > 0 ? Math.round((dist / speed) * legs * 10) / 10 : 0;
    }
    const hangarUsd = Math.round((Number(after.overnight_nights) || 0) * (Number(after.hangar_per_night_usd) || 0));

    await ref.set({
      ...locked,
      horas,
      horasEstimadas: true,
      hangarUsd,
      fuelModo: "litros",
      litros: null,
      precioLt: null,
      precioLtCur: "GS",
      fuelTotal: null,
      fuelCur: "GS",
      pilotoHora: null,
      pilotoHoraCur: "USD",
      planBase: null,
      planPersona: null,
      planCur: "GS",
      fuelPago: "contado",
      fuelDias: 30,
      fotoUrl: null,
      createdAt: new Date().toISOString(),
    });
    console.log(`[syncReservationToGio] Fila GIO creada para la reserva ${reservationId}.`);
  } catch (err) {
    console.error(`[syncReservationToGio] Error con la reserva ${reservationId}:`, err);
  }
});
