import { AircraftOperationsConfig, OperationalExpenseDoc, OperationalFlightDoc } from "@/types/aircraft-operations";
import { BusinessPlan } from "@/types/business-plan";

/** Opción de una fila de chips (Facturación y Plan de negocio del ADMIN). */
export interface ChipOption<T extends string> {
    value: T;
    label: string;
}

/** Fila de la tabla comparativa del plan de negocio. */
export interface MatrixRow {
    label: string;
    values: string[];
    strong?: boolean;
    tones?: ("ok" | "bad" | "neutral")[];
}

/** Datos que reciben las pestañas del plan de negocio. */
export interface BusinessPlanTabProps {
    plan: BusinessPlan;
    cfg: AircraftOperationsConfig;
    flights: OperationalFlightDoc[];
    expenses: OperationalExpenseDoc[];
    liveTc: number; // tipo de cambio del día (Contadores/cambioDelDia)
}
