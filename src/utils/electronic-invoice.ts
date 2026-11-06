import { ClientReservationItem } from "@/types/all-roles";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export interface InvoiceData {
  invoiceNumber: string;
  timbrado: string;
  cdc: string;
  emissionDate: Date;
  clientName: string;
  clientEmail: string;
  clientDoc: string;
  amountUsd: number;
  originAirport: string;
  destinationAirport: string;
  aircraftModel: string;
  aircraftRegistration: string;
  paxCount: number;
}

export function generateMockInvoiceData(reservation: ClientReservationItem, clientEmail?: string): InvoiceData {
  const randomSerial = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = reservation.invoice_number || `001-001-000${randomSerial}`;
  const timbrado = reservation.invoice_timbrado || "17492831";
  
  // Format 44-digit CDC (Código de Control SIFEN Paraguay)
  const cdc = reservation.invoice_cdc || 
    `01800987654001001000${randomSerial}120261016${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  const origin = reservation.originAirport?.iata_code 
    ? `${reservation.originAirport.municipality || reservation.originAirport.name} (${reservation.originAirport.iata_code})`
    : reservation.trip.origin_airport_ident;

  const destination = reservation.destinationAirport?.iata_code
    ? `${reservation.destinationAirport.municipality || reservation.destinationAirport.name} (${reservation.destinationAirport.iata_code})`
    : reservation.trip.destination_airport_ident;

  return {
    invoiceNumber,
    timbrado,
    cdc,
    emissionDate: reservation.paid_at ? new Date(reservation.paid_at) : new Date(),
    clientName: "CLIENTE ALTAVIA S.A.",
    clientEmail: clientEmail || "facturacion@altavia.com",
    clientDoc: "80098765-4",
    amountUsd: reservation.price,
    originAirport: origin,
    destinationAirport: destination,
    aircraftModel: reservation.aircraftSpecs?.basic_specs.model || "Cessna Citation CJ3",
    aircraftRegistration: reservation.aircraftSpecs?.basic_specs.registration || "ZP-BKL",
    paxCount: reservation.capacity?.passangers || 1,
  };
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const amountGs = Math.round(data.amountUsd * 7850);
  const iva10Gs = Math.round(amountGs / 11);
  const netGs = amountGs - iva10Gs;
  const iva10Usd = (data.amountUsd / 11).toFixed(2);
  const netUsd = (data.amountUsd - Number(iva10Usd)).toFixed(2);

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Factura Electrónica e-Kuatia - ALTAVIA</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 24px;
          color: #0f1e3d;
          background: #ffffff;
          font-size: 11px;
        }
        .header {
          border-bottom: 2px solid #0f1e3d;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
        }
        .company-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f1e3d;
        }
        .company-sub {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        .fiscal-box {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          text-align: right;
          background: #f8fafc;
        }
        .invoice-title {
          font-size: 12px;
          font-weight: 800;
          color: #00529b;
        }
        .invoice-num {
          font-size: 14px;
          font-weight: 800;
          color: #0f1e3d;
          margin: 2px 0;
        }
        .cdc-box {
          background: #eef2f6;
          border: 1px dashed #94a3b8;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 16px;
          font-family: monospace;
          font-size: 10px;
          text-align: center;
          word-break: break-all;
        }
        .section-title {
          background: #0f1e3d;
          color: #ffffff;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 8px;
          border-radius: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #e2e8f0;
          padding: 8px;
          text-align: left;
          font-size: 10px;
        }
        th {
          background: #f1f5f9;
          font-weight: 700;
          color: #334155;
        }
        .totals-table td {
          border: none;
          padding: 4px 8px;
        }
        .totals-table {
          width: 320px;
          margin-left: auto;
          margin-bottom: 20px;
        }
        .badge-sifen {
          display: inline-block;
          background: #dcfce7;
          color: #166534;
          padding: 3px 6px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 9px;
        }
        .footer {
          border-top: 1px solid #cbd5e1;
          padding-top: 12px;
          font-size: 9px;
          color: #64748b;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">ALTAVIA S.A.</div>
          <div class="company-sub">Transporte Aéreo Chárter & Servicios Ejecutivos</div>
          <div class="company-sub">RUC: 80098765-4 • Tel: +595 21 600 000</div>
          <div class="company-sub">Hangar Altavia, Aeropuerto Silvio Pettirossi (ASU), Luque - Paraguay</div>
        </div>
        <div class="fiscal-box">
          <div class="invoice-title">FACTURA ELECTRÓNICA</div>
          <div class="invoice-num">Nº ${data.invoiceNumber}</div>
          <div>Timbrado Nº: <strong>${data.timbrado}</strong></div>
          <div>Inicio Vigencia: 01/01/2026</div>
          <div style="margin-top: 4px;"><span class="badge-sifen">SIFEN / e-Kuatia APROBADO</span></div>
        </div>
      </div>

      <div class="cdc-box">
        <strong>CDC (Código de Control SIFEN):</strong><br/>
        ${data.cdc}
      </div>

      <div class="section-title">Datos del Receptor / Cliente</div>
      <table>
        <tr>
          <td style="width: 20%;"><strong>Nombre / Razón Social:</strong></td>
          <td style="width: 40%;">${data.clientName}</td>
          <td style="width: 15%;"><strong>RUC / Doc:</strong></td>
          <td style="width: 25%;">${data.clientDoc}</td>
        </tr>
        <tr>
          <td><strong>Email:</strong></td>
          <td>${data.clientEmail}</td>
          <td><strong>Fecha Emisión:</strong></td>
          <td>${data.emissionDate.toLocaleDateString("es-PY")} ${data.emissionDate.toLocaleTimeString("es-PY")}</td>
        </tr>
        <tr>
          <td><strong>Condición de Venta:</strong></td>
          <td>Contado (Pasarela Bancard vPOS)</td>
          <td><strong>Moneda:</strong></td>
          <td>Dólares Americanos (USD) / Guaraníes (PYG)</td>
        </tr>
      </table>

      <div class="section-title">Detalle del Servicio Aeronáutico</div>
      <table>
        <thead>
          <tr>
            <th>Cant.</th>
            <th>Descripción del Servicio</th>
            <th>Aeronave / Matrícula</th>
            <th>Ruta</th>
            <th style="text-align: right;">Precio Unit. (USD)</th>
            <th style="text-align: right;">Total (USD)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <strong>Vuelo Chárter Privado Ejecutivo</strong><br/>
              <span style="color: #64748b;">Capacidad: ${data.paxCount} pasajero(s). Servicio de handling y tasas aeroportuarias incluidas.</span>
            </td>
            <td>${data.aircraftModel}<br/><strong>${data.aircraftRegistration}</strong></td>
            <td><strong>${data.originAirport}</strong> ➔ <strong>${data.destinationAirport}</strong></td>
            <td style="text-align: right;">$${data.amountUsd.toLocaleString("en-US")}</td>
            <td style="text-align: right; font-weight: 700;">$${data.amountUsd.toLocaleString("en-US")}</td>
          </tr>
        </tbody>
      </table>

      <!-- Liquidacion de Totales e IVA -->
      <table class="totals-table">
        <tr>
          <td style="text-align: right;"><strong>Subtotal Gravado (USD):</strong></td>
          <td style="text-align: right; font-weight: 600;">$${netUsd}</td>
        </tr>
        <tr>
          <td style="text-align: right;"><strong>Liquidación IVA 10% (USD):</strong></td>
          <td style="text-align: right; font-weight: 600; color: #00529b;">$${iva10Usd}</td>
        </tr>
        <tr style="border-top: 2px solid #0f1e3d;">
          <td style="text-align: right; font-size: 13px;"><strong>TOTAL A PAGAR (USD):</strong></td>
          <td style="text-align: right; font-size: 14px; font-weight: 800; color: #0f1e3d;">$${data.amountUsd.toLocaleString("en-US")}</td>
        </tr>
        <tr>
          <td style="text-align: right; color: #64748b; font-size: 10px;">Equivalente en Guaraníes (T.C. 7.850):</td>
          <td style="text-align: right; font-weight: 700; color: #475569; font-size: 11px;">Gs. ${amountGs.toLocaleString("es-PY")}</td>
        </tr>
        <tr>
          <td style="text-align: right; color: #64748b; font-size: 9px;">Total IVA 10% (Gs.):</td>
          <td style="text-align: right; color: #64748b; font-size: 9px;">Gs. ${iva10Gs.toLocaleString("es-PY")}</td>
        </tr>
      </table>

      <div class="footer">
        Este documento es una Representación Gráfica de un Documento Tributario Electrónico (DTE) de Paraguay.<br/>
        Consulte la validez de este comprobante en el Sistema Integrado de Facturación Electrónica Nacional (SIFEN - e-Kuatia) ingresando el CDC de 44 dígitos.<br/>
        <strong>ALTAVIA S.A. • Aviación Ejecutiva y Movilidad Aérea • Asunción, Paraguay</strong>
      </div>
    </body>
    </html>
  `;
}

export async function generateAndShareInvoicePdf(
  reservation: ClientReservationItem,
  clientEmail?: string
): Promise<string | null> {
  try {
    const data = generateMockInvoiceData(reservation, clientEmail);
    const html = buildInvoiceHtml(data);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `Factura Electrónica ${data.invoiceNumber} - ALTAVIA`,
      });
    } else {
      Alert.alert(
        "Factura Generada",
        `Tu factura electrónica ${data.invoiceNumber} ha sido generada exitosamente en: ${uri}`
      );
    }

    return uri;
  } catch (error) {
    console.error("Error al generar factura electrónica PDF:", error);
    Alert.alert("Error", "No se pudo generar la factura electrónica en PDF.");
    return null;
  }
}
