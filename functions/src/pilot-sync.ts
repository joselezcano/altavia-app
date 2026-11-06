/**
 * Mantenimiento automático de vínculos de pilotos (cosas que la app no puede hacer
 * por sí misma porque las reglas solo permiten al piloto RENUNCIAR a permisos).
 *
 *  - assignAircraftToCreator: si una encargada da de alta una aeronave a nombre de
 *    uno de sus propietarios, se la agrega a su `managed_aircrafts`.
 *  - removeUnlinkedPilotFromReservations: si un piloto deja de estar vinculado a un
 *    propietario (se desvinculó él o lo desvinculó el propietario), se lo saca de
 *    `pilot_ids` de las reservas FUTURAS de las aeronaves de ese propietario.
 */
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

const CLOSED_STATUSES = ["completed", "canceled", "no_show", "in_flight"];

export const assignAircraftToCreator = onDocumentCreated("AircraftSpecs/{aircraftId}", async (event) => {
  const data = event.data?.data();
  const createdBy = data?.createdBy as string | undefined;
  const ownerId = data?.ownerId as string | undefined;
  if (!createdBy || !ownerId || createdBy === ownerId) return;

  const db = getFirestore();
  try {
    const pilotRef = db.collection("pilots").doc(createdBy);
    const pilot = (await pilotRef.get()).data();
    // Solo si realmente es encargada de ESE propietario (mismo criterio que firestore.rules).
    if (!pilot || pilot.isEncargado !== true || !(pilot.owner_ids || []).includes(ownerId)) return;

    await pilotRef.update({
      managed_aircrafts: FieldValue.arrayUnion(event.params.aircraftId),
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`[assignAircraftToCreator] ${event.params.aircraftId} asignada a la encargada ${createdBy}.`);
  } catch (err) {
    console.error(`[assignAircraftToCreator] Error con ${event.params.aircraftId}:`, err);
  }
});

export const removeUnlinkedPilotFromReservations = onDocumentUpdated("pilots/{pilotId}", async (event) => {
  const before: string[] = event.data?.before.data()?.owner_ids || [];
  const after: string[] = event.data?.after.data()?.owner_ids || [];
  const removedOwners = before.filter((o) => !after.includes(o));
  if (removedOwners.length === 0) return;

  const pilotId = event.params.pilotId;
  const db = getFirestore();
  try {
    // Aeronaves de los propietarios de los que se desvinculó.
    const aircraftIds = new Set<string>();
    for (const ownerId of removedOwners) {
      const snap = await db.collection("AircraftSpecs").where("ownerId", "==", ownerId).get();
      snap.forEach((d) => aircraftIds.add(d.id));
    }
    if (aircraftIds.size === 0) return;

    const now = Timestamp.now();
    const resSnap = await db.collection("aircraft-reservation").where("pilot_ids", "array-contains", pilotId).get();
    const batch = db.batch();
    let count = 0;
    resSnap.forEach((r) => {
      const res = r.data();
      if (!aircraftIds.has(res.aircraftId)) return;
      if (CLOSED_STATUSES.includes(res.internal_status)) return;
      const dep = res.schedule?.outbound_flight_departure_time as Timestamp | undefined;
      if (dep && dep.toMillis() < now.toMillis()) return; // vuelos pasados: se conserva la historia
      batch.update(r.ref, { pilot_ids: FieldValue.arrayRemove(pilotId) });
      count++;
    });
    if (count > 0) await batch.commit();
    console.log(`[removeUnlinkedPilotFromReservations] ${pilotId} quitado de ${count} reserva(s) futura(s).`);
  } catch (err) {
    console.error(`[removeUnlinkedPilotFromReservations] Error con ${pilotId}:`, err);
  }
});
