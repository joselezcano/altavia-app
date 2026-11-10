/**
 * Presupuestos (colección `quotes`). Ver src/types/quote.ts y src/utils/quote-builder.ts.
 *
 * Consultas compatibles con firestore.rules:
 *  - ADMIN: todos.
 *  - OWNER: where ownerId == uid.
 *  - Encargada (PILOT con isEncargado): una consulta por aeronave de managed_aircrafts.
 */
import { db, functions } from "@/config/firebase";
import { USER_ROLE, useAuth } from "@/hooks/useAuth";
import { CreateQuoteLinkResult, QuoteDoc, QuoteStatus } from "@/types/quote";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const QUOTES = "quotes";

const toDate = (v: any): Date | null => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);

/** Normaliza un documento de Firestore (Timestamps → Date). */
export function parseQuoteDoc(id: string, data: any): QuoteDoc {
    return {
        ...data,
        id,
        schedule: {
            ...data.schedule,
            outbound_flight_departure_time: toDate(data.schedule?.outbound_flight_departure_time) ?? new Date(),
            return_flight_departure_time: toDate(data.schedule?.return_flight_departure_time),
        },
        validUntil: toDate(data.validUntil) ?? new Date(),
        sentAt: toDate(data.sentAt),
        acceptedAt: toDate(data.acceptedAt),
        rejectedAt: toDate(data.rejectedAt),
        createdAt: toDate(data.createdAt) ?? undefined,
        updatedAt: toDate(data.updatedAt) ?? undefined,
    } as QuoteDoc;
}

/** Elimina undefined (Firestore los rechaza) y convierte Date → Timestamp. */
function cleanForFirestore(value: any): any {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date) return Timestamp.fromDate(value);
    if (value instanceof Timestamp) return value;
    if (Array.isArray(value)) return value.map(cleanForFirestore).filter((v) => v !== undefined);
    if (typeof value === "object") {
        const out: Record<string, any> = {};
        Object.entries(value).forEach(([k, v]) => {
            const c = cleanForFirestore(v);
            if (c !== undefined) out[k] = c;
        });
        return out;
    }
    return value;
}

/** Presupuestos visibles para el rol activo, del más nuevo al más viejo. */
export function useQuotes() {
    const { user, role, profileData } = useAuth();
    const managed: string[] = role === USER_ROLE.PILOT && profileData?.isEncargado ? profileData?.managed_aircrafts || [] : [];

    return useQuery<QuoteDoc[]>({
        queryKey: ["quotes", role, user?.uid, managed.join(",")],
        enabled: !!user?.uid && (role === USER_ROLE.ADMIN || role === USER_ROLE.OWNER || managed.length > 0),
        queryFn: async () => {
            try {
                let snaps: any[] = [];
                if (role === USER_ROLE.ADMIN) {
                    snaps = (await getDocs(collection(db, QUOTES))).docs;
                } else if (role === USER_ROLE.OWNER) {
                    snaps = (await getDocs(query(collection(db, QUOTES), where("ownerId", "==", user!.uid)))).docs;
                } else {
                    for (const aircraftId of managed) {
                        const s = await getDocs(query(collection(db, QUOTES), where("aircraftId", "==", aircraftId)));
                        snaps.push(...s.docs);
                    }
                }
                const list = snaps.map((d) => parseQuoteDoc(d.id, d.data()));
                list.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
                return list;
            } catch (error) {
                console.error("Error al obtener los presupuestos en useQuotes:", error);
                throw error;
            }
        },
    });
}

export function useQuote(quoteId: string | undefined) {
    return useQuery<QuoteDoc | null>({
        queryKey: ["quote", quoteId],
        enabled: !!quoteId,
        queryFn: async () => {
            if (!quoteId) return null;
            try {
                const snap = await getDoc(doc(db, QUOTES, quoteId));
                return snap.exists() ? parseQuoteDoc(snap.id, snap.data()) : null;
            } catch (error) {
                console.error("Error al obtener el presupuesto en useQuote:", error);
                throw error;
            }
        },
    });
}

export type QuoteInput = Omit<QuoteDoc, "id" | "createdAt" | "updatedAt" | "version" | "createdBy"> & {
    id?: string;
    version?: number;
    createdBy?: string;
};

/** Crea o actualiza un presupuesto. Cada edición de uno ya enviado sube la versión. */
export function useSaveQuote() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (input: QuoteInput): Promise<string> => {
            if (!user?.uid) throw new Error("No hay sesión activa.");
            try {
                if (input.id) {
                    const { id, createdBy, ...rest } = input;
                    const wasSent = rest.status !== "draft";
                    await updateDoc(
                        doc(db, QUOTES, id),
                        cleanForFirestore({
                            ...rest,
                            version: (input.version ?? 1) + (wasSent ? 1 : 0),
                            updatedAt: serverTimestamp(),
                        })
                    );
                    return id;
                }
                const ref = await addDoc(
                    collection(db, QUOTES),
                    cleanForFirestore({
                        ...input,
                        version: 1,
                        createdBy: user.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    })
                );
                return ref.id;
            } catch (error) {
                console.error("Error al guardar el presupuesto:", error);
                throw error;
            }
        },
        onSuccess: (id) => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["quote", id] });
        },
    });
}

/** Cambia el estado a mano: aceptado (por WhatsApp), rechazado, enviado o borrador. */
export function useSetQuoteStatus() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
            try {
                const patch: Record<string, any> = { status, updatedAt: serverTimestamp() };
                if (status === "accepted") {
                    patch.acceptedAt = serverTimestamp();
                    patch.acceptedVia = "manual";
                    patch.acceptedBy = user?.uid ?? null;
                }
                if (status === "rejected") patch.rejectedAt = serverTimestamp();
                if (status === "sent") patch.sentAt = serverTimestamp();
                await updateDoc(doc(db, QUOTES, quoteId), patch);
            } catch (error) {
                console.error("Error al cambiar el estado del presupuesto:", error);
                throw error;
            }
        },
        onSuccess: (_d, v) => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["quote", v.quoteId] });
        },
    });
}

export function useDeleteQuote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (quoteId: string) => {
            try {
                await deleteDoc(doc(db, QUOTES, quoteId));
            } catch (error) {
                console.error("Error al eliminar el presupuesto:", error);
                throw error;
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
    });
}

/** Genera (o renueva) el link público de la hoja de presupuesto. Marca el presupuesto como enviado. */
export async function createQuoteLink(quoteId: string): Promise<CreateQuoteLinkResult> {
    try {
        const callable = httpsCallable<{ quoteId: string }, CreateQuoteLinkResult>(functions, "createQuoteLink");
        const res = await callable({ quoteId });
        return res.data;
    } catch (error) {
        console.error("Error al generar el link del presupuesto:", error);
        throw error;
    }
}
