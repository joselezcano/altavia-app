import { DataRow, InfoNote, KpiGrid, KpiTile, SectionCard } from "@/components/admin-finance/finance-ui";
import { BusinessPlanTabProps } from "@/types/admin-finance-ui";
import { formatUsd } from "@/utils/aircraft-operations-calc";
import { computeThirdPartyFees, formatNumber, formatPct } from "@/utils/business-plan";
import React, { useMemo } from "react";
import { View } from "react-native";

/** Hoja "Fee CESA + Plataforma": fee de plataforma sugerido e ingresos por categoría de aeronave. */
export function PlanThirdPartyTab({ plan }: BusinessPlanTabProps) {
    const t = useMemo(() => computeThirdPartyFees(plan), [plan]);

    return (
        <View>
            <SectionCard
                title="Fee de plataforma sugerido"
                subtitle={`Costo de la plataforma ÷ (plazo × aeronaves): ${formatUsd(t.plataformaCostoUsd)} ÷ (${formatNumber(t.plataformaRecuperoMeses)} meses × ${formatNumber(t.aeronaves)} aeronaves).`}
            >
                <KpiGrid>
                    <KpiTile label="Fee por aeronave" value={`${formatUsd(t.feePlataformaSugerido)}/mes`} tone="gold" />
                    <KpiTile label="Aeronaves de terceros" value={formatNumber(t.aeronaves)} sub={`${formatNumber(t.horasMes, 1)} hs/mes cada una`} />
                </KpiGrid>
                <View style={{ height: 8 }} />
                {t.sensibilidad.map((s) => (
                    <DataRow key={s.meses} label={`Recupero en ${s.meses} meses`} value={`${formatUsd(s.feeMes)} /mes por aeronave`} />
                ))}
            </SectionCard>

            <SectionCard title="Ingresos por categoría" subtitle="Fee por hora de uso del CESA + fee de plataforma.">
                {t.categorias.map((c) => (
                    <View key={c.id} style={{ marginBottom: 10 }}>
                        <DataRow label={c.etiqueta} value={`${formatUsd(c.feeHora)} /h`} strong />
                        <DataRow label="Fee por hora del mes (por aeronave)" value={formatUsd(c.ingresoFeeHoraMes)} />
                        <DataRow label="Fee de plataforma (por aeronave)" value={formatUsd(c.feePlataformaMes)} />
                        <DataRow label="Total por aeronave / mes" value={formatUsd(c.totalPorAeronave)} />
                        <DataRow
                            label={`Total ${formatNumber(t.aeronaves)} aeronaves / mes`}
                            value={formatUsd(c.totalFlota)}
                            tone="ok"
                        />
                    </View>
                ))}
            </SectionCard>

            <InfoNote
                text={`Los fees se toman netos, como en la planilla (sin IVA). La comisión de la pasarela (${formatPct(t.feePasarelaPct)}) se descuenta de la liquidación al dueño de la aeronave: no la absorbe AltaGo. En la práctica habrá una mezcla de categorías.`}
            />
        </View>
    );
}
