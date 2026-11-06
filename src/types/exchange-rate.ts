/**
 * Tipos para la cotización y tipo de cambio global de la aplicación (USD / PYG).
 * Ubicado estrictamente en src/types/ de acuerdo a las reglas del proyecto.
 */

export interface CambioDelDiaDoc {
    dolar: number; // Tipo de cambio de venta (Gs/USD)
    venta?: number; // Equivalente a dolar
    compra?: number; // Tipo de cambio de compra (Gs/USD)
    source?: string; // Ej: "Cambios Chaco - Sucursal 1"
    chacoUpdateTs?: string | null;
    updatedAt?: any; // Firestore Timestamp o string
}

/**
 * Tasa de cambio de respaldo por defecto si el documento aún no existe o la app está offline.
 */
export const DEFAULT_USD_TO_PYG_RATE = 7850;

