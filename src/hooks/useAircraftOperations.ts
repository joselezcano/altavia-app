import { db, storage } from "@/config/firebase";
import { fetchCambioDelDia } from "@/hooks/useExchangeRate";
import {
    AircraftOperationsConfig,
    OperationalExpenseDoc,
    OperationalFlightDoc,
} from "@/types/aircraft-operations";
import {
    createDefaultOperationsConfig,
    DEFAULT_FIXED_EXPENSES,
} from "@/utils/aircraft-operations-calc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const CONFIG_COLLECTION = "owner_aircraft_operations_config";
const FLIGHTS_COLLECTION = "owner_operational_flights";
const EXPENSES_COLLECTION = "owner_operational_expenses";

let ImagePickerModule: typeof import("expo-image-picker") | null = null;

function getImagePicker() {
    if (ImagePickerModule) return ImagePickerModule;
    try {
        ImagePickerModule = require("expo-image-picker");
        return ImagePickerModule;
    } catch (error) {
        console.warn("expo-image-picker no disponible:", error);
        return null;
    }
}

export function getOperationsConfigDocId(ownerUid: string, aircraftId: string): string {
    return `${ownerUid}_${aircraftId}`;
}

/**
 * Obtiene los ajustes de costos, tarifas y gastos fijos para la aeronave seleccionada del propietario.
 */
export function useAircraftOperationsConfig(
    ownerUid: string | undefined,
    aircraftId: string,
    aircraftRegistration = "ZP-BOC",
    aircraftModel = "Cessna 414"
) {
    return useQuery<AircraftOperationsConfig>({
        queryKey: ["owner-aircraft-ops-config", ownerUid, aircraftId],
        queryFn: async () => {
            const exchangeDoc = await fetchCambioDelDia();
            const liveTc = exchangeDoc.dolar > 0 ? exchangeDoc.dolar : 5970;

            const fallback = createDefaultOperationsConfig(
                ownerUid || "",
                aircraftId,
                aircraftRegistration,
                aircraftModel
            );
            fallback.tc = liveTc;

            if (!ownerUid || !aircraftId) return fallback;

            try {
                const docId = getOperationsConfigDocId(ownerUid, aircraftId);
                const docRef = doc(db, CONFIG_COLLECTION, docId);
                const snap = await getDoc(docRef);

                if (!snap.exists()) {
                    return fallback;
                }

                const data = snap.data() as Partial<AircraftOperationsConfig>;
                return {
                    ...fallback,
                    ...data,
                    tc: typeof data.tc === "number" && data.tc > 0 ? data.tc : liveTc,
                    id: snap.id,
                    ownerId: ownerUid,
                    aircraftId,
                    aircraftRegistration: data.aircraftRegistration || aircraftRegistration,
                    aircraftModel: data.aircraftModel || aircraftModel,
                    fijos:
                        Array.isArray(data.fijos) && data.fijos.length > 0
                            ? data.fijos
                            : DEFAULT_FIXED_EXPENSES.map((f) => ({ ...f })),
                };
            } catch (error) {
                console.error(
                    "Error al consultar configuración operativa en useAircraftOperationsConfig:",
                    error
                );
                throw error;
            }
        },
        enabled: !!ownerUid && !!aircraftId,
    });
}

/**
 * Guarda los ajustes de costos, tarifas y gastos fijos de la aeronave.
 */
export function useSaveAircraftOperationsConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (config: AircraftOperationsConfig) => {
            if (!config.ownerId || !config.aircraftId) {
                throw new Error("Faltan identificadores de propietario o aeronave.");
            }

            try {
                const docId = getOperationsConfigDocId(config.ownerId, config.aircraftId);
                const docRef = doc(db, CONFIG_COLLECTION, docId);
                const payload: AircraftOperationsConfig = {
                    ...config,
                    id: docId,
                    updatedAt: new Date().toISOString(),
                };
                await setDoc(docRef, payload, { merge: true });
                return payload;
            } catch (error) {
                console.error(
                    "Error al guardar configuración operativa en useSaveAircraftOperationsConfig:",
                    error
                );
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["owner-aircraft-ops-config", data.ownerId, data.aircraftId],
            });
        },
    });
}

/**
 * Obtiene todos los vuelos operativos cargados por el propietario.
 */
export function useOperationalFlights(
    ownerUid: string | undefined,
    aircraftId?: string
) {
    return useQuery<OperationalFlightDoc[]>({
        queryKey: ["owner-operational-flights", ownerUid, aircraftId || "all"],
        queryFn: async () => {
            if (!ownerUid) return [];

            try {
                // Filtrar por aeronave en Firestore (no solo en el cliente): las reglas
                // solo dejan a la encargada consultar las aeronaves que gestiona.
                const filterByAircraft = !!aircraftId && aircraftId !== "all";
                const q = filterByAircraft
                    ? query(
                          collection(db, FLIGHTS_COLLECTION),
                          where("ownerId", "==", ownerUid),
                          where("aircraftId", "==", aircraftId)
                      )
                    : query(collection(db, FLIGHTS_COLLECTION), where("ownerId", "==", ownerUid));
                const snapshot = await getDocs(q);
                const list: OperationalFlightDoc[] = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() as OperationalFlightDoc;
                    list.push({
                        ...data,
                        id: docSnap.id,
                    });
                });

                if (aircraftId && aircraftId !== "all") {
                    return list.filter((item) => item.aircraftId === aircraftId);
                }

                return list;
            } catch (error) {
                console.error(
                    "Error al obtener vuelos operativos en useOperationalFlights:",
                    error
                );
                throw error;
            }
        },
        enabled: !!ownerUid,
    });
}

/**
 * Sube una foto del comprobante del plan de vuelo a Firebase Storage
 */
export async function uploadFlightPlanReceiptPhoto(
    ownerUid: string,
    flightId: string,
    localUri: string
): Promise<string> {
    if (!localUri) return "";
    if (localUri.startsWith("https://") || localUri.startsWith("http://")) {
        return localUri;
    }

    try {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const fileName = `operational_flight_plans/${ownerUid}/${flightId}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error) {
        console.warn(
            "No se pudo subir comprobante a Storage, conservando URI local/base64:",
            error
        );
        return localUri;
    }
}

/**
 * Selector de imagen (Galería o Cámara) para el comprobante del Plan de Vuelo DINAC
 */
export async function pickFlightPlanImage(source: "library" | "camera" = "library"): Promise<string | null> {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
        throw new Error("El selector de imágenes no está disponible en este dispositivo.");
    }

    if (source === "camera") {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
            throw new Error("Se requieren permisos de cámara para tomar la foto del plan de vuelo.");
        }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.65,
            base64: true,
        });
        if (res.canceled || !res.assets || res.assets.length === 0) return null;
        const asset = res.assets[0];
        if (asset.base64 && asset.base64.length < 350000) {
            return `data:image/jpeg;base64,${asset.base64}`;
        }
        return asset.uri;
    } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
            throw new Error("Se requieren permisos de galería para adjuntar la foto del plan de vuelo.");
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.65,
            base64: true,
        });
        if (res.canceled || !res.assets || res.assets.length === 0) return null;
        const asset = res.assets[0];
        if (asset.base64 && asset.base64.length < 350000) {
            return `data:image/jpeg;base64,${asset.base64}`;
        }
        return asset.uri;
    }
}

/**
 * Crea o actualiza un vuelo operativo en Firestore.
 */
export function useSaveOperationalFlight() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (flight: OperationalFlightDoc) => {
            if (!flight.ownerId || !flight.id) {
                throw new Error("Datos incompletos para guardar el vuelo.");
            }

            try {
                let finalPhotoUrl = flight.fotoUrl;
                if (
                    finalPhotoUrl &&
                    !finalPhotoUrl.startsWith("http") &&
                    !finalPhotoUrl.startsWith("data:")
                ) {
                    finalPhotoUrl = await uploadFlightPlanReceiptPhoto(
                        flight.ownerId,
                        flight.id,
                        finalPhotoUrl
                    );
                }

                const docRef = doc(db, FLIGHTS_COLLECTION, flight.id);
                const nowIso = new Date().toISOString();
                const payload: OperationalFlightDoc = {
                    ...flight,
                    fotoUrl: finalPhotoUrl,
                    createdAt: flight.createdAt || nowIso,
                    updatedAt: nowIso,
                };

                await setDoc(docRef, payload, { merge: true });
                return payload;
            } catch (error) {
                console.error(
                    "Error al guardar vuelo operativo en useSaveOperationalFlight:",
                    error
                );
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["owner-operational-flights", data.ownerId],
            });
        },
    });
}

/**
 * Elimina un vuelo operativo de Firestore.
 */
export function useDeleteOperationalFlight() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            flightId,
            ownerId,
        }: {
            flightId: string;
            ownerId: string;
        }) => {
            if (!flightId) throw new Error("ID de vuelo requerido.");

            try {
                const docRef = doc(db, FLIGHTS_COLLECTION, flightId);
                await deleteDoc(docRef);
                return { flightId, ownerId };
            } catch (error) {
                console.error(
                    "Error al eliminar vuelo operativo en useDeleteOperationalFlight:",
                    error
                );
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["owner-operational-flights", data.ownerId],
            });
        },
    });
}

/**
 * Obtiene todos los gastos sueltos (mantenimiento y otros) cargados por el propietario.
 */
export function useOperationalExpenses(
    ownerUid: string | undefined,
    aircraftId?: string
) {
    return useQuery<OperationalExpenseDoc[]>({
        queryKey: ["owner-operational-expenses", ownerUid, aircraftId || "all"],
        queryFn: async () => {
            if (!ownerUid) return [];

            try {
                // Filtrar por aeronave en Firestore (no solo en el cliente): las reglas
                // solo dejan a la encargada consultar las aeronaves que gestiona.
                const filterByAircraft = !!aircraftId && aircraftId !== "all";
                const q = filterByAircraft
                    ? query(
                          collection(db, EXPENSES_COLLECTION),
                          where("ownerId", "==", ownerUid),
                          where("aircraftId", "==", aircraftId)
                      )
                    : query(collection(db, EXPENSES_COLLECTION), where("ownerId", "==", ownerUid));
                const snapshot = await getDocs(q);
                const list: OperationalExpenseDoc[] = [];

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() as OperationalExpenseDoc;
                    list.push({
                        ...data,
                        id: docSnap.id,
                    });
                });

                if (aircraftId && aircraftId !== "all") {
                    return list.filter((item) => item.aircraftId === aircraftId);
                }

                return list;
            } catch (error) {
                console.error(
                    "Error al obtener gastos operativos en useOperationalExpenses:",
                    error
                );
                throw error;
            }
        },
        enabled: !!ownerUid,
    });
}

/**
 * Crea o actualiza un gasto suelto (mantenimiento u otro) en Firestore.
 */
export function useSaveOperationalExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (expense: OperationalExpenseDoc) => {
            if (!expense.ownerId || !expense.id) {
                throw new Error("Datos incompletos para guardar el gasto.");
            }

            try {
                const docRef = doc(db, EXPENSES_COLLECTION, expense.id);
                const nowIso = new Date().toISOString();
                const payload: OperationalExpenseDoc = {
                    ...expense,
                    createdAt: expense.createdAt || nowIso,
                    updatedAt: nowIso,
                };
                await setDoc(docRef, payload, { merge: true });
                return payload;
            } catch (error) {
                console.error(
                    "Error al guardar gasto operativo en useSaveOperationalExpense:",
                    error
                );
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["owner-operational-expenses", data.ownerId],
            });
        },
    });
}

/**
 * Elimina un gasto suelto de Firestore.
 */
export function useDeleteOperationalExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            expenseId,
            ownerId,
        }: {
            expenseId: string;
            ownerId: string;
        }) => {
            if (!expenseId) throw new Error("ID de gasto requerido.");

            try {
                const docRef = doc(db, EXPENSES_COLLECTION, expenseId);
                await deleteDoc(docRef);
                return { expenseId, ownerId };
            } catch (error) {
                console.error(
                    "Error al eliminar gasto operativo en useDeleteOperationalExpense:",
                    error
                );
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["owner-operational-expenses", data.ownerId],
            });
        },
    });
}

/**
 * Guarda solo la tarifa de venta (por hora, pernocte y hangaraje) en la configuración
 * de costos de la aeronave. La usa el ADMIN desde Control de Flota; el servidor
 * (syncAircraftPricing) la publica en AircraftSpecs.pricing para el buscador.
 */
export function useSaveAircraftSalePricing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: {
            ownerId: string;
            aircraftId: string;
            aircraftRegistration: string;
            aircraftModel: string;
            tarifaHora: number;
            pernocteUsd: number;
            hangarNocheUsd: number;
            factorBloque: number;
        }) => {
            try {
                const docId = getOperationsConfigDocId(input.ownerId, input.aircraftId);
                await setDoc(
                    doc(db, CONFIG_COLLECTION, docId),
                    { ...input, id: docId, updatedAt: new Date().toISOString() },
                    { merge: true }
                );
                return input;
            } catch (error) {
                console.error("Error al guardar la tarifa en useSaveAircraftSalePricing:", error);
                throw error;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["owner-aircraft-ops-config", data.ownerId, data.aircraftId] });
            // La tarifa publicada en AircraftSpecs la actualiza el servidor unos segundos después.
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ["all-aircrafts"] }), 4000);
        },
    });
}
