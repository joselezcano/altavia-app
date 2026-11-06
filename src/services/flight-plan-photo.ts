/**
 * Foto del plan de vuelo presentado (DINAC), por tramo de una reserva.
 * Ruta en Storage: flight_plan_photos/{reservationId}/{archivo}. La pueden subir el admin,
 * el dueño o la encargada de la aeronave de la reserva, o un piloto asignado (ver storage.rules).
 */
import { storage } from "@/config/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export async function uploadFlightPlanPhoto(
    reservationId: string,
    legType: string,
    localUri: string
): Promise<string> {
    if (localUri.startsWith("https://") || localUri.startsWith("http://")) {
        return localUri;
    }
    try {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const safeLeg = legType === "return" ? "return" : "outbound";
        const path = `flight_plan_photos/${reservationId}/${safeLeg}_${Date.now()}.jpg`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob, { contentType: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg" });
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Error al subir la foto del plan de vuelo a Storage:", error);
        throw new Error("No se pudo subir la foto del plan de vuelo. Revisá la conexión e intentá de nuevo.");
    }
}
