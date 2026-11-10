import { db } from "@/config/firebase";
import { Airport } from "@/types/all-roles";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

/**
 * Aeropuerto por su ident (OACI / local). Primero por id de documento y, si no está,
 * por el campo ident (mismo criterio que useReservationDetails). null si no existe.
 */
export function useAirportByIdent(ident: string | undefined | null) {
    return useQuery<Airport | null>({
        queryKey: ["airport-by-ident", ident],
        enabled: !!ident,
        staleTime: 1000 * 60 * 60,
        queryFn: async () => {
            if (!ident) return null;
            try {
                const snap = await getDoc(doc(db, "airports", ident));
                if (snap.exists()) return snap.data() as Airport;
                const qSnap = await getDocs(query(collection(db, "airports"), where("ident", "==", ident), limit(1)));
                return qSnap.empty ? null : (qSnap.docs[0].data() as Airport);
            } catch (error) {
                console.error(`Error al obtener el aeropuerto ${ident} en useAirportByIdent:`, error);
                throw error;
            }
        },
    });
}
