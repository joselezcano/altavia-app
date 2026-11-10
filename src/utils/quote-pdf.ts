/**
 * PDF del presupuesto (nativo): expo-print genera el archivo y expo-sharing abre el menú
 * para compartirlo (WhatsApp, mail…). En web ver quote-pdf.web.ts.
 */
import { QuoteDoc } from "@/types/quote";
import { quoteShortNumber } from "@/utils/quote-format";
import { buildQuoteSheetHtml } from "@/utils/quote-sheet";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/** Genera el PDF y lo comparte. Devuelve la ruta del archivo. Lanza el error si falla. */
export async function shareQuotePdf(quote: QuoteDoc): Promise<string> {
    try {
        const { uri } = await Print.printToFileAsync({ html: buildQuoteSheetHtml(quote), base64: false });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                UTI: ".pdf",
                mimeType: "application/pdf",
                dialogTitle: `Presupuesto ${quoteShortNumber(quote.id)} - AltaGo`,
            });
        }
        return uri;
    } catch (error) {
        console.error("Error al generar el PDF del presupuesto:", error);
        throw error;
    }
}
