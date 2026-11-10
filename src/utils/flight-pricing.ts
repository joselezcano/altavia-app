/**
 * Cotización por hora de vuelo (reemplaza la tarifa por milla).
 *
 * Criterio (definido con Julio, 06/11/2026, y práctica habitual de charter):
 *  - Se cobran TODAS las horas que vuela el avión, incluidos el reposicionamiento
 *    desde su base hasta el origen y el regreso a la base aunque vuelva vacío.
 *  - Horas estimadas = distancia haversine (NM) / velocidad crucero × factor de bloque,
 *    por tramo. El factor (ajustable por aeronave) cubre rodaje, ascenso y desvíos.
 *  - Precio = horas facturables × tarifa por hora (SIN IVA), sin mínimos. El cliente paga + IVA 10 %.
 *  - Si el avión pernocta fuera (ida y vuelta en días distintos), se suma por noche
 *    el pernocte (ej. USD 100) + el hangaraje (variable, editable por vuelo).
 *  - Las tasas de plan de vuelo DINAC van incluidas en la tarifa por hora.
 * El precio final lo confirma la encargada / owner al aprobar la reserva.
 */
import { Airport } from "@/types/all-roles";
import { AircraftPricing, FlightQuote, FlightQuoteLeg } from "@/types/pricing";
import { getDistanceBetweenAirports } from "@/utils/flight-distance";

/** Velocidad crucero de respaldo si la aeronave no la tiene cargada (Cessna 414 ≈ 180 kt). */
export const DEFAULT_CRUISE_SPEED_KNOTS = 180;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fecha calendario (YYYY-MM-DD) en hora de Paraguay. */
function dayInAsuncion(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(date);
}

/** Noches que el avión queda fuera entre la salida y el regreso (0 si es el mismo día). */
export function countOvernights(outbound: Date | null | undefined, ret: Date | null | undefined): number {
    if (!outbound || !ret || ret.getTime() <= outbound.getTime()) return 0;
    const a = new Date(`${dayInAsuncion(outbound)}T00:00:00Z`).getTime();
    const b = new Date(`${dayInAsuncion(ret)}T00:00:00Z`).getTime();
    return Math.max(0, Math.round((b - a) / 86_400_000));
}

const sameAirport = (a?: Airport | null, b?: Airport | null) =>
    !!a && !!b && (a.ident === b.ident || (a.latitude_deg === b.latitude_deg && a.longitude_deg === b.longitude_deg));

/** IVA de Paraguay sobre servicios. Las tarifas son sin IVA; el cliente paga + IVA. */
export const IVA_PCT = 0.1;

/** Factor de bloque de respaldo si la aeronave no tiene uno cargado. */
export const DEFAULT_QUOTE_BLOCK_FACTOR = 1.12;

export interface FlightQuoteInput {
    origin: Airport | undefined | null;
    destination: Airport | undefined | null;
    /** Base de la aeronave. Si falta, se asume que sale del origen y vuelve a él. */
    base?: Airport | null;
    roundtrip: boolean;
    outboundDeparture?: Date | null;
    returnDeparture?: Date | null;
    cruiseSpeedKnots?: number | null;
    pricing?: AircraftPricing | null;
    /** Hangaraje por noche para este vuelo (pisa el de la tarifa). */
    hangarPerNightOverrideUsd?: number | null;
}

export function computeFlightQuote(input: FlightQuoteInput): FlightQuote {
    const { origin, destination, roundtrip } = input;
    const speed = input.cruiseSpeedKnots && input.cruiseSpeedKnots > 0 ? input.cruiseSpeedKnots : DEFAULT_CRUISE_SPEED_KNOTS;
    const base = input.base && input.base.latitude_deg != null ? input.base : origin;
    const factor = input.pricing?.blockFactor && input.pricing.blockFactor > 0 ? input.pricing.blockFactor : DEFAULT_QUOTE_BLOCK_FACTOR;

    const legs: FlightQuoteLeg[] = [];
    const addLeg = (from: Airport | null | undefined, to: Airport | null | undefined, kind: FlightQuoteLeg["kind"]) => {
        if (!from || !to || sameAirport(from, to)) return;
        const distanceNm = getDistanceBetweenAirports(from, to, "nm");
        legs.push({ from: from.ident, to: to.ident, distanceNm: round1(distanceNm), hours: (distanceNm / speed) * factor, kind });
    };

    if (origin && destination) {
        addLeg(base, origin, "positioning");
        addLeg(origin, destination, "passenger");
        if (roundtrip) {
            addLeg(destination, origin, "passenger");
            addLeg(origin, base, "return_empty");
        } else {
            addLeg(destination, base, "return_empty");
        }
    }

    const billableHours = round1(legs.reduce((acc, l) => acc + l.hours, 0));
    const pricePerHourUsd = input.pricing?.pricePerHourUsd ?? 0;
    const flightTotalUsd = Math.round(billableHours * pricePerHourUsd);

    const nights = roundtrip ? countOvernights(input.outboundDeparture, input.returnDeparture) : 0;
    const overnightFeeUsd = input.pricing?.overnightFeeUsd ?? 0;
    const hangarPerNightUsd = input.hangarPerNightOverrideUsd ?? input.pricing?.hangarPerNightUsd ?? 0;
    const overnightTotalUsd = Math.round(nights * (overnightFeeUsd + hangarPerNightUsd));

    return {
        legs: legs.map((l) => ({ ...l, hours: round2(l.hours) })),
        billableHours,
        blockFactor: factor,
        pricePerHourUsd,
        flightTotalUsd,
        nights,
        overnightFeeUsd,
        hangarPerNightUsd,
        overnightTotalUsd,
        totalUsd: flightTotalUsd + overnightTotalUsd,
        ivaUsd: Math.round((flightTotalUsd + overnightTotalUsd) * IVA_PCT),
        totalWithIvaUsd: Math.round((flightTotalUsd + overnightTotalUsd) * (1 + IVA_PCT)),
        hasPricing: pricePerHourUsd > 0,
    };
}

/** Total a pagar con IVA a partir del neto (redondeado a USD). */
export function grossFromNet(netUsd: number): number {
    return Math.round((Number(netUsd) || 0) * (1 + IVA_PCT));
}

/** Precio sin IVA de una reserva. Las viejas no tienen price_net_usd: se deriva del total. */
export function reservationNetPrice(r: { price?: number | null; price_net_usd?: number | null }): number {
    if (typeof r.price_net_usd === "number" && r.price_net_usd > 0) return r.price_net_usd;
    return Math.round(((Number(r.price) || 0) / (1 + IVA_PCT)) * 100) / 100;
}

/** Texto corto del desglose para mostrar debajo del precio. */
export function describeQuote(q: FlightQuote): string {
    const parts = [`${q.billableHours.toLocaleString("es-PY")} h × USD ${q.pricePerHourUsd.toLocaleString("es-PY")}`];
    if (q.nights > 0) {
        parts.push(`${q.nights} ${q.nights === 1 ? "noche" : "noches"} × USD ${(q.overnightFeeUsd + q.hangarPerNightUsd).toLocaleString("es-PY")}`);
    }
    return parts.join(" + ");
}
