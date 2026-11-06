import { ClientReservationItem } from "@/types/all-roles";
import { FlightPlanDoc } from "@/types/pilot";


export interface StatusBadge {
    label: string;
    bg: string;
    border: string;
    text: string;
    icon: string;
    iconColor: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
}


export const getStatusBadge = (internalStatus: string): StatusBadge => {
    if (internalStatus === "canceled") {
        return {
            label: "Cancelado",
            bg: "bg-rose-100",
            border: "border-rose-200",
            text: "text-rose-800",
            icon: "close-circle",
            iconColor: "#9f1239",
            backgroundColor: "#FFE4E6",
            borderColor: "#FECDD3",
            textColor: "#9F1239",
        };
    } else if (internalStatus === "pending_approval") {
        return {
            label: "Por Aprobar",
            bg: "bg-amber-100",
            border: "border-amber-200",
            text: "text-amber-800",
            icon: "time-outline",
            iconColor: "#92400e",
            backgroundColor: "#FEF3C7",
            borderColor: "#FDE68A",
            textColor: "#92400E",
        };
    } else if (internalStatus === "awaiting_payment") {
        return {
            label: "Listo para Pago",
            bg: "bg-blue-100",
            border: "border-blue-200",
            text: "text-blue-800",
            icon: "card-outline",
            iconColor: "#1e40af",
            backgroundColor: "#DBEAFE",
            borderColor: "#BFDBFE",
            textColor: "#1E40AF",
        };
    } else if (internalStatus === "pending") {
        return {
            label: "Pendiente",
            bg: "bg-amber-100",
            border: "border-amber-200",
            text: "text-amber-800",
            icon: "time-outline",
            iconColor: "#92400e",
            backgroundColor: "#FEF3C7",
            borderColor: "#FDE68A",
            textColor: "#92400E",
        };
    } else if (internalStatus === "completed") {
        return {
            label: "Completado",
            bg: "bg-slate-100",
            border: "border-slate-200",
            text: "text-slate-700",
            icon: "checkmark-done-circle",
            iconColor: "#334155",
            backgroundColor: "#F1F5F9",
            borderColor: "#E2E8F0",
            textColor: "#334155",
        };
    } else if (internalStatus === "in_flight") {
        return {
            label: "En Vuelo",
            bg: "bg-sky-100",
            border: "border-sky-200",
            text: "text-sky-800",
            icon: "airplane",
            iconColor: "#075985",
            backgroundColor: "#E0F2FE",
            borderColor: "#BAE6FD",
            textColor: "#075985",
        };
    } else if (internalStatus === "delayed") {
        return {
            label: "Demorado",
            bg: "bg-orange-100",
            border: "border-orange-200",
            text: "text-orange-800",
            icon: "alert-circle-outline",
            iconColor: "#9a3412",
            backgroundColor: "#FFEDD5",
            borderColor: "#FED7AA",
            textColor: "#9A3412",
        };
    } else if (internalStatus === "no_show") {
        return {
            label: "Sin Pasajero",
            bg: "bg-purple-100",
            border: "border-purple-200",
            text: "text-purple-800",
            icon: "person-remove-outline",
            iconColor: "#6b21a8",
            backgroundColor: "#F3E8FF",
            borderColor: "#E9D5FF",
            textColor: "#6B21A8",
        };
    } else {
        return {
            label: "Confirmado",
            bg: "bg-emerald-100",
            border: "border-emerald-200",
            text: "text-emerald-800",
            icon: "checkmark-circle",
            iconColor: "#059669",
            backgroundColor: "#D1FAE5",
            borderColor: "#A7F3D0",
            textColor: "#065F46",
        };
    }
};


/**
 * Estados operativos que puede mover el piloto asignado a un vuelo ya confirmado.
 * Debe coincidir con pilotStatuses() en firestore.rules.
 */
export const PILOT_OPERATIONAL_STATUSES = ["confirmed", "delayed", "in_flight", "completed", "no_show"];

export const INTERNAL_STATUS_DEFINITIONS = [
    {
        id: "pending_approval",
        label: "Pendiente de Aprobación",
        hint: "Reserva creada por el cliente. Requiere que el propietario o encargado apruebe y asigne la tripulación.",
    },
    {
        id: "awaiting_payment",
        label: "Esperando Pago",
        hint: "Vuelo aprobado operativamente con tripulación asignada. Pendiente de pago por parte del cliente.",
    },
    {
        id: "pending",
        label: "Pendiente",
        hint: "La reserva está pendiente: cliente no ha pagado en su totalidad, no hay piloto asignado o plan de vuelo.",
    },
    {
        id: "confirmed",
        label: "Confirmado",
        hint: "Reserva confirmada: pago completo, aeropuerto, aeronave y pilotos confirmados.",
    },
    {
        id: "delayed",
        label: "Demorado",
        hint: "El vuelo ha sufrido una demora.",
    },
    {
        id: "in_flight",
        label: "En Vuelo",
        hint: "El vuelo se encuentra en progreso.",
    },
    {
        id: "completed",
        label: "Completado",
        hint: "El vuelo se ha completado.",
    },
    {
        id: "canceled",
        label: "Cancelado",
        hint: "La reserva fue cancelada por el propietario de la aeronave, el cliente u otra razón.",
    },
    {
        id: "no_show",
        label: "Sin Pasajero",
        hint: "El cliente no se presentó para abordar el vuelo.",
    },
];


export function getFlightInformation(reservation: ClientReservationItem, existingFlightPlan?: FlightPlanDoc | null) {
    const model = reservation.aircraftSpecs?.basic_specs?.model || "Aeronave";
    const registration = reservation.aircraftSpecs?.basic_specs?.registration || "N/A";
    const aircraftType = reservation.aircraftSpecs?.basic_specs?.type || "N/A";
    const distanceKm = reservation.distance_nm ? (reservation.distance_nm * 1.852).toFixed(0) : undefined;
    // const cruiseSpeed = reservation.aircraftSpecs?.operating_specs?.cruise_speed_knots || reservation.cruise_speed_knots;
    // const serviceCeiling = reservation.aircraftSpecs?.operating_specs?.service_ceiling_feet;
    const paxCapacity = reservation.aircraftSpecs?.basic_specs?.pax_count;

    // Flight duration computation
    // const outboundMs = reservation.schedule.outbound_flight_arrival_time.getTime() - reservation.schedule.outbound_flight_departure_time.getTime();
    // const flightDurationHours = outboundMs > 0
    //     ? outboundMs / (3600 * 1000)
    //     : (reservation.distance_nm && cruiseSpeed ? reservation.distance_nm / cruiseSpeed : 0);


    const cruiseSpeed = existingFlightPlan?.flight_plan.route.cruising_speed_knots ? existingFlightPlan?.flight_plan.route.cruising_speed_knots : reservation.aircraftSpecs?.operating_specs?.cruise_speed_knots;
    const serviceCeiling = existingFlightPlan?.flight_plan.route.cruising_altitude_feet ? existingFlightPlan?.flight_plan.route.cruising_altitude_feet : reservation.aircraftSpecs?.operating_specs?.service_ceiling_feet;

    // Flight duration computation
    let outboundMs = 0;
    if (existingFlightPlan?.flight_plan.departure.datetime_utc && existingFlightPlan.flight_plan.arrival.datetime_utc) {
        outboundMs = new Date(existingFlightPlan.flight_plan.arrival.datetime_utc).getTime() - new Date(existingFlightPlan.flight_plan.departure.datetime_utc).getTime();
    } else {
        outboundMs = reservation.schedule.outbound_flight_arrival_time.getTime() - reservation.schedule.outbound_flight_departure_time.getTime();
    }
    const flightDurationHours = outboundMs > 0
        ? outboundMs / (3600 * 1000)
        : (reservation.distance_nm && cruiseSpeed ? reservation.distance_nm / cruiseSpeed : 0);

    return {
        model,
        registration,
        aircraftType,
        distanceKm,
        cruiseSpeed,
        serviceCeiling,
        paxCapacity,
        flightDurationHours
    };
}


export function getFlightData(reservation: ClientReservationItem, outboundFlightPlan?: FlightPlanDoc | null, returnFlightPlan?: FlightPlanDoc | null) {
    const model = reservation.aircraftSpecs?.basic_specs?.model || "Aeronave";
    const registration = reservation.aircraftSpecs?.basic_specs?.registration || "N/A";
    const aircraftType = reservation.aircraftSpecs?.basic_specs?.type || "N/A";
    const distanceKm = reservation.distance_nm ? (reservation.distance_nm * 1.852).toFixed(0) : undefined;
    const paxCapacity = reservation.aircraftSpecs?.basic_specs?.pax_count;

    // Speed and altitude
    const cruiseSpeedAircraft = reservation.aircraftSpecs?.operating_specs?.cruise_speed_knots;
    const serviceCeiling = reservation.aircraftSpecs?.operating_specs?.service_ceiling_feet;

    const cruiseSpeedOutbound = outboundFlightPlan?.flight_plan.route.cruising_speed_knots;
    const altitudeOutbound = outboundFlightPlan?.flight_plan.route.cruising_altitude_feet;

    const cruiseSpeedReturn = returnFlightPlan?.flight_plan.route.cruising_speed_knots;
    const altitudeReturn = returnFlightPlan?.flight_plan.route.cruising_altitude_feet;

    // Outbound flight duration computation
    let outboundMs = 0;
    if (outboundFlightPlan?.flight_plan.departure.datetime_utc && outboundFlightPlan?.flight_plan.arrival.datetime_utc) {
        outboundMs = new Date(outboundFlightPlan.flight_plan.arrival.datetime_utc).getTime() - new Date(outboundFlightPlan.flight_plan.departure.datetime_utc).getTime();
    } else {
        outboundMs = reservation.schedule.outbound_flight_arrival_time.getTime() - reservation.schedule.outbound_flight_departure_time.getTime();
    }

    const flightDurationHoursOutbound = outboundMs > 0
        ? outboundMs / (3600 * 1000)
        : (reservation.distance_nm && cruiseSpeedAircraft ? reservation.distance_nm / cruiseSpeedAircraft : 0);

    // Return flight duration computation
    let returnMs = 0;
    if (returnFlightPlan?.flight_plan.departure.datetime_utc && returnFlightPlan?.flight_plan.arrival.datetime_utc) {
        returnMs = new Date(returnFlightPlan.flight_plan.arrival.datetime_utc).getTime() - new Date(returnFlightPlan.flight_plan.departure.datetime_utc).getTime();
    } else {
        if (!reservation.schedule.return_flight_arrival_time || !reservation.schedule.return_flight_departure_time) {
            returnMs = 0;
        } else {
            returnMs = reservation.schedule.return_flight_arrival_time.getTime() - reservation.schedule.return_flight_departure_time.getTime();
        }
    }

    const flightDurationHoursReturn = returnMs > 0
        ? returnMs / (3600 * 1000)
        : (reservation.distance_nm && cruiseSpeedAircraft ? reservation.distance_nm / cruiseSpeedAircraft : 0);

    return {
        model,
        registration,
        aircraftType,
        distanceKm,
        paxCapacity,
        cruiseSpeedAircraft,
        serviceCeiling,
        cruiseSpeedOutbound,
        cruiseSpeedReturn,
        altitudeOutbound,
        altitudeReturn,
        flightDurationHoursOutbound,
        flightDurationHoursReturn
    };
}