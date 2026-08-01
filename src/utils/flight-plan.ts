export const getStatusBadge = (status?: string) => {
    switch (status) {
        case "Approved":
            return { label: "Aprobado", bg: "bg-emerald-50 border-emerald-200 text-emerald-700" };
        case "Updated":
            return { label: "Actualizado", bg: "bg-blue-50 border-blue-200 text-blue-700" };
        case "New":
            return { label: "Nuevo", bg: "bg-amber-50 border-amber-200 text-amber-700" };
        default:
            return { label: status || "Borrador", bg: "bg-lime-50 border-lime-200 text-lime-700" };
    }
};