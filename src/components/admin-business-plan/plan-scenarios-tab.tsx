import { PlanMatrixTable } from "@/components/admin-business-plan/plan-matrix-table";
import { DataRow, InfoNote, SectionCard } from "@/components/admin-finance/finance-ui";
import { BusinessPlanTabProps, MatrixRow } from "@/types/admin-finance-ui";
import { PlanScenarioResult } from "@/types/business-plan";
import { formatHours, formatSignedUsd, formatUsd } from "@/utils/aircraft-operations-calc";
import {
    buildPlanCostBase,
    computeScenarioTable,
    computeTariffComparison,
    formatMonths,
    formatNumber,
    formatPct,
    getFijosMes,
    getTarifaHoy,
} from "@/utils/business-plan";
import React, { useMemo } from "react";
import { View } from "react-native";

function tone(v: number): "ok" | "bad" {
    return v >= 0 ? "ok" : "bad";
}

function buildRows(results: PlanScenarioResult[], showIva: boolean): MatrixRow[] {
    const r = (label: string, get: (x: PlanScenarioResult) => string, strong?: boolean, tones?: (x: PlanScenarioResult) => "ok" | "bad"): MatrixRow => ({
        label,
        values: results.map(get),
        strong,
        tones: tones ? results.map(tones) : undefined,
    });
    return [
        r("Horas / mes", (x) => formatHours(x.input.horasMes)),
        r(showIva ? "Tarifa (USD/h, IVA incl.)" : "Tarifa (USD/h)", (x) => formatUsd(x.input.tarifaHora)),
        r("Ingreso neto de IVA", (x) => formatUsd(x.ingresoNeto), true),
        r("Costo variable", (x) => formatUsd(x.costoVariableMes)),
        r("Reserva de overhaul", (x) => formatUsd(x.overhaulMes)),
        r("Fijos (con seguro)", (x) => formatUsd(x.fijosMes)),
        r("Comisión Bancard", (x) => formatUsd(x.comisionBancard)),
        r("Costo total", (x) => formatUsd(x.costoTotal), true),
        r("IRE estimado", (x) => formatUsd(x.ire)),
        r("Resultado mensual", (x) => formatSignedUsd(x.resultado), true, (x) => tone(x.resultado)),
        r("Margen de un vuelo típico", (x) => formatUsd(x.margenVueloTipico)),
        r("Equilibrio (hs/mes)", (x) => (x.equilibrioHorasMes !== null ? formatHours(x.equilibrioHorasMes) : "—")),
        r("Recupero solo avión", (x) => formatMonths(x.recuperoMesesAvion)),
        r("Recupero avión + aviónica", (x) => formatMonths(x.recuperoMesesAvionAvionica)),
        r("ROI anual (avión + aviónica)", (x) => formatPct(x.roiAnualPct)),
    ];
}

/** Escenarios sin CESA y con CESA, comparativo de tarifas y supuestos de costos. */
export function PlanScenariosTab({ plan, cfg }: BusinessPlanTabProps) {
    const base = useMemo(() => buildPlanCostBase(plan, cfg), [plan, cfg]);
    const toggles = useMemo(
        () => ({ descontarBancard: plan.descontarBancard, descontarIre: plan.descontarIre }),
        [plan.descontarBancard, plan.descontarIre]
    );
    const scenarios = useMemo(() => computeScenarioTable(base, plan, getTarifaHoy(cfg), toggles), [base, plan, cfg, toggles]);
    const comparison = useMemo(() => computeTariffComparison(base, plan, toggles), [base, plan, toggles]);
    const showIva = plan.ivaPct > 0;

    return (
        <View>
            <SectionCard
                title="Escenarios: hoy y con CESA"
                subtitle={`Tarifa de hoy: la de GIO (USD ${formatNumber(getTarifaHoy(cfg))}/h). Con CESA: USD ${formatNumber(plan.tarifasCesa[0])}/h y seguro de USD ${formatNumber(plan.seguroAnualConCesa)}/año.`}
            >
                <PlanMatrixTable columns={scenarios.map((s) => s.input.etiqueta)} rows={buildRows(scenarios, showIva)} />
            </SectionCard>

            <SectionCard
                title="Comparativo de tarifas con CESA"
                subtitle={`Las 3 tarifas del plan a ${formatNumber(plan.horasCesaConservador, 1)} y ${formatNumber(plan.horasCesaObjetivo, 1)} hs/mes. Incluye la recuperación de la inversión.`}
            >
                <PlanMatrixTable columns={comparison.map((s) => s.input.etiqueta)} rows={buildRows(comparison, showIva)} />
            </SectionCard>

            <SectionCard title="Supuestos de costos" subtitle="Leídos de la configuración de GIO de la aeronave, más los del plan.">
                <DataRow label="Tipo de cambio (GIO)" value={`${formatNumber(base.tc)} Gs/USD`} />
                <DataRow
                    label="Combustible"
                    value={`${formatUsd(base.variableHora.combustible)} /h`}
                    sub={`${formatNumber(cfg.consumoLt)} L/h × Gs ${formatNumber(cfg.precioLtGs)}/L`}
                />
                <DataRow label="Piloto" value={`${formatUsd(base.variableHora.piloto)} /h`} />
                <DataRow
                    label="Tasas por vuelo prorrateadas"
                    value={`${formatUsd(base.variableHora.tasas)} /h`}
                    sub={`${formatUsd(base.tasasPorVueloUsd)} por vuelo (DINAC con ${formatNumber(plan.pasajerosPromedio, 1)} pax + otras tasas) ÷ ${formatNumber(base.duracionVueloTipicoHs, 1)} h`}
                />
                <DataRow label="Aceite e imprevistos (plan)" value={`${formatUsd(base.variableHora.aceite + base.variableHora.imprevistos)} /h`} />
                <DataRow label="Costo variable total" value={`${formatUsd(base.variableHora.total)} /h`} strong />
                <DataRow
                    label="Reserva de overhaul (GIO)"
                    value={base.overhaul.modo === "por_hora" ? `${formatUsd(base.overhaul.usdHora)} /h` : `${formatUsd(base.overhaul.usdMes)} /mes`}
                />
                {base.fijosComunes.map((f) => (
                    <DataRow
                        key={f.id}
                        label={f.concepto}
                        value={`${formatUsd(f.usdMes)} /mes`}
                        sub={f.origen === "gio" ? "Gasto fijo de GIO" : "Del plan"}
                    />
                ))}
                <DataRow label="Seguro sin CESA (plan)" value={`${formatUsd(base.seguroMesSinCesa)} /mes`} />
                <DataRow label="Seguro con CESA (plan)" value={`${formatUsd(base.seguroMesConCesa)} /mes`} />
                <DataRow
                    label="Fijos del mes"
                    value={`${formatUsd(getFijosMes(base, false))} · ${formatUsd(getFijosMes(base, true))}`}
                    sub="Sin CESA · con CESA (sin overhaul)"
                    strong
                />
                {base.fijosGioReemplazados.length > 0 ? (
                    <InfoNote
                        text={`El plan reemplaza estas líneas de los fijos de GIO para no contarlas dos veces: ${base.fijosGioReemplazados
                            .map((f) => `${f.concepto} (${formatUsd(f.usdMes)}/mes)`)
                            .join(", ")}.`}
                    />
                ) : null}
            </SectionCard>
        </View>
    );
}
