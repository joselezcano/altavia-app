import { ScreenHeader } from "@/components/screen-header";
import { ReactNode } from "react";

/** Encabezado de las pantallas de aeronave: usa el ScreenHeader común (atrás encuadrado, título y detalle). */
export function AircraftDetailsHeader({
    header,
    subtitle,
    right,
}: {
    header: string;
    subtitle?: string;
    right?: ReactNode;
}) {
    return <ScreenHeader title={header} subtitle={subtitle} right={right} />;
}
