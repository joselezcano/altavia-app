import { db } from "@/config/firebase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, deleteDoc, doc, getDocs, limit, query, where } from "firebase/firestore";

/**
 * Elimina una aeronave (AircraftSpecs). Las reglas solo lo permiten al ADMIN o al dueño.
 * Para no perder el historial, NO se elimina si la aeronave tiene reservas registradas.
 */
export function useDeleteAircraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ aircraftId }: { aircraftId: string; ownerId?: string }) => {
      try {
        const reservationsSnap = await getDocs(
          query(
            collection(db, "aircraft-reservation"),
            where("aircraftId", "==", aircraftId),
            limit(1)
          )
        );
        if (!reservationsSnap.empty) {
          throw new Error(
            "Esta aeronave tiene reservas registradas. No se puede eliminar para no perder el historial."
          );
        }

        await deleteDoc(doc(db, "AircraftSpecs", aircraftId));
      } catch (error) {
        console.error("Error al eliminar la aeronave:", error);
        throw error;
      }
    },
    onSuccess: (_result, { aircraftId, ownerId }) => {
      queryClient.invalidateQueries({ queryKey: ["owner-aircrafts", ownerId] });
      queryClient.removeQueries({ queryKey: ["aircraft-details", aircraftId] });
      queryClient.invalidateQueries({ queryKey: ["all-aircrafts"] });
    },
  });
}
