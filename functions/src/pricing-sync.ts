/**
 * Publica la tarifa por hora de cada aeronave en `AircraftSpecs/{id}.pricing`.
 *
 * La fuente es la configuración de costos de GIO (`owner_aircraft_operations_config`,
 * editable por el admin, el owner y la encargada). Esa colección es privada, así que
 * el buscador del cliente no puede leerla: este trigger copia SOLO los datos de venta
 * (tarifa por hora IVA incluido, pernocte y hangaraje por noche). Los costos internos
 * (combustible, piloto, reserva, fijos) nunca salen de GIO.
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const syncAircraftPricing = onDocumentWritten("owner_aircraft_operations_config/{configId}", async (event) => {
  const after = event.data?.after?.data();
  if (!after) return; // config borrada: se conserva la última tarifa publicada

  const aircraftId = String(after.aircraftId || event.params.configId.split("_")[1] || "");
  if (!aircraftId) return;

  const db = getFirestore();
  try {
    const ref = db.collection("AircraftSpecs").doc(aircraftId);
    const snap = await ref.get();
    if (!snap.exists) return;
    // Solo el dueño real de la aeronave define su tarifa.
    if (snap.data()?.ownerId && snap.data()?.ownerId !== after.ownerId) {
      console.warn(`[syncAircraftPricing] ${event.params.configId} no corresponde al dueño de ${aircraftId}.`);
      return;
    }

    const pricing = {
      pricePerHourUsd: num(after.tarifaHora),
      overnightFeeUsd: num(after.pernocteUsd, 100),
      hangarPerNightUsd: num(after.hangarNocheUsd),
      blockFactor: num(after.factorBloque) > 0 ? num(after.factorBloque) : 1.12,
    };
    const current = snap.data()?.pricing || {};
    if (
      current.pricePerHourUsd === pricing.pricePerHourUsd &&
      current.overnightFeeUsd === pricing.overnightFeeUsd &&
      current.hangarPerNightUsd === pricing.hangarPerNightUsd &&
      current.blockFactor === pricing.blockFactor
    ) {
      return;
    }
    await ref.update({ pricing: { ...pricing, updatedAt: FieldValue.serverTimestamp() } });
    console.log(`[syncAircraftPricing] Tarifa publicada para ${aircraftId}:`, pricing);
  } catch (err) {
    console.error(`[syncAircraftPricing] Error con ${event.params.configId}:`, err);
  }
});
