import type { BoardingQrPayload, BoardingScanResult } from "@/types/boarding";
import { markPassengerBoarded } from "@/utils/boarding-pass";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Registra boardedAt / boardedBy de un pasajero escaneado y refresca la reserva. */
export function useMarkPassengerBoarded() {
    const queryClient = useQueryClient();
    return useMutation<BoardingScanResult, Error, { payload: BoardingQrPayload; uid: string }>({
        mutationFn: ({ payload, uid }) => markPassengerBoarded(payload, uid),
        onSuccess: async (_result, { payload }) => {
            await queryClient.invalidateQueries({ queryKey: ["reservation-details", payload.reservationId] });
            await queryClient.invalidateQueries({ queryKey: ["boarding-passes", payload.reservationId] });
            await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
            await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
        },
    });
}
