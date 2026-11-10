/**
 * PDF del presupuesto (web): abre la hoja en una pestaña nueva y lanza la impresión del
 * navegador ("Guardar como PDF"). expo-print no genera archivos en web.
 */
import { QuoteDoc } from "@/types/quote";
import { buildQuoteSheetHtml } from "@/utils/quote-sheet";

export async function shareQuotePdf(quote: QuoteDoc): Promise<string> {
    if (typeof window === "undefined") throw new Error("La impresión solo está disponible en el navegador.");
    const win = window.open("", "_blank");
    if (!win) throw new Error("El navegador bloqueó la ventana nueva. Permití las ventanas emergentes e intentá de nuevo.");
    win.document.open();
    win.document.write(buildQuoteSheetHtml(quote));
    win.document.close();
    win.focus();
    // Esperar a que cargue el logo antes de imprimir.
    setTimeout(() => win.print(), 400);
    return "";
}
