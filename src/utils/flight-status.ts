export const getStatusBadge = (internalStatus: string) => {
    if (internalStatus === "canceled") {
        return {
            label: "Cancelado",
            bg: "bg-rose-100",
            border: "border-rose-200",
            text: "text-rose-800",
            icon: "close-circle",
            iconColor: "#9f1239",
        };
    } else if (internalStatus === "pending") {
        return {
            label: "Pendiente",
            bg: "bg-amber-100",
            border: "border-amber-200",
            text: "text-amber-800",
            icon: "time-outline",
            iconColor: "#92400e",
        };
    } else if (internalStatus === "completed") {
        return {
            label: "Completado",
            bg: "bg-slate-100",
            border: "border-slate-200",
            text: "text-slate-700",
            icon: "checkmark-done-circle",
            iconColor: "#334155",
        };
    } else if (internalStatus === "in_flight") {
        return {
            label: "En Vuelo",
            bg: "bg-sky-100",
            border: "border-sky-200",
            text: "text-sky-800",
            icon: "airplane",
            iconColor: "#075985",
        };
    } else if (internalStatus === "delayed") {
        return {
            label: "Demorado",
            bg: "bg-orange-100",
            border: "border-orange-200",
            text: "text-orange-800",
            icon: "alert-circle-outline",
            iconColor: "#9a3412",
        };
    } else if (internalStatus === "no_show") {
        return {
            label: "Sin Pasajero",
            bg: "bg-purple-100",
            border: "border-purple-200",
            text: "text-purple-800",
            icon: "person-remove-outline",
            iconColor: "#6b21a8",
        };
    } else {
        return {
            label: "Confirmado",
            bg: "bg-emerald-100",
            border: "border-emerald-200",
            text: "text-emerald-800",
            icon: "checkmark-circle",
            iconColor: "#059669",
        };
    }
};


export const INTERNAL_STATUS_DEFINITIONS = [
    {
        id: "pending",
        label: "Pendiente",
        hint: "La reserva está pendiente: el cliente no ha pagado en su totalidad, no hay piloto asignado o plan de vuelo.",
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