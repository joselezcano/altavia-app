import { ClientReservationItem } from "@/types/all-roles";
import { PaymentReceiptOptions } from "@/types/components";
import { formatClientGs, formatFlightDateTime } from "@/utils/client-format";
import { formatUsd } from "@/utils/quote-format";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

/**
 * Comprobante de pago para el cliente (sin valor fiscal).
 * Reemplaza a la factura electrónica en la app del cliente mientras SIFEN no esté conectado:
 * la factura simulada no debe llegarle a un cliente real.
 */
const esc = (s: unknown) =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

function airportLabel(a: ClientReservationItem["originAirport"], ident: string): string {
    if (!a) return ident;
    const city = a.municipality || a.name;
    const code = a.iata_code || ident;
    return city ? `${city} (${code})` : code;
}

export function buildPaymentReceiptHtml(r: ClientReservationItem, opts: PaymentReceiptOptions = {}): string {
    const paidAt = r.paid_at ? new Date(r.paid_at) : null;
    const gs = formatClientGs(r.price, opts.exchangeRate);
    const rows: [string, string][] = [
        ["Reserva", `#${r.id.slice(0, 8).toUpperCase()}`],
        ["Fecha de pago", paidAt ? paidAt.toLocaleString("es-PY", { dateStyle: "long", timeStyle: "short" }) : "—"],
        ["Cliente", opts.clientName || "—"],
        ["Correo", opts.clientEmail || "—"],
        ["Ruta", `${airportLabel(r.originAirport, r.trip.origin_airport_ident)} → ${airportLabel(r.destinationAirport, r.trip.destination_airport_ident)}${r.schedule.roundtrip ? " (ida y vuelta)" : ""}`],
        ["Salida", formatFlightDateTime(r.schedule.outbound_flight_departure_time)],
        ["Pasajeros", String(r.capacity?.passangers ?? 1)],
        ["Aeronave", `${r.aircraftSpecs?.basic_specs?.model ?? ""} ${r.aircraftSpecs?.basic_specs?.registration ?? ""}`.trim() || "—"],
        ["Medio de pago", "Tarjeta (Bancard)"],
        ["Código de operación", r.payment_transaction_id || "—"],
    ];

    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  body{font-family:"Noto Sans",Helvetica,Arial,sans-serif;color:#030436;margin:32px;}
  .brand{font-size:26px;font-weight:800;letter-spacing:-.5px}.brand span{color:#0165FF}
  .eyebrow{color:#0165FF;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-top:24px}
  h1{font-size:22px;margin:4px 0 18px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:9px 0;border-bottom:1px solid #D9DCE8;vertical-align:top}
  td.k{color:#5B5D7A;width:38%}
  .total{margin-top:20px;background:#030436;color:#fff;border-radius:14px;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}
  .total .l{font-size:12px;color:#BFD8FF}.total .v{font-size:22px;font-weight:800}
  .gs{font-size:12px;color:#BFD8FF;text-align:right;margin-top:2px}
  .note{margin-top:22px;font-size:11px;color:#5B5D7A;line-height:1.5}
</style></head><body>
  <div class="brand">Alta<span>Go</span></div>
  <div class="eyebrow">Comprobante de pago</div>
  <h1>Pago recibido</h1>
  <table>${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
  <div class="total"><div class="l">Total pagado<br>IVA incluido</div><div><div class="v">${esc(formatUsd(r.price))}</div>${gs ? `<div class="gs">${esc(gs)}</div>` : ""}</div></div>
  <div class="note">Este comprobante confirma el pago de tu reserva y <b>no tiene valor fiscal</b>.
  La factura legal la emite ALTAVIA S.A. y se te envía por separado.</div>
</body></html>`;
}

export async function generateAndSharePaymentReceiptPdf(
    reservation: ClientReservationItem,
    opts: PaymentReceiptOptions = {}
): Promise<string | null> {
    try {
        const { uri } = await Print.printToFileAsync({ html: buildPaymentReceiptHtml(reservation, opts), base64: false });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                UTI: ".pdf",
                mimeType: "application/pdf",
                dialogTitle: "Comprobante de pago - AltaGo",
            });
        } else {
            Alert.alert("Comprobante generado", "El comprobante de pago se generó correctamente.");
        }
        return uri;
    } catch (error) {
        console.error("Error al generar el comprobante de pago:", error);
        Alert.alert("Error", "No se pudo generar el comprobante de pago.");
        return null;
    }
}
