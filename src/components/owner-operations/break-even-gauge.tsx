import { PeriodOperationalStats } from "@/types/aircraft-operations";
import { formatHours } from "@/utils/aircraft-operations-calc";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface BreakEvenGaugeProps {
    stats: PeriodOperationalStats;
    flownLabelPrefix?: string;
}

export function BreakEvenGauge({
    stats,
    flownLabelPrefix = "Voladas",
}: BreakEvenGaugeProps) {
    const hasBreakEven =
        stats.necesarias !== null &&
        Number.isFinite(stats.necesarias) &&
        stats.necesarias > 0;

    const ratio = hasBreakEven ? stats.horas / (stats.necesarias as number) : 0;
    const fillPercent = hasBreakEven
        ? Math.max(0, Math.min(100, ratio * 50))
        : 0;
    const isOk = hasBreakEven && stats.horas >= (stats.necesarias as number);

    const noteText = hasBreakEven
        ? isOk
            ? "Pasó el equilibrio: cada hora de más es ganancia limpia."
            : "Mientras la barra no llegue a la marca del medio, el período va en pérdida."
        : "La marca del medio es el punto de equilibrio.";

    return (
        <View style={styles.gaugeContainer}>
            {/* Etiquetas Superiores */}
            <View style={styles.labelsRow}>
                <Text style={styles.labelItem}>
                    {flownLabelPrefix}{" "}
                    <Text style={styles.labelBold}>{formatHours(stats.horas)}</Text>
                </Text>
                <Text style={styles.labelItem}>
                    Para no perder{" "}
                    <Text style={styles.labelBold}>
                        {hasBreakEven ? formatHours(stats.necesarias as number) : "—"}
                    </Text>
                </Text>
            </View>

            {/* Barra con marcador central fijo en 50% */}
            <View style={styles.trackWrapper}>
                <View style={styles.track}>
                    <View
                        style={[
                            styles.fill,
                            { width: `${fillPercent}%` },
                            isOk ? styles.fillOk : styles.fillLoss,
                        ]}
                    />
                </View>

                {hasBreakEven && (
                    <>
                        <View style={styles.centerMarker} />
                        <Text style={styles.centerMarkerLabel}>EQUILIBRIO</Text>
                    </>
                )}
            </View>

            {/* Nota explicativa inferior */}
            <Text style={styles.noteText}>{noteText}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    gaugeContainer: {
        marginTop: 26,
    },
    labelsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        gap: 12,
    },
    labelItem: {
        fontSize: 13.5,
        color: "#52647A",
    },
    labelBold: {
        color: "#091626",
        fontWeight: "700",
    },
    trackWrapper: {
        position: "relative",
        height: 34,
        justifyContent: "flex-start",
    },
    track: {
        height: 11,
        borderRadius: 99,
        backgroundColor: "#E6ECF6",
        overflow: "hidden",
    },
    fill: {
        height: 11,
        borderRadius: 99,
    },
    fillLoss: {
        backgroundColor: "#BC3324",
    },
    fillOk: {
        backgroundColor: "#0A7042",
    },
    centerMarker: {
        position: "absolute",
        left: "50%",
        top: -6,
        width: 3,
        height: 23,
        backgroundColor: "#091626",
        borderRadius: 2,
        marginLeft: -1.5,
    },
    centerMarkerLabel: {
        position: "absolute",
        left: "50%",
        top: 19,
        transform: [{ translateX: -36 }],
        width: 72,
        textAlign: "center",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.7,
        color: "#52647A",
    },
    noteText: {
        marginTop: 6,
        fontSize: 13,
        color: "#52647A",
        lineHeight: 18,
    },
});

