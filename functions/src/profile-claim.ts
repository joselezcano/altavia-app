/**
 * Unión de perfiles precargados.
 *
 * La encargada (o el admin) da de alta clientes sin cuenta de Firebase Auth:
 * `users/{idAleatorio}` + `clients/{idAleatorio}`. Cuando esa persona entra por
 * primera vez con Google o Apple, su `users/{authUid}` no existe todavía. Antes de
 * mandarla al onboarding, la app llama a `claimPreRegisteredProfile`, que busca
 * perfiles precargados con el MISMO email y los migra a su uid real:
 * datos de usuario, perfiles por rol, reservas, notificaciones y vínculos.
 *
 * Seguridad: solo se usa el email del token de Auth y solo si está verificado
 * (Google / Apple). Nunca un email que mande la app. Solo se reclaman documentos
 * cuyo id NO es una cuenta de Auth existente (perfiles realmente precargados).
 */
import { getAuth } from "firebase-admin/auth";
import { DocumentReference, FieldValue, getFirestore, WriteBatch } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const ROLE_COLLECTIONS = ["clients", "pilots", "owners", "admin-users"] as const;
const BATCH_LIMIT = 400;

export interface ClaimProfileResult {
  claimed: boolean;
  mergedProfiles: number;
  movedReservations: number;
}

/** Agrupa escrituras en lotes de hasta BATCH_LIMIT operaciones. */
class BatchQueue {
  private batches: WriteBatch[] = [];
  private count = 0;
  constructor(private db: FirebaseFirestore.Firestore) {
    this.batches.push(db.batch());
  }
  private current(): WriteBatch {
    if (this.count >= BATCH_LIMIT) {
      this.batches.push(this.db.batch());
      this.count = 0;
    }
    this.count++;
    return this.batches[this.batches.length - 1];
  }
  set(ref: DocumentReference, data: Record<string, unknown>, merge = true) {
    this.current().set(ref, data, { merge });
  }
  update(ref: DocumentReference, data: Record<string, unknown>) {
    this.current().update(ref, data);
  }
  delete(ref: DocumentReference) {
    this.current().delete(ref);
  }
  async commit() {
    for (const b of this.batches) await b.commit();
  }
}

async function isAuthAccount(uid: string): Promise<boolean> {
  try {
    await getAuth().getUser(uid);
    return true;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") return false;
    throw err;
  }
}

export const claimPreRegisteredProfile = onCall(async (request): Promise<ClaimProfileResult> => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debés iniciar sesión.");
  }
  const uid = request.auth.uid;
  const email = String(request.auth.token.email || "").trim().toLowerCase();
  const verified = request.auth.token.email_verified === true;
  const none: ClaimProfileResult = { claimed: false, mergedProfiles: 0, movedReservations: 0 };

  if (!email || !verified) return none;

  const db = getFirestore();
  try {
    // Si ya tiene perfil propio, no hay nada que reclamar (llamada idempotente).
    const ownRef = db.collection("users").doc(uid);
    const ownSnap = await ownRef.get();
    if (ownSnap.exists) return none;

    const candidatesSnap = await db.collection("users").where("email", "==", email).get();
    const candidates = [];
    for (const d of candidatesSnap.docs) {
      if (d.id === uid) continue;
      if (d.data().deleted === true) continue;
      if (await isAuthAccount(d.id)) continue; // es la cuenta de otra persona / otro proveedor
      candidates.push(d);
    }
    if (candidates.length === 0) return none;

    const queue = new BatchQueue(db);
    const roles = new Set<string>(["CLIENT"]);
    let merged: Record<string, unknown> = {};
    let movedReservations = 0;

    for (const cand of candidates) {
      const oldId = cand.id;
      const data = cand.data();
      (data.roles || []).forEach((r: string) => roles.add(r));
      // El primero manda; los siguientes solo completan campos vacíos.
      merged = { ...data, ...merged };

      // Perfiles por rol.
      for (const coll of ROLE_COLLECTIONS) {
        const oldRoleSnap = await db.collection(coll).doc(oldId).get();
        if (oldRoleSnap.exists) {
          queue.set(db.collection(coll).doc(uid), { ...oldRoleSnap.data(), uid, updatedAt: FieldValue.serverTimestamp() });
          queue.delete(oldRoleSnap.ref);
        }
      }

      // Reservas del cliente.
      const resSnap = await db.collection("aircraft-reservation").where("clientId", "==", oldId).get();
      resSnap.forEach((r) => {
        queue.update(r.ref, { clientId: uid });
        movedReservations++;
      });

      // Reservas donde figura como piloto.
      const pilotResSnap = await db.collection("aircraft-reservation").where("pilot_ids", "array-contains", oldId).get();
      pilotResSnap.forEach((r) => {
        const ids: string[] = r.data().pilot_ids || [];
        queue.update(r.ref, { pilot_ids: ids.map((id) => (id === oldId ? uid : id)) });
      });

      // Notificaciones.
      const notifSnap = await db.collection("notifications").where("userId", "==", oldId).get();
      notifSnap.forEach((n) => queue.update(n.ref, { userId: uid }));

      // Aeronaves de las que figuraba como dueño.
      const aircraftSnap = await db.collection("AircraftSpecs").where("ownerId", "==", oldId).get();
      aircraftSnap.forEach((a) => queue.update(a.ref, { ownerId: uid }));

      // Pilotos vinculados a él como propietario.
      const linkedPilotsSnap = await db.collection("pilots").where("owner_ids", "array-contains", oldId).get();
      linkedPilotsSnap.forEach((p) => {
        const ids: string[] = p.data().owner_ids || [];
        queue.update(p.ref, { owner_ids: ids.map((id) => (id === oldId ? uid : id)) });
      });

      if (aircraftSnap.size > 0) {
        // Los registros de GIO usan el uid del dueño en el id: no se migran automáticamente.
        console.warn(`[claimPreRegisteredProfile] ${oldId} era propietario: revisar owner_* manualmente.`);
      }

      // Rastro de auditoría (colección solo servidor) y baja del perfil viejo.
      queue.set(db.collection("merged-profiles").doc(oldId), {
        newUid: uid,
        email,
        mergedAt: FieldValue.serverTimestamp(),
      }, false);
      queue.delete(cand.ref);
    }

    queue.set(ownRef, {
      ...merged,
      uid,
      email,
      roles: Array.from(roles),
      mergedFrom: candidates.map((c) => c.id),
      updatedAt: FieldValue.serverTimestamp(),
    }, false);

    await queue.commit();
    console.log(`[claimPreRegisteredProfile] ${uid} reclamó ${candidates.length} perfil(es), ${movedReservations} reserva(s).`);
    return { claimed: true, mergedProfiles: candidates.length, movedReservations };
  } catch (err) {
    console.error("[claimPreRegisteredProfile] Error:", err);
    throw new HttpsError("internal", "No se pudo recuperar tu perfil.");
  }
});
