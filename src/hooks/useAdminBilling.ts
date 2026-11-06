import { db } from "@/config/firebase";
import { fetchCambioDelDia } from "@/hooks/useExchangeRate";
import { getOperationsConfigDocId } from "@/hooks/useAircraftOperations";
import {
    AdminBillingAircraftRef,
    AdminGioAircraftData,
    AdminGioDataset,
    PaidReservationRecord,
} from "@/types/admin-billing";
import {
    AircraftOperationsConfig,
    OperationalExpenseDoc,
    OperationalFlightDoc,
} from "@/types/aircraft-operations";
import { createDefaultOperationsConfig, DEFAULT_FIXED_EXPENSES } from "@/utils/aircraft-operations-calc";
import { useQueries, useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

function toDate(v: unknown): Date | null {
    if (!v) return null;
    if (typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate();
    const d = new Date(v as string | number);
    return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchClientName(clientId: string): Promise<string | null> {
    try {
        const snap = await getDoc(doc(db, "users", clientId));
        const u = snap.data();
        if (!u) return null;
        if (u.personType === "company" && u.businessName) return String(u.businessName);
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
        return name || (u.email ? String(u.email) : null);
    } catch (error) {
        console.error("Error al leer el cliente de una reserva pagada:", error);
        return null;
    }
}

/**
 * Reservas pagadas (client_status 'confirmed') de todas las aeronaves, para el tablero de
 * Facturación del ADMIN. Solo datos reales: nada de clientes ni transacciones de ejemplo.
 */
export function useAdminPaidReservations() {
    return useQuery<PaidReservationRecord[]>({
        queryKey: ["admin-paid-reservations"],
        queryFn: async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, "aircraft-reservation"), where("client_status", "==", "confirmed"))
                );

                const clientIds = new Set<string>();
                snap.docs.forEach((d) => {
                    const cid = d.data().clientId;
                    if (cid) clientIds.add(String(cid));
                });
                const names = new Map<string, string | null>();
                await Promise.all(
                    Array.from(clientIds).map(async (cid) => names.set(cid, await fetchClientName(cid)))
                );

                return snap.docs.map((docSnap) => {
                    const d = docSnap.data();
                    const clientId = d.clientId ? String(d.clientId) : null;
                    const billable = Number(d.billable_hours);
                    return {
                        id: docSnap.id,
                        aircraftId: String(d.aircraftId || ""),
                        clientId,
                        clientName: clientId ? names.get(clientId) ?? null : null,
                        priceUsd: Number(d.price) || 0,
                        billableHours: Number.isFinite(billable) && billable > 0 ? billable : null,
                        paidAt: toDate(d.paid_at),
                        flightDate: toDate(d.schedule?.outbound_flight_departure_time),
                        originIdent: d.trip?.origin_airport_ident || null,
                        destinationIdent: d.trip?.destination_airport_ident || null,
                        roundtrip: d.schedule?.roundtrip === true,
                        internalStatus: d.internal_status || null,
                        paymentMethod: d.payment_method || null,
                        paymentTransactionId: d.payment_transaction_id || null,
                        invoiceNumber: d.invoice_number || null,
                    };
                });
            } catch (error) {
                console.error("Error al obtener las reservas pagadas en useAdminPaidReservations:", error);
                throw error;
            }
        },
    });
}

// ------------------------------------------------------------- GIO de varias aeronaves
// Mismas claves de caché que src/hooks/useAircraftOperations.ts: si el owner o la encargada
// guardan algo en GIO, sus invalidaciones también refrescan estos datos.

async function fetchGioConfig(a: AdminBillingAircraftRef): Promise<AircraftOperationsConfig> {
    const exchangeDoc = await fetchCambioDelDia();
    const liveTc = exchangeDoc.dolar;
    const fallback = createDefaultOperationsConfig(a.ownerId, a.aircraftId, a.registration, a.model);
    fallback.tc = liveTc;
    try {
        const snap = await getDoc(
            doc(db, "owner_aircraft_operations_config", getOperationsConfigDocId(a.ownerId, a.aircraftId))
        );
        if (!snap.exists()) return fallback;
        const data = snap.data() as Partial<AircraftOperationsConfig>;
        return {
            ...fallback,
            ...data,
            tc: typeof data.tc === "number" && data.tc > 0 ? data.tc : liveTc,
            id: snap.id,
            ownerId: a.ownerId,
            aircraftId: a.aircraftId,
            aircraftRegistration: data.aircraftRegistration || a.registration,
            aircraftModel: data.aircraftModel || a.model,
            fijos:
                Array.isArray(data.fijos) && data.fijos.length > 0
                    ? data.fijos
                    : DEFAULT_FIXED_EXPENSES.map((f) => ({ ...f })),
        };
    } catch (error) {
        console.error("Error al leer la configuración de GIO (admin):", error);
        throw error;
    }
}

async function fetchGioList<T extends { id: string }>(
    collectionName: string,
    a: AdminBillingAircraftRef
): Promise<T[]> {
    try {
        // Las reglas exigen filtrar por ownerId y aircraftId (el ownerId debe ser el dueño real).
        const snap = await getDocs(
            query(
                collection(db, collectionName),
                where("ownerId", "==", a.ownerId),
                where("aircraftId", "==", a.aircraftId)
            )
        );
        return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
    } catch (error) {
        console.error(`Error al leer ${collectionName} (admin):`, error);
        throw error;
    }
}

/** Configuración, vuelos y gastos de GIO de varias aeronaves (cada una con su dueño). */
export function useAdminGioDataset(aircraft: AdminBillingAircraftRef[]): AdminGioDataset {
    return useQueries({
        queries: aircraft.flatMap((a) => [
            {
                queryKey: ["owner-aircraft-ops-config", a.ownerId, a.aircraftId],
                queryFn: () => fetchGioConfig(a),
            },
            {
                queryKey: ["owner-operational-flights", a.ownerId, a.aircraftId],
                queryFn: () => fetchGioList<OperationalFlightDoc>("owner_operational_flights", a),
            },
            {
                queryKey: ["owner-operational-expenses", a.ownerId, a.aircraftId],
                queryFn: () => fetchGioList<OperationalExpenseDoc>("owner_operational_expenses", a),
            },
        ]),
        combine: (results) => {
            const byAircraft: Record<string, AdminGioAircraftData> = {};
            aircraft.forEach((a, i) => {
                const [cfgQ, flightsQ, expensesQ] = results.slice(i * 3, i * 3 + 3);
                byAircraft[a.aircraftId] = {
                    aircraftId: a.aircraftId,
                    ownerId: a.ownerId,
                    cfg: (cfgQ?.data as AircraftOperationsConfig | undefined) ?? null,
                    flights: (flightsQ?.data as OperationalFlightDoc[] | undefined) ?? [],
                    expenses: (expensesQ?.data as OperationalExpenseDoc[] | undefined) ?? [],
                };
            });
            return {
                byAircraft,
                isLoading: results.some((r) => r.isLoading),
                hasError: results.some((r) => r.isError),
            };
        },
    });
}
