import { db } from "@/config/firebase";
import { CambioDelDiaDoc, DEFAULT_USD_TO_PYG_RATE } from "@/types/exchange-rate";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";

export const EXCHANGE_RATE_COLLECTION = "Contadores";
export const EXCHANGE_RATE_DOC_ID = "cambioDelDia";

/**
 * Función asíncrona segura con bloque try-catch para obtener el cambio del día desde Firestore.
 */
export async function fetchCambioDelDia(): Promise<CambioDelDiaDoc> {
    try {
        const docRef = doc(db, EXCHANGE_RATE_COLLECTION, EXCHANGE_RATE_DOC_ID);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data() as Partial<CambioDelDiaDoc>;
            const dolar = typeof data.dolar === "number" && data.dolar > 0 ? data.dolar : DEFAULT_USD_TO_PYG_RATE;
            return {
                dolar,
                venta: data.venta || dolar,
                compra: data.compra || Math.round(dolar * 0.97),
                source: data.source || "Cambios Chaco",
                chacoUpdateTs: data.chacoUpdateTs || null,
                updatedAt: data.updatedAt || null,
            };
        }

        return {
            dolar: DEFAULT_USD_TO_PYG_RATE,
            venta: DEFAULT_USD_TO_PYG_RATE,
            compra: Math.round(DEFAULT_USD_TO_PYG_RATE * 0.97),
            source: "Fallback por defecto",
            chacoUpdateTs: null,
            updatedAt: null,
        };
    } catch (error) {
        console.error("Error al consultar Contadores/cambioDelDia en Firestore:", error);
        return {
            dolar: DEFAULT_USD_TO_PYG_RATE,
            venta: DEFAULT_USD_TO_PYG_RATE,
            compra: Math.round(DEFAULT_USD_TO_PYG_RATE * 0.97),
            source: "Fallback por error",
            chacoUpdateTs: null,
            updatedAt: null,
        };
    }
}

/**
 * Hook TanStack Query global para consultar la cotización oficial del dólar en toda la app.
 * - Cachea el resultado por 30 minutos (staleTime).
 * - Provee siempre el número `dolar` (precio de venta oficial).
 */
export function useExchangeRate() {
    return useQuery<CambioDelDiaDoc>({
        queryKey: ["global-exchange-rate", EXCHANGE_RATE_DOC_ID],
        queryFn: fetchCambioDelDia,
        staleTime: 1000 * 60 * 30, // 30 minutos
        gcTime: 1000 * 60 * 60 * 2, // 2 horas
    });
}

