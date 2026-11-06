import { FIN_COLORS } from "@/components/admin-finance/finance-ui";
import { MatrixRow } from "@/types/admin-finance-ui";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/** Tabla comparativa con la primera columna fija y desplazamiento horizontal. */
export function PlanMatrixTable({
    columns,
    rows,
    columnWidth = 118,
}: {
    columns: string[];
    rows: MatrixRow[];
    columnWidth?: number;
}) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.labelsCol}>
                <View style={[styles.headerCell, styles.labelCell]}>
                    <Text style={styles.headerText}>Concepto</Text>
                </View>
                {rows.map((r, i) => (
                    <View key={r.label} style={[styles.cell, styles.labelCell, i % 2 === 1 ? styles.zebra : null]}>
                        <Text style={[styles.labelText, r.strong ? styles.strong : null]} numberOfLines={2}>
                            {r.label}
                        </Text>
                    </View>
                ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                    <View style={styles.row}>
                        {columns.map((c) => (
                            <View key={c} style={[styles.headerCell, { width: columnWidth }]}>
                                <Text style={styles.headerText} numberOfLines={2}>
                                    {c}
                                </Text>
                            </View>
                        ))}
                    </View>
                    {rows.map((r, i) => (
                        <View key={r.label} style={styles.row}>
                            {r.values.map((v, j) => {
                                const tone = r.tones?.[j];
                                return (
                                    <View
                                        key={`${r.label}-${j}`}
                                        style={[styles.cell, { width: columnWidth }, i % 2 === 1 ? styles.zebra : null]}
                                    >
                                        <Text
                                            style={[
                                                styles.valueText,
                                                r.strong ? styles.strong : null,
                                                tone === "ok" ? styles.ok : tone === "bad" ? styles.bad : null,
                                            ]}
                                        >
                                            {v}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const CELL_HEIGHT = 40;

const styles = StyleSheet.create({
    wrapper: { flexDirection: "row", borderWidth: 1, borderColor: FIN_COLORS.border, borderRadius: 12, overflow: "hidden" },
    labelsCol: { width: 150, borderRightWidth: 1, borderRightColor: FIN_COLORS.border },
    row: { flexDirection: "row" },
    headerCell: {
        height: 48,
        justifyContent: "center",
        paddingHorizontal: 8,
        backgroundColor: FIN_COLORS.blue,
    },
    headerText: { color: FIN_COLORS.white, fontSize: 11, fontWeight: "700", textAlign: "right" },
    labelCell: { alignItems: "flex-start" },
    cell: { height: CELL_HEIGHT, justifyContent: "center", paddingHorizontal: 8, backgroundColor: FIN_COLORS.white },
    zebra: { backgroundColor: FIN_COLORS.light },
    labelText: { fontSize: 11, color: "#334155" },
    valueText: { fontSize: 12, color: FIN_COLORS.text, textAlign: "right", fontWeight: "600" },
    strong: { fontWeight: "800", color: FIN_COLORS.blue },
    ok: { color: FIN_COLORS.ok },
    bad: { color: FIN_COLORS.bad },
});
