import type { PassengerManifestItem } from "@/types/all-roles";
import { ensureBoardingTokensForReservation } from "@/utils/boarding-pass";
import { useQuery } from "@tanstack/react-query";

/**
 * Pasajeros de la reserva con su boardingToken (para dibujar el QR del boarding pass).
 * La primera vez que se abre en una reserva pagada genera y guarda los tokens que falten.
 */
export function useBoardingPasses(reservationId: string | undefined, enabled = true) {
    return useQuery<PassengerManifestItem[]>({
        queryKey: ["boarding-passes", reservationId],
        queryFn: async () => {
            if (!reservationId) return [];
            try {
                return await ensureBoardingTokensForReservation(reservationId);
            } catch (error) {
                console.error("Error al cargar los boarding pass:", error);
                throw error;
            }
        },
        enabled: !!reservationId && enabled,
    });
}
