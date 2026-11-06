import { db } from "@/config/firebase";
import { ClientReservationItem } from "@/types/all-roles";
import { doc, getDoc } from "firebase/firestore";

/** Campos de pago y factura que escribe el servidor (Cloud Functions) al confirmar Bancard. */
export type PaidReservationFields = Pick<
    ClientReservationItem,
    | "client_status"
    | "internal_status"
    | "paid_at"
    | "payment_method"
    | "payment_transaction_id"
    | "invoice_number"
    | "invoice_timbrado"
    | "invoice_cdc"
>;

/**
 * Lee la reserva ya confirmada por el servidor. La app NO escribe campos de pago:
 * las reglas de Firestore lo impiden y solo `bancardConfirm` / `bancardGetConfirmation` los registran.
 */
export async function fetchPaidReservationFields(reservationId: string): Promise<PaidReservationFields> {
    try {
        const snap = await getDoc(doc(db, "aircraft-reservation", reservationId));
        if (!snap.exists()) {
            throw new Error("La reserva no existe.");
        }
        const d = snap.data();
        return {
            client_status: d.client_status,
            internal_status: d.internal_status,
            paid_at: d.paid_at?.toDate ? d.paid_at.toDate() : d.paid_at ? new Date(d.paid_at) : undefined,
            payment_method: d.payment_method,
            payment_transaction_id: d.payment_transaction_id,
            invoice_number: d.invoice_number,
            invoice_timbrado: d.invoice_timbrado,
            invoice_cdc: d.invoice_cdc,
        };
    } catch (error) {
        console.error("Error al leer la reserva pagada:", error);
        throw error;
    }
}
