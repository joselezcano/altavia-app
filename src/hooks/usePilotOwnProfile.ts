import { db } from "@/config/firebase";
import { PilotProfileForm } from "@/types/pilot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

const toDate = (v: any): Date | undefined =>
    v?.toDate ? v.toDate() : v ? new Date(v) : undefined;

/** Perfil de piloto del usuario actual (pilots/{uid}), con la forma del formulario. */
export function usePilotOwnProfile(uid: string | undefined) {
    return useQuery<Partial<PilotProfileForm> | null>({
        queryKey: ["pilot-own-profile", uid],
        enabled: !!uid,
        queryFn: async () => {
            if (!uid) return null;
            try {
                const snap = await getDoc(doc(db, "pilots", uid));
                if (!snap.exists()) return null;
                const d = snap.data();
                const hours = d.other_information?.flight_hours;
                return {
                    basic: d.basic ? { ...d.basic, id_date_of_birth: toDate(d.basic.id_date_of_birth) } : undefined,
                    aeronautical: d.aeronautical,
                    other_information: d.other_information
                        ? {
                              ...d.other_information,
                              // Hay perfiles viejos con las horas guardadas como texto.
                              flight_hours: hours === undefined || hours === "" ? undefined : Number(hours),
                          }
                        : undefined,
                } as Partial<PilotProfileForm>;
            } catch (error) {
                console.error("Error al leer el perfil de piloto:", error);
                throw error;
            }
        },
    });
}

/** Guarda solo los datos del perfil; nunca vínculos ni permisos (las reglas tampoco lo permiten). */
export function useSavePilotOwnProfile(uid: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: PilotProfileForm) => {
            if (!uid) throw new Error("Sesión no válida.");
            try {
                await updateDoc(doc(db, "pilots", uid), {
                    basic: data.basic,
                    aeronautical: data.aeronautical,
                    other_information: data.other_information,
                    updated_at: serverTimestamp(),
                });
            } catch (error) {
                console.error("Error al guardar el perfil de piloto:", error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pilot-own-profile", uid] });
            queryClient.invalidateQueries({ queryKey: ["pilot-details", uid] });
            queryClient.invalidateQueries({ queryKey: ["owner-pilots"] });
        },
    });
}
