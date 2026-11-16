import { ALTAGO_WHATSAPP } from "@/constants/contact";
import { formatGs, formatUsd, whatsappUrl } from "@/utils/quote-format";
import { Linking } from "react-native";

/**
 * Formatos de la app del cliente: un solo criterio para precios y fechas (es-PY).
 * Precio: "USD 4.680" y, si hay tipo de cambio, "≈ ₲ 36.504.000".
 */
export function formatClientUsd(usd: number): string {
    return formatUsd(usd);
}

/** Equivalente aproximado en guaraníes, o null si no hay tipo de cambio cargado. */
export function formatClientGs(usd: number, rate: number | undefined | null): string | null {
    if (!rate || rate <= 0 || !usd) return null;
    return `≈ ${formatGs(usd * rate)}`;
}

/** "lun 23 nov · 14:30" (fecha y hora local del dispositivo). */
export function formatFlightDateTime(date: Date | null | undefined): string {
    if (!date || isNaN(date.getTime())) return "Sin confirmar";
    const day = date
        .toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short" })
        .replace(/\./g, "")
        .replace(/,/g, "");
    const time = date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} · ${time}`;
}

/** Duración de vuelo legible: "45 min" o "1,5 h". */
export function formatFlightDuration(hours: number | null | undefined): string {
    if (!hours || hours <= 0) return "—";
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours.toLocaleString("es-PY", { maximumFractionDigits: 1 })} h`;
}

/** Link de WhatsApp al contacto comercial de AltaGo con el mensaje precargado. */
export function altagoWhatsAppUrl(message: string): string {
    return whatsappUrl(ALTAGO_WHATSAPP, message);
}

/** Abre WhatsApp con AltaGo. Devuelve false si no se pudo abrir. */
export async function openAltaGoWhatsApp(message: string): Promise<boolean> {
    try {
        await Linking.openURL(altagoWhatsAppUrl(message));
        return true;
    } catch (error) {
        console.error("No se pudo abrir WhatsApp:", error);
        return false;
    }
}
