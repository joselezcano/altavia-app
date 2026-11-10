/**
 * Hoja del presupuesto en HTML (para el PDF con expo-print o la impresión en web).
 * Muestra lo mismo que la hoja pública: solo las líneas visibles (buildClientView),
 * subtotal sin IVA, IVA 10 % y total. Nunca los costos internos ni el margen.
 */
import { BRAND_COLORS } from "@/constants/brand";
import { BRAND_ISOTIPO_COLOR_DATA_URI } from "@/constants/brand-isotipo-base64";
import { QuoteDoc } from "@/types/quote";
import { buildClientView } from "@/utils/quote-builder";
import { formatQuoteDate, formatUsd, quoteAirportLabel, quoteShortNumber } from "@/utils/quote-format";

const esc = (v: unknown) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

export function buildQuoteSheetHtml(q: QuoteDoc): string {
    const view = buildClientView(q.lines || [], q);
    const origin = quoteAirportLabel(q.trip.origin_name, q.trip.origin_airport_ident);
    const destination = quoteAirportLabel(q.trip.destination_name, q.trip.destination_airport_ident);
    const issued = formatQuoteDate(q.sentAt || q.createdAt || new Date(), false);
    const ivaPct = Math.round((view.ivaPct || 0) * 100);

    const rows = view.lines
        .map(
            (l) => `
        <tr>
          <td>${esc(l.label)}${l.detail ? `<div class="detail">${esc(l.detail)}</div>` : ""}</td>
          <td class="amount">${esc(formatUsd(l.amountUsd))}</td>
        </tr>`
        )
        .join("");

    const schedule = [
        `<div><span class="k">Salida</span> ${esc(formatQuoteDate(q.schedule.outbound_flight_departure_time))} hs</div>`,
        q.schedule.roundtrip && q.schedule.return_flight_departure_time
            ? `<div><span class="k">Regreso</span> ${esc(formatQuoteDate(q.schedule.return_flight_departure_time))} hs</div>`
            : "",
    ].join("");

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Presupuesto ${esc(quoteShortNumber(q.id))} · AltaGo</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: ${BRAND_COLORS.navy}; margin: 0; padding: 32px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${BRAND_COLORS.navy}; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; }
  .brand img { height: 46px; margin-right: 10px; }
  .wordmark { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .wordmark .go { color: ${BRAND_COLORS.azur}; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 22px; letter-spacing: 2px; }
  .doc .num { color: ${BRAND_COLORS.azur}; font-weight: 700; font-size: 15px; }
  .doc .meta { color: ${BRAND_COLORS.textMuted}; font-size: 12px; margin-top: 4px; }
  .grid { display: flex; margin-top: 20px; }
  .grid > div { flex: 1; background: ${BRAND_COLORS.backgroundAlt}; border: 1px solid ${BRAND_COLORS.border}; border-radius: 12px; padding: 12px 14px; margin-right: 10px; }
  .grid > div:last-child { margin-right: 0; }
  .label { text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: ${BRAND_COLORS.textMuted}; margin-bottom: 4px; }
  .strong { font-weight: 700; font-size: 14px; }
  .k { color: ${BRAND_COLORS.textMuted}; display: inline-block; min-width: 64px; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.textMuted}; border-bottom: 1px solid ${BRAND_COLORS.border}; padding: 8px 4px; }
  th.amount, td.amount { text-align: right; white-space: nowrap; }
  td { padding: 10px 4px; border-bottom: 1px solid #EEF1F7; vertical-align: top; }
  .detail { color: ${BRAND_COLORS.textMuted}; font-size: 11px; margin-top: 2px; }
  .totals { margin-top: 14px; margin-left: auto; width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid ${BRAND_COLORS.navy}; margin-top: 6px; padding-top: 8px; font-size: 17px; font-weight: 800; color: ${BRAND_COLORS.azur}; }
  .legend { margin-top: 18px; font-size: 11px; color: ${BRAND_COLORS.textMuted}; }
  .notes { margin-top: 16px; background: ${BRAND_COLORS.surfaceTint}; border-radius: 12px; padding: 12px 14px; white-space: pre-wrap; }
  .footer { margin-top: 28px; font-size: 10px; color: ${BRAND_COLORS.textMuted}; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${BRAND_ISOTIPO_COLOR_DATA_URI}" alt="AltaGo" />
      <span class="wordmark">Alta<span class="go">Go</span></span>
    </div>
    <div class="doc">
      <h1>PRESUPUESTO</h1>
      <div class="num">N.º ${esc(quoteShortNumber(q.id))}</div>
      <div class="meta">Fecha: ${esc(issued)} · Válido hasta: ${esc(formatQuoteDate(q.validUntil, false))}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Cliente</div>
      <div class="strong">${esc(q.clientName)}</div>
      ${q.clientPhone ? `<div>${esc(q.clientPhone)}</div>` : ""}
      ${q.clientEmail ? `<div>${esc(q.clientEmail)}</div>` : ""}
    </div>
    <div>
      <div class="label">Aeronave</div>
      <div class="strong">${esc(q.aircraftModel)}</div>
      <div>${esc(q.aircraftRegistration)}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Ruta</div>
      <div class="strong">${esc(origin)} → ${esc(destination)}</div>
      <div>${q.schedule.roundtrip ? "Ida y vuelta" : "Solo ida"} · ${esc(q.passengers)} ${q.passengers === 1 ? "pasajero" : "pasajeros"}</div>
    </div>
    <div>
      <div class="label">Fechas y horas</div>
      ${schedule}
    </div>
  </div>

  <table>
    <thead><tr><th>Concepto</th><th class="amount">USD sin IVA</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal (sin IVA)</span><span>${esc(formatUsd(view.subtotalUsd))}</span></div>
    <div><span>IVA ${ivaPct} %</span><span>${esc(formatUsd(view.ivaUsd))}</span></div>
    <div class="grand"><span>Total a pagar</span><span>${esc(formatUsd(view.totalUsd))}</span></div>
  </div>

  <div class="legend">Montos expresados en USD sin IVA. El total a pagar incluye IVA ${ivaPct} %.</div>
  ${q.notes ? `<div class="notes"><div class="label">Notas</div>${esc(q.notes)}</div>` : ""}

  <div class="footer">AltaGo · ALTAVIA S.A.</div>
</body>
</html>`;
}
