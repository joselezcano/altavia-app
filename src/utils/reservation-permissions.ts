/**
 * Mismo criterio que canManageAircraft() de firestore.rules, para decidir qué botones mostrar:
 * gestiona la reserva el admin, el dueño de la aeronave o la encargada que la tiene en managed_aircrafts.
 * (Las reglas son las que realmente autorizan; esto solo evita mostrar acciones que van a fallar.)
 */
import type { Role } from "@/hooks/useAuth";

export function canManageReservationAircraft(params: {
    role: Role | null | undefined;
    uid: string | undefined;
    profileData: any;
    aircraftId: string | undefined;
    aircraftOwnerId: string | undefined;
}): boolean {
    const { role, uid, profileData, aircraftId, aircraftOwnerId } = params;
    if (role === "ADMIN") return true;
    if (!uid || !aircraftId) return false;
    if (role === "OWNER") return aircraftOwnerId === uid;
    if (role === "PILOT" && profileData?.isEncargado === true) {
        const managed: string[] = Array.isArray(profileData?.managed_aircrafts) ? profileData.managed_aircrafts : [];
        return managed.includes(aircraftId);
    }
    return false;
}

/** Estados en los que ya no tiene sentido editar la reserva. */
export const NON_EDITABLE_STATUSES = ["canceled", "completed", "no_show", "in_flight"];
