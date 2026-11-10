import {
    useAircraftOperationsConfig,
    useDeleteOperationalExpense,
    useDeleteOperationalFlight,
    useOperationalExpenses,
    useOperationalFlights,
    useRegisterPayablePayment,
    useSaveAircraftOperationsConfig,
    useSaveOperationalExpense,
    useSaveOperationalFlight,
    useUndoPayablePayment,
} from "@/hooks/useAircraftOperations";
import { AircraftSpecsDoc } from "@/hooks/useOwnerAircrafts";
import {
    AircraftOperationsConfig,
    GioSectionView,
    OperationalExpenseDoc,
    OperationalFlightDoc,
    PayableItem,
    PayablePaymentInput,
} from "@/types/aircraft-operations";
import {
    calcFlightFinancials,
    computeAccountsPayable,
    computeMonthPendingPaymentUsd,
    computeMonthFuelPayments,
    computeMonthStats,
    computeOverhaulFund,
    computeYearStats,
    formatAmt,
    formatGsFromUsd,
    formatHours,
    formatIsoShortDayMonth,
    formatIsoToDmy,
    formatMonthLabel,
    formatSignedUsd,
    formatUsd,
    generateOperationalReportPdf,
    getDemoZpBocData,
    getExpenseAmountUsd,
    getExpenseDueDate,
    getExpensePaymentStatus,
    getHourlyContributionCfg,
    getMonthlyFixedCostsUsd,
    getMonthKey,
    getTodayIso,
    isMaintenanceExpense,
    MES_NAMES_LOWER,
    num,
    shiftMonthKey,
} from "@/utils/aircraft-operations-calc";
import { confirmAction } from "@/utils/dialogs";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Toast from "react-native-toast-message";
import { AccountsPayablePanel } from "./accounts-payable-panel";
import { BreakEvenGauge } from "./break-even-gauge";
import { OperationalExpenseModal } from "./operational-expense-modal";
import { OperationalFlightModal } from "./operational-flight-modal";
import { OperationsSettingsPanel } from "./operations-settings-panel";
import { PayablePaymentModal } from "./payable-payment-modal";
import { PhotoLightboxModal } from "./photo-lightbox-modal";

interface OwnerOperationalControlViewProps {
    /** Propietario por defecto. Si la aeronave trae su propio ownerId (ej. vista de la encargada), se usa ese. */
    ownerUid: string;
    ownerDisplayName: string;
    aircrafts: AircraftSpecsDoc[];
    initialAircraftId?: string;
}

interface SelectableAircraftOption {
    id: string;
    registration: string;
    model: string;
    ownerId?: string;
}

export function OwnerOperationalControlView({
    ownerUid: defaultOwnerUid,
    ownerDisplayName,
    aircrafts,
    initialAircraftId,
}: OwnerOperationalControlViewProps) {
    // Construir lista de aeronaves asegurando que ZP-BOC (Cessna 414) esté siempre disponible
    const aircraftOptions: SelectableAircraftOption[] = useMemo(() => {
        const list: SelectableAircraftOption[] = aircrafts.map((a) => ({
            id: a.id,
            registration: a.basic_specs.registration,
            model: a.basic_specs.model,
            ownerId: a.ownerId,
        }));

        const hasZpBoc = list.some(
            (a) =>
                a.registration.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "ZPBOC"
        );

        if (!hasZpBoc) {
            list.unshift({
                id: "zp-boc-default",
                registration: "ZP-BOC",
                model: "Cessna 414",
            });
        }

        return list;
    }, [aircrafts]);

    const [selectedAircraftId, setSelectedAircraftId] = useState<string>(
        initialAircraftId && initialAircraftId !== "all"
            ? initialAircraftId
            : aircraftOptions[0]?.id || "zp-boc-default"
    );

    useEffect(() => {
        if (initialAircraftId && initialAircraftId !== "all") {
            setSelectedAircraftId(initialAircraftId);
        }
    }, [initialAircraftId]);

    const currentAircraft = useMemo(() => {
        return (
            aircraftOptions.find((a) => a.id === selectedAircraftId) ||
            aircraftOptions[0] || {
                id: "zp-boc-default",
                registration: "ZP-BOC",
                model: "Cessna 414",
            }
        );
    }, [aircraftOptions, selectedAircraftId]);

    // Los registros de GIO pertenecen siempre al dueño de la aeronave seleccionada.
    const ownerUid = currentAircraft.ownerId || defaultOwnerUid;

    // Vista actual: "M" (Mes), "Y" (Año) o "P" (Cuentas por pagar)
    const [view, setView] = useState<GioSectionView>("M");
    const [curMonth, setCurMonth] = useState<string>(() =>
        getTodayIso().slice(0, 7)
    );
    const [curYear, setCurYear] = useState<string>(() =>
        getTodayIso().slice(0, 4)
    );
    const [hasAutoPositionedMonth, setHasAutoPositionedMonth] = useState(false);

    // Toggle opcional de datos demostrativos cuando aún no hay vuelos cargados en Firestore
    const [showDemoIfEmpty, setShowDemoIfEmpty] = useState(false);

    // Estado de modales
    const [flightModalVisible, setFlightModalVisible] = useState(false);
    const [editingFlight, setEditingFlight] =
        useState<OperationalFlightDoc | null>(null);

    const [expenseModalVisible, setExpenseModalVisible] = useState(false);
    const [editingExpense, setEditingExpense] =
        useState<OperationalExpenseDoc | null>(null);

    const [lightboxUri, setLightboxUri] = useState<string | null>(null);
    const [lightboxCaption, setLightboxCaption] = useState<string | undefined>(undefined);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    // Cuentas por pagar: ítem al que se le registra el pago y el que se está deshaciendo
    const [payingItem, setPayingItem] = useState<PayableItem | null>(null);
    const [undoingKey, setUndoingKey] = useState<string | null>(null);

    // Consultas a Firestore mediante TanStack Query
    const { data: config, isLoading: isLoadingConfig } =
        useAircraftOperationsConfig(
            ownerUid,
            currentAircraft.id,
            currentAircraft.registration,
            currentAircraft.model
        );

    const { data: firestoreFlights = [], isLoading: isLoadingFlights } =
        useOperationalFlights(ownerUid, currentAircraft.id);

    const { data: firestoreExpenses = [], isLoading: isLoadingExpenses } =
        useOperationalExpenses(ownerUid, currentAircraft.id);

    // Mutaciones de Firestore
    const saveConfigMutation = useSaveAircraftOperationsConfig();
    const saveFlightMutation = useSaveOperationalFlight();
    const deleteFlightMutation = useDeleteOperationalFlight();
    const saveExpenseMutation = useSaveOperationalExpense();
    const deleteExpenseMutation = useDeleteOperationalExpense();
    const registerPaymentMutation = useRegisterPayablePayment();
    const undoPaymentMutation = useUndoPayablePayment();

    // Datos demostrativos opcionales
    const demoBundle = useMemo(
        () =>
            getDemoZpBocData(
                ownerUid,
                currentAircraft.id,
                currentAircraft.registration,
                currentAircraft.model
            ),
        [ownerUid, currentAircraft]
    );

    const activeFlights = useMemo(() => {
        if (firestoreFlights.length > 0) return firestoreFlights;
        return showDemoIfEmpty ? demoBundle.flights : [];
    }, [firestoreFlights, showDemoIfEmpty, demoBundle]);

    const activeExpenses = useMemo(() => {
        if (firestoreExpenses.length > 0 || firestoreFlights.length > 0) {
            return firestoreExpenses;
        }
        return showDemoIfEmpty ? demoBundle.expenses : [];
    }, [firestoreExpenses, firestoreFlights.length, showDemoIfEmpty, demoBundle]);

    // Posicionar automáticamente en el último mes con actividad al arrancar (igual que el artefacto)
    useEffect(() => {
        if (hasAutoPositionedMonth || activeFlights.length === 0 || !config) return;
        const months = activeFlights
            .map((v) => getMonthKey(v.fecha))
            .filter(Boolean)
            .sort();
        if (months.length > 0) {
            const last = months[months.length - 1];
            const now = getTodayIso().slice(0, 7);
            const nowActive = computeMonthStats(
                now,
                activeFlights,
                activeExpenses,
                config
            ).activo;
            const chosen = last > now ? last : nowActive ? now : last;
            setCurMonth(chosen);
            setCurYear(chosen.slice(0, 4));
            setHasAutoPositionedMonth(true);
        }
    }, [activeFlights, activeExpenses, config, hasAutoPositionedMonth]);

    // Clientes únicos para autocompletado en el modal de vuelo
    const existingClients = useMemo(() => {
        const seen = new Set<string>();
        activeFlights.forEach((f) => {
            if (f.cliente && f.cliente.trim()) {
                seen.add(f.cliente.trim());
            }
        });
        return Array.from(seen);
    }, [activeFlights]);

    // Estadísticas del Mes seleccionado
    const monthStats = useMemo(() => {
        if (!config) return null;
        return computeMonthStats(curMonth, activeFlights, activeExpenses, config);
    }, [curMonth, activeFlights, activeExpenses, config]);

    // Pagos de combustible que vencen en el mes seleccionado
    const fuelPayments = useMemo(() => {
        if (!config) {
            return {
                paymentsDueInMonth: [],
                totalMonthFuelUsd: 0,
                futurePendingFuelUsd: 0,
            };
        }
        return computeMonthFuelPayments(curMonth, activeFlights, config);
    }, [curMonth, activeFlights, config]);

    // Estadísticas del Año seleccionado
    const yearBundle = useMemo(() => {
        if (!config) return null;
        return computeYearStats(curYear, activeFlights, activeExpenses, config);
    }, [curYear, activeFlights, activeExpenses, config]);

    // Fondo acumulado de mantenimiento (Overhaul)
    const overhaulFund = useMemo(() => {
        if (!config) return { ap: 0, us: 0, sa: 0 };
        return computeOverhaulFund(activeFlights, activeExpenses, config);
    }, [activeFlights, activeExpenses, config]);

    // Cuentas por pagar (solo seguimiento de pagos; el resultado sigue siendo por devengado)
    const payablesSummary = useMemo(() => {
        if (!config) return null;
        return computeAccountsPayable(curMonth, activeFlights, activeExpenses, config);
    }, [curMonth, activeFlights, activeExpenses, config]);

    const monthPendingPaymentUsd = useMemo(() => {
        if (!config) return 0;
        return computeMonthPendingPaymentUsd(curMonth, activeFlights, activeExpenses, config);
    }, [curMonth, activeFlights, activeExpenses, config]);

    const isLoading = isLoadingConfig || isLoadingFlights || isLoadingExpenses;

    // Handlers de guardado / borrado
    const handleSaveFlight = async (flightDoc: OperationalFlightDoc) => {
        try {
            await saveFlightMutation.mutateAsync(flightDoc);
            const mKey = getMonthKey(flightDoc.fecha);
            if (mKey) {
                setCurMonth(mKey);
                setCurYear(mKey.slice(0, 4));
            }
            setFlightModalVisible(false);
            setEditingFlight(null);
            Toast.show({
                type: "success",
                text1: editingFlight ? "Cambios guardados" : "Vuelo guardado",
                text2: `${flightDoc.cliente || "Vuelo"} · ${formatHours(flightDoc.horas)}`,
            });
        } catch (err: any) {
            Alert.alert(
                "Error al guardar",
                err.message || "No se pudo guardar el vuelo. Reintentá."
            );
        }
    };

    const handleDeleteFlight = async (flightId: string) => {
        try {
            await deleteFlightMutation.mutateAsync({
                flightId,
                ownerId: ownerUid,
            });
            setFlightModalVisible(false);
            setEditingFlight(null);
            Toast.show({
                type: "info",
                text1: "Vuelo eliminado",
            });
        } catch (err: any) {
            Alert.alert(
                "Error",
                err.message || "No se pudo eliminar el vuelo."
            );
        }
    };

    const handleSaveExpense = async (expenseDoc: OperationalExpenseDoc) => {
        try {
            await saveExpenseMutation.mutateAsync(expenseDoc);
            const mKey = getMonthKey(expenseDoc.fecha);
            if (mKey) {
                setCurMonth(mKey);
                setCurYear(mKey.slice(0, 4));
            }
            setExpenseModalVisible(false);
            setEditingExpense(null);
            Toast.show({
                type: "success",
                text1: "Gasto guardado",
                text2: expenseDoc.concepto,
            });
        } catch (err: any) {
            Alert.alert(
                "Error al guardar",
                err.message || "No se pudo guardar el gasto."
            );
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        try {
            await deleteExpenseMutation.mutateAsync({
                expenseId,
                ownerId: ownerUid,
            });
            setExpenseModalVisible(false);
            setEditingExpense(null);
            Toast.show({
                type: "info",
                text1: "Gasto eliminado",
            });
        } catch (err: any) {
            Alert.alert("Error", err.message || "No se pudo eliminar el gasto.");
        }
    };

    const handleSaveConfig = async (updatedConfig: AircraftOperationsConfig) => {
        try {
            await saveConfigMutation.mutateAsync(updatedConfig);
            Toast.show({
                type: "success",
                text1: "Ajustes guardados",
                text2: `Parámetros actualizados para ${updatedConfig.aircraftRegistration}.`,
            });
        } catch (err: any) {
            Alert.alert(
                "Error",
                err.message || "No se pudieron guardar los ajustes."
            );
        }
    };

    const openLightbox = (uri: string, caption?: string) => {
        setLightboxCaption(caption);
        setLightboxUri(uri);
    };

    const isDemoItem = (item: PayableItem) => item.sourceId.startsWith("demo-");

    const handleOpenPayableItem = (item: PayableItem) => {
        if (item.expense) {
            setEditingExpense(item.expense);
            setExpenseModalVisible(true);
        } else if (item.flight) {
            setEditingFlight(item.flight);
            setFlightModalVisible(true);
        }
    };

    const handleRequestPayment = (item: PayableItem) => {
        if (isDemoItem(item)) {
            Toast.show({
                type: "info",
                text1: "Datos de ejemplo",
                text2: "Los pagos se registran sobre vuelos y gastos reales.",
            });
            return;
        }
        setPayingItem(item);
    };

    const handleConfirmPayment = async (input: PayablePaymentInput) => {
        if (!payingItem) return;
        try {
            await registerPaymentMutation.mutateAsync({ item: payingItem, input });
            const mKey = getMonthKey(input.fechaPago);
            if (mKey) setCurMonth(mKey);
            Toast.show({
                type: "success",
                text1: "Pago registrado",
                text2: `${payingItem.proveedor || payingItem.concepto} · ${formatUsd(payingItem.amountUsd)}`,
            });
            setPayingItem(null);
        } catch (err: any) {
            Alert.alert(
                "Error al registrar el pago",
                err?.message || "No se pudo registrar el pago. Reintentá."
            );
        }
    };

    const handleUndoPayment = async (item: PayableItem) => {
        if (isDemoItem(item)) {
            Toast.show({ type: "info", text1: "Datos de ejemplo" });
            return;
        }
        const ok = await confirmAction({
            title: item.pagoAsumido ? "¿Marcar como no pagado?" : "¿Deshacer el pago?",
            message: item.pagoAsumido
                ? `«${item.concepto}» vuelve a quedar pendiente de pago.`
                : `«${item.concepto}» vuelve a quedar pendiente. Se borran la fecha, el medio, la foto del recibo y las notas del pago.`,
            confirmText: item.pagoAsumido ? "Marcar pendiente" : "Deshacer pago",
            destructive: true,
        });
        if (!ok) return;
        try {
            setUndoingKey(item.key);
            await undoPaymentMutation.mutateAsync(item);
            Toast.show({ type: "info", text1: "Pago deshecho", text2: item.concepto });
        } catch (err: any) {
            Alert.alert("Error", err?.message || "No se pudo deshacer el pago.");
        } finally {
            setUndoingKey(null);
        }
    };

    const handleExportCurrentReportPdf = async () => {
        if (!config || !monthStats || !yearBundle) return;
        try {
            setIsExportingPdf(true);
            const isMonth = view !== "Y";
            const label = isMonth ? formatMonthLabel(curMonth) : `Año ${curYear}`;
            const targetStats = isMonth ? monthStats : yearBundle.yearStats;

            await generateOperationalReportPdf(
                label,
                targetStats,
                overhaulFund,
                config,
                ownerDisplayName
            );
        } catch (err: any) {
            Alert.alert(
                "Error al exportar PDF",
                err.message || "No se pudo generar el reporte PDF."
            );
        } finally {
            setIsExportingPdf(false);
        }
    };

    if (isLoading || !config || !monthStats || !yearBundle || !payablesSummary) {
        return (
            <View style={styles.loadingWrap}>
                <View style={styles.verdictEyebrowRow}>
                    <View style={styles.blueDotSquare} />
                    <Text style={styles.verdictEyebrowText}>CARGANDO</Text>
                </View>
                <ActivityIndicator
                    size="small"
                    color="#1540C9"
                    style={{ marginVertical: 14, alignSelf: "flex-start" }}
                />
                <Text style={styles.verdictNarrative}>
                    Buscando los vuelos cargados.
                </Text>
            </View>
        );
    }

    // Textos de veredicto mensual (idénticos al artefacto)
    const defaultNeededHours =
        getHourlyContributionCfg(config) > 0
            ? getMonthlyFixedCostsUsd(config) / getHourlyContributionCfg(config)
            : null;

    const monthExcessHours =
        monthStats.necesarias !== null
            ? Math.max(0, monthStats.horas - monthStats.necesarias)
            : 0;

    // Partes del desglose anual ("En qué se fue la plata")
    const yearStats = yearBundle.yearStats;
    const annualBreakdownParts = [
        { label: "Combustible", value: yearStats.fuel },
        { label: "Piloto", value: yearStats.piloto },
        { label: "Tasas y planes de vuelo", value: yearStats.tasas },
        { label: "Reserva de mantenimiento", value: yearStats.reserva },
        { label: "Gastos fijos", value: yearStats.fijos },
        ...(yearStats.otros > 0
            ? [{ label: "Otros gastos", value: yearStats.otros }]
            : []),
    ];
    const maxBreakdownValue = Math.max(
        1,
        ...annualBreakdownParts.map((p) => p.value)
    );

    return (
        <View style={styles.mainWrapper}>
            {/* CABECERA IDENTIDAD DE AERONAVE + TABS MES / AÑO */}
            <View style={styles.artifactTopCard}>
                <View style={styles.aircraftHeaderRow}>
                    <View style={styles.aircraftTitleGroup}>
                        <Text style={styles.registrationCode}>
                            {currentAircraft.registration}
                        </Text>
                        <Text style={styles.aircraftModelLabel}>
                            {currentAircraft.model}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleExportCurrentReportPdf}
                        disabled={isExportingPdf}
                        style={styles.pdfBtn}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name="document-text-outline"
                            size={15}
                            color="#1540C9"
                        />
                        <Text style={styles.pdfBtnText}>
                            {isExportingPdf ? "Generando…" : "PDF"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Si el propietario tiene más de una aeronave, selector rápido */}
                {aircraftOptions.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.aircraftSelectorScroll}
                    >
                        {aircraftOptions.map((opt) => {
                            const isSelected = opt.id === currentAircraft.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() => {
                                        setSelectedAircraftId(opt.id);
                                        setHasAutoPositionedMonth(false);
                                    }}
                                    style={[
                                        styles.aircraftPill,
                                        isSelected ? styles.aircraftPillActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.aircraftPillText,
                                            isSelected
                                                ? styles.aircraftPillTextActive
                                                : null,
                                        ]}
                                    >
                                        {opt.registration} · {opt.model}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Selector excluyente: Mes | Año */}
                <View style={styles.periodTabsContainer}>
                    <TouchableOpacity
                        onPress={() => setView("M")}
                        style={[
                            styles.periodTabButton,
                            view === "M" ? styles.periodTabButtonActive : null,
                        ]}
                        activeOpacity={0.85}
                    >
                        <Text
                            style={[
                                styles.periodTabText,
                                view === "M" ? styles.periodTabTextActive : null,
                            ]}
                        >
                            Mes
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setView("Y")}
                        style={[
                            styles.periodTabButton,
                            view === "Y" ? styles.periodTabButtonActive : null,
                        ]}
                        activeOpacity={0.85}
                    >
                        <Text
                            style={[
                                styles.periodTabText,
                                view === "Y" ? styles.periodTabTextActive : null,
                            ]}
                        >
                            Año
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setView("P")}
                        style={[
                            styles.periodTabButton,
                            view === "P" ? styles.periodTabButtonActive : null,
                        ]}
                        activeOpacity={0.85}
                    >
                        <Text
                            style={[
                                styles.periodTabText,
                                view === "P" ? styles.periodTabTextActive : null,
                            ]}
                            numberOfLines={1}
                        >
                            Por pagar
                        </Text>
                        {payablesSummary.cantidadVencidos > 0 && (
                            <View style={styles.tabOverdueDot} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Switch opcional para previsualizar datos de ejemplo si Firestore está vacío */}
                {firestoreFlights.length === 0 && firestoreExpenses.length === 0 && (
                    <View style={styles.demoBanner}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.demoBannerTitle}>
                                Todavía no cargaste vuelos reales en la nube
                            </Text>
                            <Text style={styles.demoBannerSub}>
                                Activá la simulación para ver un ejemplo de operación de{" "}
                                {currentAircraft.registration} o tocá «+ Cargar un vuelo».
                            </Text>
                        </View>
                        <Switch
                            value={showDemoIfEmpty}
                            onValueChange={setShowDemoIfEmpty}
                            trackColor={{ false: "#CBD5E1", true: "#1540C9" }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                )}
            </View>

            {/* ================================================================= */}
            {/* VISTA MENSUAL ("M")                                               */}
            {/* ================================================================= */}
            {view === "M" && (
                <View style={styles.sectionBody}>
                    {/* Navegador de Mes */}
                    <View style={styles.periodNavRow}>
                        <TouchableOpacity
                            onPress={() => setCurMonth((m) => shiftMonthKey(m, -1))}
                            style={styles.periodNavArrow}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.periodNavArrowText}>‹</Text>
                        </TouchableOpacity>

                        <Text style={styles.periodNavLabel}>
                            {formatMonthLabel(curMonth)}
                        </Text>

                        <TouchableOpacity
                            onPress={() => setCurMonth((m) => shiftMonthKey(m, 1))}
                            style={styles.periodNavArrow}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.periodNavArrowText}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Veredicto del Mes */}
                    <View style={styles.verdictEyebrowRow}>
                        <View style={styles.blueDotSquare} />
                        <Text style={styles.verdictEyebrowText}>
                            {!monthStats.activo
                                ? "SIN VUELOS CARGADOS"
                                : `RESULTADO DE ${formatMonthLabel(curMonth).toUpperCase()}`}
                        </Text>
                    </View>

                    {!monthStats.activo ? (
                        <>
                            <Text style={styles.verdictNoneText}>Sin movimientos</Text>
                            <Text style={styles.verdictNarrative}>
                                {defaultNeededHours
                                    ? `Todavía no hay vuelos en este mes. Los gastos fijos corren igual: hacen falta unas ${formatHours(defaultNeededHours)} de vuelo para emparejarlos.`
                                    : "Todavía no hay vuelos en este mes. Los gastos fijos corren igual, se vuele o no se vuele."}
                            </Text>
                        </>
                    ) : monthStats.resultado >= 0 ? (
                        <>
                            <View style={styles.verdictMainRow}>
                                <Text style={styles.verdictPrefixLabel}>GANANCIAS:</Text>
                                <Text style={[styles.verdictBigNumber, styles.posText]}>
                                    {formatUsd(monthStats.resultado)}
                                </Text>
                            </View>
                            <Text style={styles.verdictGsSub}>
                                {formatGsFromUsd(monthStats.resultado, config)}
                            </Text>

                            <View style={[styles.statusPill, styles.statusPillOk]}>
                                <View style={[styles.statusPillDot, styles.posBgDot]} />
                                <Text style={[styles.statusPillText, styles.posText]}>
                                    {monthExcessHours > 0.05
                                        ? `${formatHours(monthExcessHours)} por encima del mínimo`
                                        : "Justo en el punto de equilibrio"}
                                </Text>
                            </View>

                            <Text style={styles.verdictNarrative}>
                                Se volaron {formatHours(monthStats.horas)} en{" "}
                                {monthStats.vuelos}{" "}
                                {monthStats.vuelos === 1 ? "vuelo" : "vuelos"}
                                {monthExcessHours > 0.05
                                    ? `. Son ${formatHours(monthExcessHours)} por encima del mínimo, y esas horas de más son ganancia limpia.`
                                    : ". Justo en el límite."}
                            </Text>
                        </>
                    ) : (
                        <>
                            <View style={styles.verdictMainRow}>
                                <Text style={styles.verdictPrefixLabel}>PÉRDIDAS:</Text>
                                <Text style={[styles.verdictBigNumber, styles.negText]}>
                                    {formatUsd(monthStats.resultado)}
                                </Text>
                            </View>
                            <Text style={styles.verdictGsSub}>
                                {formatGsFromUsd(monthStats.resultado, config)}
                            </Text>

                            <View style={[styles.statusPill, styles.statusPillBad]}>
                                <View style={[styles.statusPillDot, styles.negBgDot]} />
                                <Text style={[styles.statusPillText, styles.negText]}>
                                    {monthStats.necesarias !== null
                                        ? `Faltaron ${formatHours(monthStats.necesarias - monthStats.horas)} de vuelo`
                                        : "La tarifa no cubre el costo variable"}
                                </Text>
                            </View>

                            <Text style={styles.verdictNarrative}>
                                {monthStats.necesarias !== null
                                    ? `Se volaron ${formatHours(monthStats.horas)} y hacían falta ${formatHours(monthStats.necesarias)}. Faltaron ${formatHours(monthStats.necesarias - monthStats.horas)}.`
                                    : "Con lo que se cobró, cada hora no llega a cubrir ni su combustible, piloto y reserva. Revisá la tarifa en Ajustes."}
                            </Text>
                        </>
                    )}

                    {/* Medidor de Punto de Equilibrio */}
                    <BreakEvenGauge stats={monthStats} flownLabelPrefix="Voladas" />

                    {/* Tres Cifras Clave: Cobramos | Gastamos | Quedó */}
                    <View style={styles.row3Grid}>
                        <View style={styles.row3Col}>
                            <Text style={styles.row3Label}>COBRAMOS</Text>
                            <Text
                                style={styles.row3Value}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {formatUsd(monthStats.ingreso)}
                            </Text>
                            <Text style={styles.row3Gs}>
                                {formatGsFromUsd(monthStats.ingreso, config)}
                            </Text>
                        </View>

                        <View style={[styles.row3Col, styles.row3ColBorder]}>
                            <Text style={styles.row3Label}>GASTAMOS</Text>
                            <Text
                                style={styles.row3Value}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {formatUsd(monthStats.costoTotal)}
                            </Text>
                            <Text style={styles.row3Gs}>
                                {formatGsFromUsd(monthStats.costoTotal, config)}
                            </Text>
                        </View>

                        <View style={[styles.row3Col, styles.row3ColBorder]}>
                            <Text style={styles.row3Label}>QUEDÓ</Text>
                            <Text
                                style={[
                                    styles.row3Value,
                                    monthStats.resultado >= 0
                                        ? styles.posText
                                        : styles.negText,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {formatUsd(monthStats.resultado)}
                            </Text>
                            <Text style={styles.row3Gs}>
                                {formatGsFromUsd(monthStats.resultado, config)}
                            </Text>
                        </View>
                    </View>

                    {/* Indicador: pendiente de pago de las compras del mes (no cambia el resultado) */}
                    {monthPendingPaymentUsd > 0.5 && (
                        <TouchableOpacity
                            onPress={() => setView("P")}
                            style={styles.pendingPayRow}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="time-outline" size={16} color="#1540C9" />
                            <Text style={styles.pendingPayText}>
                                Pendiente de pago:{" "}
                                <Text style={styles.boldInk}>
                                    USD {formatAmt(monthPendingPaymentUsd)}
                                </Text>{" "}
                                ({formatGsFromUsd(monthPendingPaymentUsd, config)})
                            </Text>
                            <Text style={styles.pendingPayLink}>Ver ›</Text>
                        </TouchableOpacity>
                    )}

                    {/* Botón Principal: + Cargar un vuelo */}
                    <TouchableOpacity
                        onPress={() => {
                            setEditingFlight(null);
                            setFlightModalVisible(true);
                        }}
                        style={styles.primaryAddButton}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryAddButtonPlus}>+</Text>
                        <Text style={styles.primaryAddButtonText}>
                            Cargar un vuelo
                        </Text>
                    </TouchableOpacity>

                    {/* Lista de Vuelos del Mes */}
                    <Text style={styles.listSectionHeader}>VUELOS DEL MES</Text>
                    <View style={styles.listContainer}>
                        {monthStats.list.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyBoxTitle}>
                                    Todavía no hay vuelos en {formatMonthLabel(curMonth)}
                                </Text>
                                <Text style={styles.emptyBoxSub}>
                                    Tocá «Cargar un vuelo» y poné la fecha, el cliente, las
                                    horas y cuánto se cobró.
                                </Text>
                            </View>
                        ) : (
                            monthStats.list
                                .slice()
                                .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                                .map((v) => {
                                    const k = calcFlightFinancials(v, config);
                                    const isPositive = k.resultado >= 0;
                                    return (
                                        <TouchableOpacity
                                            key={v.id}
                                            onPress={() => {
                                                setEditingFlight(v);
                                                setFlightModalVisible(true);
                                            }}
                                            style={styles.itemRow}
                                            activeOpacity={0.7}
                                        >
                                            <View
                                                style={[
                                                    styles.itemDot,
                                                    isPositive
                                                        ? styles.posBgDot
                                                        : styles.negBgDot,
                                                ]}
                                            />
                                            <View style={styles.itemMiddle}>
                                                <Text
                                                    style={styles.itemTitle}
                                                    numberOfLines={1}
                                                >
                                                    {v.cliente || "Sin cliente"}
                                                </Text>
                                                <Text
                                                    style={styles.itemSub}
                                                    numberOfLines={1}
                                                >
                                                    {formatIsoShortDayMonth(v.fecha)} ·{" "}
                                                    {formatHours(k.horas)} ·{" "}
                                                    {v.ruta ? v.ruta : formatUsd(k.ingreso)}
                                                </Text>
                                            </View>
                                            <View style={styles.itemRight}>
                                                <Text
                                                    style={[
                                                        styles.itemRightAmount,
                                                        isPositive
                                                            ? styles.posText
                                                            : styles.negText,
                                                    ]}
                                                >
                                                    {formatSignedUsd(k.resultado)}
                                                </Text>
                                                {v.cobrado === false ? (
                                                    <Text style={styles.itemTag}>
                                                        SIN COBRAR
                                                    </Text>
                                                ) : v.fotoUrl ? (
                                                    <Text style={styles.itemTag}>CON FOTO</Text>
                                                ) : null}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                        )}
                    </View>

                    {/* Pagos de Combustible que vencen en el mes mostrado */}
                    {fuelPayments.paymentsDueInMonth.length > 0 && (
                        <View>
                            <Text style={styles.listSectionHeader}>
                                PAGOS DE COMBUSTIBLE
                            </Text>
                            <View style={styles.listContainer}>
                                {fuelPayments.paymentsDueInMonth.map((p) => (
                                    <TouchableOpacity
                                        key={`${p.flight.id}-fuel`}
                                        onPress={() => {
                                            setEditingFlight(p.flight);
                                            setFlightModalVisible(true);
                                        }}
                                        style={styles.itemRow}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.itemDot,
                                                p.isCredit
                                                    ? styles.blueBgDot
                                                    : styles.negBgDot,
                                            ]}
                                        />
                                        <View style={styles.itemMiddle}>
                                            <Text
                                                style={styles.itemTitle}
                                                numberOfLines={1}
                                            >
                                                {formatIsoToDmy(p.dueDate)} ·{" "}
                                                {p.flight.cliente || "Sin cliente"}
                                            </Text>
                                            <Text
                                                style={styles.itemSub}
                                                numberOfLines={1}
                                            >
                                                {p.isCredit
                                                    ? `Vuelo del ${formatIsoToDmy(p.flight.fecha)} · crédito a ${p.creditDays} días`
                                                    : `Vuelo del ${formatIsoToDmy(p.flight.fecha)} · contado`}
                                            </Text>
                                        </View>
                                        <View style={styles.itemRight}>
                                            <Text style={styles.itemRightAmount}>
                                                −${formatAmt(p.amountUsd)}
                                            </Text>
                                            {p.isCredit && (
                                                <Text style={styles.itemTag}>CRÉDITO</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.fuelSummaryMsg}>
                                Este mes salen{" "}
                                <Text style={styles.boldInk}>
                                    ${formatAmt(fuelPayments.totalMonthFuelUsd)}
                                </Text>{" "}
                                ({formatGsFromUsd(fuelPayments.totalMonthFuelUsd, config)})
                                en combustible.
                                {fuelPayments.futurePendingFuelUsd > 0.5 ? (
                                    <>
                                        {" "}
                                        De vuelos ya hechos todavía quedan{" "}
                                        <Text style={styles.boldInk}>
                                            ${formatAmt(fuelPayments.futurePendingFuelUsd)}
                                        </Text>{" "}
                                        por vencer.
                                    </>
                                ) : null}
                            </Text>
                        </View>
                    )}

                    {/* Gastos Sueltos del Mes */}
                    <Text style={styles.listSectionHeader}>GASTOS SUELTOS</Text>
                    <View style={styles.listContainer}>
                        {monthStats.glist.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyBoxSub}>
                                    Mantenimiento, repuestos, trámites. Nada cargado en{" "}
                                    {formatMonthLabel(curMonth)}.
                                </Text>
                            </View>
                        ) : (
                            monthStats.glist
                                .slice()
                                .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                                .map((g) => {
                                    const isMaint = isMaintenanceExpense(g);
                                    const usdVal = getExpenseAmountUsd(g, config);
                                    const isPendingPay =
                                        getExpensePaymentStatus(g) === "pendiente";
                                    const isOverduePay =
                                        isPendingPay && getExpenseDueDate(g) < getTodayIso();
                                    return (
                                        <TouchableOpacity
                                            key={g.id}
                                            onPress={() => {
                                                setEditingExpense(g);
                                                setExpenseModalVisible(true);
                                            }}
                                            style={styles.itemRow}
                                            activeOpacity={0.7}
                                        >
                                            <View
                                                style={[
                                                    styles.itemDot,
                                                    isMaint
                                                        ? styles.blueBgDot
                                                        : styles.negBgDot,
                                                ]}
                                            />
                                            <View style={styles.itemMiddle}>
                                                <Text
                                                    style={styles.itemTitle}
                                                    numberOfLines={1}
                                                >
                                                    {g.concepto || "Gasto"}
                                                </Text>
                                                <Text
                                                    style={styles.itemSub}
                                                    numberOfLines={1}
                                                >
                                                    {formatIsoShortDayMonth(g.fecha)} ·{" "}
                                                    {g.proveedor || "—"}
                                                </Text>
                                            </View>
                                            <View style={styles.itemRight}>
                                                <Text style={styles.itemRightAmount}>
                                                    −${formatAmt(usdVal)}
                                                </Text>
                                                {isPendingPay ? (
                                                    <Text
                                                        style={[
                                                            styles.itemTag,
                                                            isOverduePay ? styles.negText : null,
                                                        ]}
                                                    >
                                                        {isOverduePay ? "VENCIDO" : "A PAGAR"}
                                                    </Text>
                                                ) : isMaint ? (
                                                    <Text style={styles.itemTag}>
                                                        SALE DEL FONDO
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                        )}
                    </View>

                    {/* Botón Secundario: + Cargar un gasto */}
                    <TouchableOpacity
                        onPress={() => {
                            setEditingExpense(null);
                            setExpenseModalVisible(true);
                        }}
                        style={styles.ghostAddButton}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.ghostAddButtonPlus}>+</Text>
                        <Text style={styles.ghostAddButtonText}>
                            Cargar un gasto
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ================================================================= */}
            {/* VISTA ANUAL ("Y")                                                 */}
            {/* ================================================================= */}
            {view === "Y" && (
                <View style={styles.sectionBody}>
                    {/* Navegador de Año */}
                    <View style={styles.periodNavRow}>
                        <TouchableOpacity
                            onPress={() =>
                                setCurYear((y) => String(Number(y) - 1))
                            }
                            style={styles.periodNavArrow}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.periodNavArrowText}>‹</Text>
                        </TouchableOpacity>

                        <Text style={styles.periodNavLabel}>{curYear}</Text>

                        <TouchableOpacity
                            onPress={() =>
                                setCurYear((y) => String(Number(y) + 1))
                            }
                            style={styles.periodNavArrow}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.periodNavArrowText}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Veredicto Anual */}
                    <View style={styles.verdictEyebrowRow}>
                        <View style={styles.blueDotSquare} />
                        <Text style={styles.verdictEyebrowText}>
                            ACUMULADO DE {curYear}
                        </Text>
                    </View>

                    {yearStats.mesesActivos === 0 ? (
                        <>
                            <Text style={styles.verdictNoneText}>Sin movimientos</Text>
                            <Text style={styles.verdictNarrative}>
                                Cuando cargues el primer vuelo de {curYear} aparece acá el
                                acumulado.
                            </Text>
                        </>
                    ) : yearStats.resultado >= 0 ? (
                        <>
                            <View style={styles.verdictMainRow}>
                                <Text style={styles.verdictPrefixLabel}>GANANCIAS:</Text>
                                <Text style={[styles.verdictBigNumber, styles.posText]}>
                                    {formatUsd(yearStats.resultado)}
                                </Text>
                            </View>
                            <Text style={styles.verdictGsSub}>
                                {formatGsFromUsd(yearStats.resultado, config)}
                            </Text>

                            <View style={[styles.statusPill, styles.statusPillOk]}>
                                <View style={[styles.statusPillDot, styles.posBgDot]} />
                                <Text style={[styles.statusPillText, styles.posText]}>
                                    {yearStats.necesarias
                                        ? `${Math.round((yearStats.horas / yearStats.necesarias) * 100)}% de las horas necesarias`
                                        : "Por encima del equilibrio"}
                                </Text>
                            </View>

                            <Text style={styles.verdictNarrative}>
                                {yearStats.vuelos} vuelos en {yearStats.mesesActivos}{" "}
                                {yearStats.mesesActivos === 1 ? "mes" : "meses"} de
                                actividad, {formatHours(yearStats.horas)} en total. Cada hora
                                volada dejó {formatUsd(yearStats.contrib)} después de sus
                                costos variables.
                            </Text>
                        </>
                    ) : (
                        <>
                            <View style={styles.verdictMainRow}>
                                <Text style={styles.verdictPrefixLabel}>PÉRDIDAS:</Text>
                                <Text style={[styles.verdictBigNumber, styles.negText]}>
                                    {formatUsd(yearStats.resultado)}
                                </Text>
                            </View>
                            <Text style={styles.verdictGsSub}>
                                {formatGsFromUsd(yearStats.resultado, config)}
                            </Text>

                            <View style={[styles.statusPill, styles.statusPillBad]}>
                                <View style={[styles.statusPillDot, styles.negBgDot]} />
                                <Text style={[styles.statusPillText, styles.negText]}>
                                    {yearStats.necesarias
                                        ? `${Math.round((yearStats.horas / yearStats.necesarias) * 100)}% de las horas necesarias`
                                        : "Sin cubrir el costo variable"}
                                </Text>
                            </View>

                            <Text style={styles.verdictNarrative}>
                                {yearStats.vuelos} vuelos en {yearStats.mesesActivos}{" "}
                                {yearStats.mesesActivos === 1 ? "mes" : "meses"} de
                                actividad, {formatHours(yearStats.horas)} en total
                                {yearStats.necesarias !== null
                                    ? `, contra las ${formatHours(yearStats.necesarias)} que hacían falta.`
                                    : "."}
                            </Text>
                        </>
                    )}

                    {/* Medidor Anual */}
                    <BreakEvenGauge
                        stats={yearStats}
                        flownLabelPrefix="Voladas en el año"
                    />

                    {/* Tres Cifras del Año: Horas | Vuelos | Cobramos */}
                    <View style={styles.row3Grid}>
                        <View style={styles.row3Col}>
                            <Text style={styles.row3Label}>HORAS</Text>
                            <Text
                                style={styles.row3Value}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {formatHours(yearStats.horas)}
                            </Text>
                        </View>

                        <View style={[styles.row3Col, styles.row3ColBorder]}>
                            <Text style={styles.row3Label}>VUELOS</Text>
                            <Text
                                style={styles.row3Value}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {yearStats.vuelos}
                            </Text>
                        </View>

                        <View style={[styles.row3Col, styles.row3ColBorder]}>
                            <Text style={styles.row3Label}>COBRAMOS</Text>
                            <Text
                                style={styles.row3Value}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {formatUsd(yearStats.ingreso)}
                            </Text>
                            <Text style={styles.row3Gs}>
                                {formatGsFromUsd(yearStats.ingreso, config)}
                            </Text>
                        </View>
                    </View>

                    {/* Desglose: En qué se fue la plata */}
                    <Text style={styles.listSectionHeader}>
                        EN QUÉ SE FUE LA PLATA
                    </Text>
                    <View style={styles.breakdownContainer}>
                        {annualBreakdownParts.map((part) => {
                            const widthPct = Math.max(
                                1,
                                Math.min(100, (part.value / maxBreakdownValue) * 100)
                            );
                            return (
                                <View key={part.label} style={styles.breakdownItem}>
                                    <View style={styles.breakdownTopRow}>
                                        <Text style={styles.breakdownLabel}>
                                            {part.label}
                                        </Text>
                                        <Text style={styles.breakdownValue}>
                                            {formatUsd(part.value)}
                                        </Text>
                                    </View>
                                    <View style={styles.breakdownBarTrack}>
                                        <View
                                            style={[
                                                styles.breakdownBarFill,
                                                { width: `${widthPct}%` },
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}

                        <View style={styles.breakdownTotalRow}>
                            <Text style={styles.breakdownTotalLabel}>
                                Resultado del año
                            </Text>
                            <Text
                                style={[
                                    styles.breakdownTotalValue,
                                    yearStats.resultado >= 0
                                        ? styles.posText
                                        : styles.negText,
                                ]}
                            >
                                {formatUsd(yearStats.resultado)}
                            </Text>
                        </View>
                    </View>

                    {/* Tabla Interactiva: Mes a mes */}
                    <Text style={styles.listSectionHeader}>MES A MES</Text>
                    <View style={styles.monthByMonthContainer}>
                        {yearBundle.monthlyRows.map((row, idx) => {
                            const ms = row.stats;
                            return (
                                <TouchableOpacity
                                    key={row.monthKey}
                                    onPress={() => {
                                        setCurMonth(row.monthKey);
                                        setView("M");
                                    }}
                                    style={styles.monthRowBtn}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.monthRowName}>
                                        {MES_NAMES_LOWER[idx]}
                                    </Text>
                                    <Text style={styles.monthRowHours}>
                                        {ms.activo ? formatHours(ms.horas) : "—"}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.monthRowResult,
                                            !ms.activo
                                                ? styles.monthRowResultOff
                                                : ms.resultado >= 0
                                                  ? styles.posText
                                                  : styles.negText,
                                        ]}
                                    >
                                        {ms.activo
                                            ? formatSignedUsd(ms.resultado)
                                            : "—"}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Fondo de Mantenimiento (Overhaul Reserve) */}
                    <Text style={styles.listSectionHeader}>
                        FONDO DE MANTENIMIENTO
                    </Text>
                    <View style={styles.breakdownContainer}>
                        <View style={styles.fundRow}>
                            <Text style={styles.breakdownLabel}>
                                Apartado por las horas voladas
                            </Text>
                            <Text style={styles.breakdownValue}>
                                {formatUsd(overhaulFund.ap)}
                            </Text>
                        </View>
                        <View style={styles.fundRow}>
                            <Text style={styles.breakdownLabel}>
                                Ya gastado en mantenimiento
                            </Text>
                            <Text style={styles.breakdownValue}>
                                {formatUsd(overhaulFund.us)}
                            </Text>
                        </View>
                        <View style={styles.breakdownTotalRow}>
                            <Text style={styles.breakdownTotalLabel}>
                                Debería estar guardado
                            </Text>
                            <Text
                                style={[
                                    styles.breakdownTotalValue,
                                    overhaulFund.sa >= 0
                                        ? styles.posText
                                        : styles.negText,
                                ]}
                            >
                                {formatUsd(overhaulFund.sa)}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.fuelSummaryMsg}>
                        {overhaulFund.sa >= 0
                            ? `Cada hora volada aporta ${formatUsd(num(config.reservaHora))} a este fondo y las facturas del mecánico salen de acá. Hoy debería haber ${formatUsd(overhaulFund.sa)} guardados para el próximo overhaul.`
                            : `El mantenimiento ya costó ${formatUsd(-overhaulFund.sa)} más de lo que se venía apartando. La reserva por hora está quedando corta: subila en Ajustes.`}
                    </Text>
                </View>
            )}

            {/* ================================================================= */}
            {/* CUENTAS POR PAGAR ("P")                                           */}
            {/* ================================================================= */}
            {view === "P" && (
                <AccountsPayablePanel
                    summary={payablesSummary}
                    config={config}
                    monthKey={curMonth}
                    onShiftMonth={(delta) => setCurMonth((m) => shiftMonthKey(m, delta))}
                    busyKey={undoingKey}
                    onRegisterPayment={handleRequestPayment}
                    onUndoPayment={handleUndoPayment}
                    onOpenPhoto={(uri) => openLightbox(uri, "Tocá en cualquier lugar para cerrar")}
                    onOpenItem={handleOpenPayableItem}
                />
            )}

            {/* DESPLEGABLES INFERIORES: Cómo se calcula + Ajustes de costos y tarifas */}
            <OperationsSettingsPanel
                config={config}
                isSaving={saveConfigMutation.isPending}
                onSaveConfig={handleSaveConfig}
            />

            {/* MODALES */}
            <OperationalFlightModal
                visible={flightModalVisible}
                flight={editingFlight}
                config={config}
                existingClients={existingClients}
                isSaving={
                    saveFlightMutation.isPending ||
                    deleteFlightMutation.isPending
                }
                onClose={() => {
                    setFlightModalVisible(false);
                    setEditingFlight(null);
                }}
                onSave={handleSaveFlight}
                onDelete={editingFlight ? handleDeleteFlight : undefined}
                onOpenLightbox={(uri) => openLightbox(uri)}
            />

            <OperationalExpenseModal
                visible={expenseModalVisible}
                expense={editingExpense}
                config={config}
                isSaving={
                    saveExpenseMutation.isPending ||
                    deleteExpenseMutation.isPending
                }
                onClose={() => {
                    setExpenseModalVisible(false);
                    setEditingExpense(null);
                }}
                onSave={handleSaveExpense}
                onDelete={editingExpense ? handleDeleteExpense : undefined}
                onOpenLightbox={(uri) => openLightbox(uri, "Factura · Tocá en cualquier lugar para cerrar")}
            />

            <PayablePaymentModal
                visible={!!payingItem}
                item={payingItem}
                config={config}
                isSaving={registerPaymentMutation.isPending}
                onClose={() => setPayingItem(null)}
                onConfirm={handleConfirmPayment}
            />

            <PhotoLightboxModal
                visible={!!lightboxUri}
                imageUri={lightboxUri}
                caption={lightboxCaption}
                onClose={() => {
                    setLightboxUri(null);
                    setLightboxCaption(undefined);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    mainWrapper: {
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 32,
        borderWidth: 1,
        borderColor: "#E7EDF5",
        maxWidth: 680,
        width: "100%",
        alignSelf: "center",
    },
    loadingWrap: {
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        padding: 28,
        borderWidth: 1,
        borderColor: "#E7EDF5",
        maxWidth: 680,
        width: "100%",
        alignSelf: "center",
    },
    artifactTopCard: {
        borderBottomWidth: 1,
        borderBottomColor: "#E7EDF5",
        paddingBottom: 16,
    },
    aircraftHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    aircraftTitleGroup: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: 10,
    },
    registrationCode: {
        fontFamily: "monospace",
        fontWeight: "700",
        letterSpacing: 1.4,
        color: "#1540C9",
        fontSize: 15,
    },
    aircraftModelLabel: {
        fontSize: 11,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "#93A3B6",
        fontWeight: "700",
    },
    pdfBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "#EEF3FE",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 99,
    },
    pdfBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1540C9",
    },
    aircraftSelectorScroll: {
        flexDirection: "row",
        gap: 8,
        paddingBottom: 12,
    },
    aircraftPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 99,
        backgroundColor: "#F4F7FC",
        borderWidth: 1,
        borderColor: "#E6ECF6",
    },
    aircraftPillActive: {
        backgroundColor: "#091626",
        borderColor: "#091626",
    },
    aircraftPillText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#52647A",
    },
    aircraftPillTextActive: {
        color: "#FFFFFF",
    },
    periodTabsContainer: {
        flexDirection: "row",
        backgroundColor: "#F4F7FC",
        padding: 4,
        borderRadius: 14,
        gap: 4,
    },
    periodTabButton: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    periodTabButtonActive: {
        backgroundColor: "#1540C9",
    },
    periodTabText: {
        fontSize: 15.5,
        fontWeight: "700",
        color: "#52647A",
    },
    periodTabTextActive: {
        color: "#FFFFFF",
    },
    tabOverdueDot: {
        position: "absolute",
        top: 7,
        right: 9,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: "#BC3324",
    },
    pendingPayRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: "#EEF3FE",
    },
    pendingPayText: {
        flex: 1,
        fontSize: 13.5,
        color: "#52647A",
        lineHeight: 19,
    },
    pendingPayLink: {
        fontSize: 13.5,
        fontWeight: "700",
        color: "#1540C9",
    },
    demoBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#EEF3FE",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 12,
    },
    demoBannerTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#091626",
    },
    demoBannerSub: {
        fontSize: 12,
        color: "#52647A",
        marginTop: 2,
    },
    sectionBody: {
        paddingTop: 6,
    },
    periodNavRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginVertical: 24,
    },
    periodNavArrow: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#F4F7FC",
        alignItems: "center",
        justifyContent: "center",
    },
    periodNavArrowText: {
        fontSize: 20,
        color: "#52647A",
        fontWeight: "600",
        lineHeight: 22,
    },
    periodNavLabel: {
        fontSize: 16.5,
        fontWeight: "700",
        color: "#091626",
        minWidth: 150,
        textAlign: "center",
        textTransform: "capitalize",
    },
    verdictEyebrowRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    blueDotSquare: {
        width: 6,
        height: 6,
        borderRadius: 1.5,
        backgroundColor: "#1540C9",
    },
    verdictEyebrowText: {
        fontSize: 12,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        color: "#52647A",
        fontWeight: "700",
    },
    verdictNoneText: {
        fontSize: 26,
        fontWeight: "600",
        color: "#52647A",
        marginTop: 14,
    },
    verdictMainRow: {
        flexDirection: "row",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 14,
    },
    verdictPrefixLabel: {
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "#52647A",
    },
    verdictBigNumber: {
        fontSize: 44,
        fontWeight: "700",
        letterSpacing: -1,
    },
    verdictGsSub: {
        fontSize: 14.5,
        color: "#93A3B6",
        fontWeight: "600",
        marginTop: 6,
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 7,
        marginTop: 14,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 99,
    },
    statusPillOk: {
        backgroundColor: "#E4F4EC",
    },
    statusPillBad: {
        backgroundColor: "#FCEAE7",
    },
    statusPillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusPillText: {
        fontSize: 12.5,
        fontWeight: "700",
    },
    verdictNarrative: {
        marginTop: 14,
        color: "#52647A",
        fontSize: 15.5,
        lineHeight: 24,
    },
    row3Grid: {
        flexDirection: "row",
        marginTop: 30,
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
    },
    row3Col: {
        flex: 1,
        paddingTop: 16,
        paddingRight: 8,
    },
    row3ColBorder: {
        paddingLeft: 12,
        borderLeftWidth: 1,
        borderLeftColor: "#E7EDF5",
    },
    row3Label: {
        fontSize: 11.5,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: "#52647A",
        fontWeight: "700",
    },
    row3Value: {
        marginTop: 8,
        fontSize: 23,
        fontWeight: "700",
        color: "#091626",
    },
    row3Gs: {
        fontSize: 11.5,
        color: "#52647A",
        fontWeight: "600",
        marginTop: 4,
    },
    primaryAddButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        paddingVertical: 15,
        backgroundColor: "#1540C9",
        borderRadius: 999,
        marginTop: 28,
    },
    primaryAddButtonPlus: {
        fontSize: 19,
        color: "#FFFFFF",
        fontWeight: "400",
        lineHeight: 20,
    },
    primaryAddButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 15.5,
    },
    ghostAddButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        paddingVertical: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#E6ECF6",
        borderRadius: 999,
        marginTop: 14,
    },
    ghostAddButtonPlus: {
        fontSize: 17,
        color: "#1540C9",
        lineHeight: 19,
    },
    ghostAddButtonText: {
        color: "#1540C9",
        fontWeight: "600",
        fontSize: 14,
    },
    listSectionHeader: {
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "#52647A",
        fontWeight: "700",
        marginTop: 38,
        marginBottom: 4,
    },
    listContainer: {
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
        marginTop: 10,
    },
    emptyBox: {
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F5FA",
    },
    emptyBoxTitle: {
        color: "#52647A",
        fontWeight: "600",
        fontSize: 14.5,
        marginBottom: 4,
    },
    emptyBoxSub: {
        color: "#52647A",
        fontSize: 14.5,
        lineHeight: 22,
    },
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F5FA",
    },
    itemDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    itemMiddle: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 15.5,
        fontWeight: "600",
        color: "#091626",
    },
    itemSub: {
        fontFamily: "monospace",
        fontSize: 12,
        color: "#52647A",
        marginTop: 4,
    },
    itemRight: {
        alignItems: "flex-end",
    },
    itemRightAmount: {
        fontSize: 17,
        fontWeight: "700",
        color: "#091626",
    },
    itemTag: {
        fontSize: 10,
        letterSpacing: 0.7,
        textTransform: "uppercase",
        color: "#52647A",
        fontWeight: "700",
        marginTop: 4,
    },
    fuelSummaryMsg: {
        fontSize: 14,
        color: "#52647A",
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#F2F5FA",
        lineHeight: 21,
    },
    boldInk: {
        color: "#091626",
        fontWeight: "700",
    },
    breakdownContainer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
    },
    breakdownItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F5FA",
    },
    breakdownTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 7,
    },
    breakdownLabel: {
        fontSize: 14.5,
        color: "#091626",
    },
    breakdownValue: {
        fontSize: 15.5,
        fontWeight: "700",
        color: "#091626",
    },
    breakdownBarTrack: {
        height: 5,
        borderRadius: 99,
        backgroundColor: "#E6ECF6",
        overflow: "hidden",
    },
    breakdownBarFill: {
        height: 5,
        borderRadius: 99,
        backgroundColor: "#1540C9",
    },
    breakdownTotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 16,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
    },
    breakdownTotalLabel: {
        fontSize: 14.5,
        fontWeight: "600",
        color: "#091626",
    },
    breakdownTotalValue: {
        fontSize: 26,
        fontWeight: "700",
    },
    monthByMonthContainer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#E7EDF5",
    },
    monthRowBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F5FA",
        gap: 12,
    },
    monthRowName: {
        flex: 1,
        fontSize: 15,
        fontWeight: "500",
        color: "#091626",
        textTransform: "capitalize",
    },
    monthRowHours: {
        fontFamily: "monospace",
        fontSize: 12.5,
        color: "#52647A",
        minWidth: 62,
        textAlign: "right",
    },
    monthRowResult: {
        fontSize: 15,
        fontWeight: "700",
        minWidth: 84,
        textAlign: "right",
    },
    monthRowResultOff: {
        color: "#93A3B6",
        fontWeight: "400",
    },
    fundRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F5FA",
    },
    posText: {
        color: "#0A7042",
    },
    negText: {
        color: "#BC3324",
    },
    posBgDot: {
        backgroundColor: "#0A7042",
    },
    negBgDot: {
        backgroundColor: "#BC3324",
    },
    blueBgDot: {
        backgroundColor: "#7BA4FF",
    },
});
