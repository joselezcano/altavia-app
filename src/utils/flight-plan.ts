export const getStatusBadge = (status?: string) => {
    switch (status) {
        case "Approved":
            return {
                label: "Aprobado",
                badgeBg: "bg-emerald-50",
                badgeBorder: "border-emerald-200",
                textColor: "text-emerald-700",
                iconColor: "#059669",
                icon: "checkmark-circle" as const,
            };
        case "Updated":
            return {
                label: "Actualizado",
                badgeBg: "bg-blue-50",
                badgeBorder: "border-blue-200",
                textColor: "text-blue-700",
                iconColor: "#2563EB",
                icon: "sync-circle" as const,
            };
        case "New":
            return {
                label: "Nuevo",
                badgeBg: "bg-amber-50",
                badgeBorder: "border-amber-200",
                textColor: "text-amber-700",
                iconColor: "#D97706",
                icon: "sparkles" as const,
            };
        default:
            return {
                label: status || "Borrador",
                badgeBg: "bg-slate-100",
                badgeBorder: "border-slate-200",
                textColor: "text-slate-700",
                iconColor: "#64748B",
                icon: "document-text-outline" as const,
            };
    }
};