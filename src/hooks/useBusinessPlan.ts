import { db } from "@/config/firebase";
import { AdminBillingAircraftRef } from "@/types/admin-billing";
import {
    BUSINESS_PLAN_COLLECTION,
    BusinessPlan,
    BusinessPlanQueryResult,
    BusinessPlanSchema,
} from "@/types/business-plan";
import { createDefaultBusinessPlan } from "@/utils/business-plan";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * Parámetros del plan de negocio de una aeronave (`business-plans/{aircraftId}`, solo ADMIN).
 * Si todavía no hay documento, devuelve los valores por defecto de la planilla.
 */
export function useBusinessPlan(aircraft: AdminBillingAircraftRef | null) {
    return useQuery<BusinessPlanQueryResult>({
        queryKey: ["business-plan", aircraft?.aircraftId],
        queryFn: async () => {
            const defaults = createDefaultBusinessPlan(
                aircraft?.aircraftId || "",
                aircraft?.ownerId || "",
                aircraft?.registration || "",
                aircraft?.model || ""
            );
            if (!aircraft?.aircraftId) return { plan: defaults, exists: false, invalidStored: false };

            try {
                const snap = await getDoc(doc(db, BUSINESS_PLAN_COLLECTION, aircraft.aircraftId));
                if (!snap.exists()) return { plan: defaults, exists: false, invalidStored: false };

                const merged = {
                    ...defaults,
                    ...(snap.data() as Partial<BusinessPlan>),
                    aircraftId: aircraft.aircraftId,
                    ownerId: aircraft.ownerId,
                    aircraftRegistration: aircraft.registration,
                    aircraftModel: aircraft.model,
                };
                const parsed = BusinessPlanSchema.safeParse(merged);
                if (!parsed.success) {
                    console.warn("El plan de negocio guardado no es válido; se usan los valores por defecto:", parsed.error.issues);
                    return { plan: defaults, exists: true, invalidStored: true };
                }
                return { plan: parsed.data, exists: true, invalidStored: false };
            } catch (error) {
                console.error("Error al leer el plan de negocio en useBusinessPlan:", error);
                throw error;
            }
        },
        enabled: !!aircraft?.aircraftId,
    });
}

/** Guarda el plan completo (validado con Zod). */
export function useSaveBusinessPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ plan, uid }: { plan: BusinessPlan; uid?: string }) => {
            const parsed = BusinessPlanSchema.parse({
                ...plan,
                updatedAt: new Date().toISOString(),
                updatedBy: uid || plan.updatedBy || "",
            });
            try {
                await setDoc(doc(db, BUSINESS_PLAN_COLLECTION, parsed.aircraftId), parsed);
                return parsed;
            } catch (error) {
                console.error("Error al guardar el plan de negocio en useSaveBusinessPlan:", error);
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["business-plan", data.aircraftId] });
        },
    });
}
