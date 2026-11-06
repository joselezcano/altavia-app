/**
 * Piezas visuales compartidas por Facturación y Plan de negocio (ADMIN).
 * Estilo actual de la app (brand-blue / brand-gold). Todo con StyleSheet (regla 5 de NativeWind).
 */
import { ChipOption } from "@/types/admin-finance-ui";
import { formatMonthLabel, shiftMonthKey } from "@/utils/aircraft-operations-calc";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const FIN_COLORS = {
    blue: "#030436",
    gold: "#0165FF",
    light: "#F8FAFC",
    border: "#E2E8F0",
    muted: "#64748B",
    text: "#0F172A",
    ok: "#0A7042",
    okBg: "#E8F6EE",
    bad: "#BC3324",
    badBg: "#FBECEA",
    warn: "#B45309",
    warnBg: "#FEF3C7",
    white: "#FFFFFF",
};

export function SectionCard({
    title,
    subtitle,
    right,
    children,
}: {
    title?: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.card}>
            {title ? (
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{title}</Text>
                        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
                    </View>
                    {right}
                </View>
            ) : null}
            {children}
        </View>
    );
}

export function KpiTile({
    label,
    value,
    sub,
    tone = "neutral",
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: "neutral" | "ok" | "bad" | "gold";
}) {
    const valueStyle =
        tone === "ok" ? styles.valueOk : tone === "bad" ? styles.valueBad : tone === "gold" ? styles.valueGold : null;
    return (
        <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>{label}</Text>
            <Text style={[styles.kpiValue, valueStyle]} numberOfLines={1} adjustsFontSizeToFit>
                {value}
            </Text>
            {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
        </View>
    );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
    return <View style={styles.kpiGrid}>{children}</View>;
}

export function DataRow({
    label,
    value,
    sub,
    strong,
    tone = "neutral",
}: {
    label: string;
    value: string;
    sub?: string;
    strong?: boolean;
    tone?: "neutral" | "ok" | "bad";
}) {
    return (
        <View style={styles.dataRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.dataLabel, strong ? styles.dataStrong : null]}>{label}</Text>
                {sub ? <Text style={styles.dataSub}>{sub}</Text> : null}
            </View>
            <Text
                style={[
                    styles.dataValue,
                    strong ? styles.dataStrong : null,
                    tone === "ok" ? styles.valueOk : tone === "bad" ? styles.valueBad : null,
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

export function MonthSelector({ monthKey, onChange }: { monthKey: string; onChange: (k: string) => void }) {
    return (
        <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthBtn} onPress={() => onChange(shiftMonthKey(monthKey, -1))}>
                <Ionicons name="chevron-back" size={18} color={FIN_COLORS.blue} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{formatMonthLabel(monthKey)}</Text>
            <TouchableOpacity style={styles.monthBtn} onPress={() => onChange(shiftMonthKey(monthKey, 1))}>
                <Ionicons name="chevron-forward" size={18} color={FIN_COLORS.blue} />
            </TouchableOpacity>
        </View>
    );
}

export function ChipRow<T extends string>({
    options,
    value,
    onChange,
}: {
    options: ChipOption<T>[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <TouchableOpacity
                        key={o.value}
                        onPress={() => onChange(o.value)}
                        style={[styles.chip, active ? styles.chipActive : null]}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{o.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

export function InfoNote({ text, tone = "info" }: { text: string; tone?: "info" | "warn" }) {
    return (
        <View style={[styles.note, tone === "warn" ? styles.noteWarn : null]}>
            <Ionicons
                name={tone === "warn" ? "alert-circle-outline" : "information-circle-outline"}
                size={16}
                color={tone === "warn" ? FIN_COLORS.warn : FIN_COLORS.muted}
            />
            <Text style={[styles.noteText, tone === "warn" ? { color: FIN_COLORS.warn } : null]}>{text}</Text>
        </View>
    );
}

export function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "ok" | "warn" | "bad" }) {
    const bg =
        tone === "ok" ? FIN_COLORS.okBg : tone === "warn" ? FIN_COLORS.warnBg : tone === "bad" ? FIN_COLORS.badBg : "#EEF2F6";
    const fg =
        tone === "ok" ? FIN_COLORS.ok : tone === "warn" ? FIN_COLORS.warn : tone === "bad" ? FIN_COLORS.bad : FIN_COLORS.blue;
    return (
        <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: FIN_COLORS.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        padding: 14,
        marginBottom: 14,
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: FIN_COLORS.blue },
    cardSubtitle: { fontSize: 12, color: FIN_COLORS.muted, marginTop: 2, lineHeight: 16 },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
    kpi: {
        width: "48.5%",
        backgroundColor: FIN_COLORS.light,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        padding: 12,
    },
    kpiLabel: { fontSize: 11, fontWeight: "700", color: FIN_COLORS.muted, textTransform: "uppercase" },
    kpiValue: { fontSize: 19, fontWeight: "700", color: FIN_COLORS.blue, marginTop: 4 },
    kpiSub: { fontSize: 11, color: FIN_COLORS.muted, marginTop: 3, lineHeight: 15 },
    valueOk: { color: FIN_COLORS.ok },
    valueBad: { color: FIN_COLORS.bad },
    valueGold: { color: FIN_COLORS.gold },
    dataRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    dataLabel: { fontSize: 13, color: "#334155" },
    dataSub: { fontSize: 11, color: FIN_COLORS.muted, marginTop: 2 },
    dataValue: { fontSize: 13, color: FIN_COLORS.text, fontWeight: "600" },
    dataStrong: { fontWeight: "800", color: FIN_COLORS.blue },
    monthRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: FIN_COLORS.white,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        paddingHorizontal: 6,
        paddingVertical: 6,
        marginBottom: 10,
    },
    monthBtn: { padding: 8, borderRadius: 10, backgroundColor: FIN_COLORS.light },
    monthLabel: { fontSize: 15, fontWeight: "700", color: FIN_COLORS.blue },
    chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: FIN_COLORS.border,
        backgroundColor: FIN_COLORS.white,
    },
    chipActive: { backgroundColor: FIN_COLORS.blue, borderColor: FIN_COLORS.blue },
    chipText: { fontSize: 12, fontWeight: "600", color: FIN_COLORS.blue },
    chipTextActive: { color: FIN_COLORS.white },
    note: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6,
        backgroundColor: FIN_COLORS.light,
        borderRadius: 10,
        padding: 10,
        marginTop: 8,
    },
    noteWarn: { backgroundColor: FIN_COLORS.warnBg },
    noteText: { flex: 1, fontSize: 11, color: FIN_COLORS.muted, lineHeight: 16 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
    badgeText: { fontSize: 10, fontWeight: "700" },
});
