import { LoadingCard } from "@/components/loading-card";
import { OwnerHeader } from "@/components/owner-header";
import { OwnerOperationalControlView } from "@/components/owner-operations/owner-operational-control-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useOwnerAircrafts } from "@/hooks/useOwnerAircrafts";
import { useOwnerReservations } from "@/hooks/useOwnerReservations";
import { AccountingFlightItem } from "@/types/accounting";
import { FinanceModuleTab } from "@/types/aircraft-operations";
import { defaultAircraftSpecs } from "@/types/owner";
import {
    computeMonthlyMetrics,
    generateAndShareMonthlyReportPdf,
    getDemoFlightHistory,
    mapReservationToAccountingItem,
    MONTH_NAMES_ES
} from "@/utils/accounting-data";
import { generateAndShareInvoicePdf } from "@/utils/electronic-invoice";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function OwnerFinancesScreen() {
    const { user, profileData } = useAuth();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ aircraftId?: string }>();

    // Selector de modo principal: "operations" (Control Operativo ZP-BOC / Flota) | "sifen" (Facturación SIFEN)
    const [activeTab, setActiveTab] = useState<FinanceModuleTab>("operations");

    // Current date defaults (Octubre 2026 as per app context)
    const [selectedMonth, setSelectedMonth] = useState(9); // 9 = Octubre (0-indexed)
    const [selectedYear, setSelectedYear] = useState(2026);
    const [selectedAircraftId, setSelectedAircraftId] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [includeDemoData, setIncludeDemoData] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);

    // Fetch owner's aircrafts
    const {
        data: aircrafts = [],
        isLoading: isLoadingAircrafts,
        refetch: refetchAircrafts
    } = useOwnerAircrafts(user?.uid);

    // Fetch owner's reservations from Firestore
    const {
        data: reservations = [],
        isLoading: isLoadingReservations,
        isRefetching,
        refetch: refetchReservations
    } = useOwnerReservations(user?.uid);

    const { data: exchangeRateData } = useExchangeRate();
    const currentExchangeRate = exchangeRateData?.dolar || 7850;

    const isLoading = isLoadingAircrafts || isLoadingReservations;

    // Convert firestore reservations to accounting items
    const firestoreAccountingItems = useMemo(() => {
        return reservations.map(r => mapReservationToAccountingItem(r, currentExchangeRate));
    }, [reservations, currentExchangeRate]);

    // Demo data for historical comparison
    const demoItems = useMemo(() => {
        if (!includeDemoData) return [];
        const ownerAircraftMap = aircrafts.map(a => ({
            id: a.id,
            model: a.basic_specs.model,
            registration: a.basic_specs.registration
        }));
        return getDemoFlightHistory(ownerAircraftMap);
    }, [includeDemoData, aircrafts]);

    // Combined flight list
    const combinedFlightList = useMemo(() => {
        return [...firestoreAccountingItems, ...demoItems];
    }, [firestoreAccountingItems, demoItems]);

    // Compute metrics and filter by month & aircraft
    const { metrics, filteredFlights } = useMemo(() => {
        return computeMonthlyMetrics(
            combinedFlightList,
            selectedMonth,
            selectedYear,
            selectedAircraftId
        );
    }, [combinedFlightList, selectedMonth, selectedYear, selectedAircraftId]);

    // Apply text search & status tabs
    const displayedFlights = useMemo(() => {
        return filteredFlights.filter((flight) => {
            const matchesStatus =
                statusFilter === "all" || flight.paymentStatus === statusFilter;

            if (!matchesStatus) return false;

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase().trim();
            const routeStr = `${flight.route.originIdent} ${flight.route.originCity} ${flight.route.destinationIdent} ${flight.route.destinationCity}`.toLowerCase();
            const clientStr = `${flight.client.name} ${flight.client.company || ""}`.toLowerCase();
            const acStr = `${flight.aircraft.registration} ${flight.aircraft.model}`.toLowerCase();
            const invStr = (flight.invoiceNumber || "").toLowerCase();
            const codeStr = flight.reservationCode.toLowerCase();

            return (
                routeStr.includes(q) ||
                clientStr.includes(q) ||
                acStr.includes(q) ||
                invStr.includes(q) ||
                codeStr.includes(q)
            );
        });
    }, [filteredFlights, statusFilter, searchQuery]);

    // Handle Month Navigation
    const handlePrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(y => y - 1);
        } else {
            setSelectedMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(y => y + 1);
        } else {
            setSelectedMonth(m => m + 1);
        }
    };

    // Export PDF Report
    const handleExportPdf = async () => {
        try {
            setIsExporting(true);
            const ownerDisplayName = profileData?.firstName && profileData?.lastName
                ? `${profileData.firstName} ${profileData.lastName}`
                : user?.email || "Propietario de Aeronave";

            await generateAndShareMonthlyReportPdf(
                metrics,
                displayedFlights,
                ownerDisplayName
            );
            Toast.show({
                type: "success",
                text1: "Reporte Generado",
                text2: `Resumen de ${metrics.monthName} ${metrics.year} listo para compartir.`,
            });
        } catch (error) {
            console.error("Error al exportar reporte PDF:", error);
            Alert.alert("Error", "No se pudo generar el documento PDF del reporte.");
        } finally {
            setIsExporting(false);
        }
    };

    // Open individual flight invoice
    const handleViewInvoice = async (flight: AccountingFlightItem) => {
        try {
            await generateAndShareInvoicePdf({
                id: flight.id,
                aircraftId: flight.aircraft.id,
                fa_flight_id: null,
                price: flight.amountUsd,
                distance_nm: flight.distanceNm,
                cruise_speed_knots: 400,
                trip: {
                    origin_airport_ident: flight.route.originIdent,
                    destination_airport_ident: flight.route.destinationIdent,
                },
                schedule: {
                    roundtrip: flight.route.roundtrip,
                    outbound_flight_departure_time: flight.flightDate,
                    outbound_flight_arrival_time: new Date(flight.flightDate.getTime() + flight.flightHours * 3600000),
                    return_flight_departure_time: null,
                    return_flight_arrival_time: null,
                },
                capacity: { passangers: 4 },
                event_ids: [],
                client_status: "confirmed",
                internal_status: "confirmed",
                pilot_ids: [],
                invoice_number: flight.invoiceNumber,
                invoice_timbrado: flight.invoiceTimbrado,
                invoice_cdc: flight.invoiceCdc,
                paid_at: flight.paymentDate || flight.flightDate,
                payment_method: flight.paymentMethod,
                originAirport: {
                    ident: flight.route.originIdent,
                    name: flight.route.originCity,
                    municipality: flight.route.originCity,
                    type: "medium_airport",
                    latitude_deg: -25.24,
                    longitude_deg: -57.51,
                    elevation_ft: 292,
                    country: "Paraguay",
                    region: "Central",
                    iata_code: "ASU",
                    icao_code: "SGAS",
                    gps_code: "SGAS",
                },
                destinationAirport: {
                    ident: flight.route.destinationIdent,
                    name: flight.route.destinationCity,
                    municipality: flight.route.destinationCity,
                    type: "medium_airport",
                    latitude_deg: -25.45,
                    longitude_deg: -54.67,
                    elevation_ft: 850,
                    country: "Paraguay",
                    region: "Alto Paraná",
                    iata_code: "AGT",
                    icao_code: "SGCO",
                    gps_code: "SGCO",
                },
                aircraftSpecs: {
                    ...defaultAircraftSpecs,
                    ownerId: user?.uid || "",
                    basic_specs: {
                        model: flight.aircraft.model,
                        type: "C25B",
                        registration: flight.aircraft.registration,
                        pax_count: 7,
                    },
                },
            }, flight.client.email);
        } catch (error) {
            console.error("Error al visualizar factura:", error);
            Alert.alert("Error", "No se pudo generar la factura del vuelo.");
        }
    };

    const ownerFullDisplayName =
        profileData?.firstName && profileData?.lastName
            ? `${profileData.firstName} ${profileData.lastName}`
            : user?.email || "Propietario de Aeronave";

    return (
        <ThemedView className="flex-1 bg-brand-light px-4" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <OwnerHeader
                title="GESTIÓN FINANCIERA"
                subtitle={activeTab === "operations" ? "Control de Vuelos y Rentabilidad" : "Facturación Electrónica SIFEN"}
                onMenuPress={() => navigation.openDrawer()}
                iconName={activeTab === "sifen" ? "document-text-outline" : undefined}
                onActionButtonPress={activeTab === "sifen" ? handleExportPdf : undefined}
            />

            {/* Selector Superior de Sub-Módulo */}
            <View style={styles.topModeSwitcher}>
                <TouchableOpacity
                    onPress={() => setActiveTab("operations")}
                    style={[
                        styles.topModeBtn,
                        activeTab === "operations" ? styles.topModeBtnActive : null,
                    ]}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name="speedometer-outline"
                        size={16}
                        color={activeTab === "operations" ? "#FFFFFF" : "#475569"}
                    />
                    <Text
                        style={[
                            styles.topModeBtnText,
                            activeTab === "operations" ? styles.topModeBtnTextActive : null,
                        ]}
                    >
                        Control Operativo y Costos
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab("sifen")}
                    style={[
                        styles.topModeBtn,
                        activeTab === "sifen" ? styles.topModeBtnActive : null,
                    ]}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name="receipt-outline"
                        size={16}
                        color={activeTab === "sifen" ? "#FFFFFF" : "#475569"}
                    />
                    <Text
                        style={[
                            styles.topModeBtnText,
                            activeTab === "sifen" ? styles.topModeBtnTextActive : null,
                        ]}
                    >
                        Facturación SIFEN (App)
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => {
                            refetchAircrafts();
                            refetchReservations();
                        }}
                        tintColor="#0165FF"
                    />
                }
            >
                {activeTab === "operations" ? (
                    <OwnerOperationalControlView
                        ownerUid={user?.uid || ""}
                        ownerDisplayName={ownerFullDisplayName}
                        aircrafts={aircrafts}
                        initialAircraftId={params.aircraftId}
                    />
                ) : (
                    <>
                        {/* Month Navigator Bar */}
                        <View style={styles.monthNavigatorCard}>
                    <TouchableOpacity
                        onPress={handlePrevMonth}
                        style={styles.navArrowButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={20} color="#030436" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setIsMonthPickerVisible(true)}
                        style={styles.monthDisplayButton}
                        activeOpacity={0.8}
                    >
                        <View style={styles.calendarIconWrapper}>
                            <Ionicons name="calendar" size={16} color="#0165FF" />
                        </View>
                        <View style={styles.monthTextContainer}>
                            <ThemedText style={styles.monthText}>
                                {MONTH_NAMES_ES[selectedMonth]} {selectedYear}
                            </ThemedText>
                            <ThemedText style={styles.monthSubText}>
                                Tocar para cambiar de mes
                            </ThemedText>
                        </View>
                        <Ionicons name="chevron-down" size={16} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleNextMonth}
                        style={styles.navArrowButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-forward" size={20} color="#030436" />
                    </TouchableOpacity>
                </View>

                {/* Demo Data Toggle Bar */}
                <View style={styles.demoToggleBar}>
                    <View style={styles.demoTextWrapper}>
                        <Ionicons name="sparkles" size={16} color="#0165FF" />
                        <ThemedText style={styles.demoLabel}>
                            Incluir Vuelos Históricos Demostrativos
                        </ThemedText>
                    </View>
                    <Switch
                        value={includeDemoData}
                        onValueChange={setIncludeDemoData}
                        trackColor={{ false: "#CBD5E1", true: "#0165FF" }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {/* Aircraft Filter Chips (Horizontal) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.aircraftChipsScroll}
                >
                    <TouchableOpacity
                        onPress={() => setSelectedAircraftId("all")}
                        style={[
                            styles.chip,
                            selectedAircraftId === "all" ? styles.chipActive : styles.chipInactive,
                        ]}
                    >
                        <Ionicons
                            name="airplane"
                            size={14}
                            color={selectedAircraftId === "all" ? "#FFFFFF" : "#030436"}
                        />
                        <ThemedText
                            style={[
                                styles.chipText,
                                selectedAircraftId === "all" ? styles.chipTextActive : styles.chipTextInactive,
                            ]}
                        >
                            Todas las Aeronaves
                        </ThemedText>
                    </TouchableOpacity>

                    {aircrafts.map((ac) => {
                        const isSelected = selectedAircraftId === ac.id;
                        return (
                            <TouchableOpacity
                                key={ac.id}
                                onPress={() => setSelectedAircraftId(ac.id)}
                                style={[
                                    styles.chip,
                                    isSelected ? styles.chipActive : styles.chipInactive,
                                ]}
                            >
                                <Ionicons
                                    name="airplane-outline"
                                    size={14}
                                    color={isSelected ? "#FFFFFF" : "#030436"}
                                />
                                <ThemedText
                                    style={[
                                        styles.chipText,
                                        isSelected ? styles.chipTextActive : styles.chipTextInactive,
                                    ]}
                                >
                                    {ac.basic_specs.registration} • {ac.basic_specs.model}
                                </ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {isLoading ? (
                    <LoadingCard message="Calculando métricas contables y consolidando vuelos..." />
                ) : (
                    <>
                        {/* HERO CARD: Monthly Revenue & Tax Breakdown */}
                        <View style={styles.heroCard}>
                            <View style={styles.heroHeader}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <ThemedText style={styles.heroEyebrow} numberOfLines={1}>
                                        TOTAL FACTURADO • {metrics.monthName.toUpperCase()} {metrics.year}
                                    </ThemedText>
                                    <ThemedText
                                        style={styles.heroAmountUsd}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        USD ${metrics.totalRevenueUsd.toLocaleString("en-US")}
                                    </ThemedText>
                                    <ThemedText
                                        style={styles.heroAmountGs}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        ≈ Gs. {metrics.totalRevenueGs.toLocaleString("es-PY")}
                                    </ThemedText>
                                </View>

                                {metrics.revenueChangePercentage !== undefined && (
                                    <View
                                        style={[
                                            styles.variationBadge,
                                            metrics.revenueChangePercentage >= 0
                                                ? styles.variationBadgePositive
                                                : styles.variationBadgeNegative,
                                        ]}
                                    >
                                        <Ionicons
                                            name={metrics.revenueChangePercentage >= 0 ? "trending-up" : "trending-down"}
                                            size={14}
                                            color={metrics.revenueChangePercentage >= 0 ? "#166534" : "#991B1B"}
                                        />
                                        <ThemedText
                                            style={[
                                                styles.variationText,
                                                metrics.revenueChangePercentage >= 0
                                                    ? styles.variationTextPositive
                                                    : styles.variationTextNegative,
                                            ]}
                                        >
                                            {metrics.revenueChangePercentage >= 0 ? `+${metrics.revenueChangePercentage}%` : `${metrics.revenueChangePercentage}%`}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>

                            {/* Sub-breakdown (Neto vs IVA 10% SIFEN DNIT) */}
                            <View style={styles.heroDivider} />

                            <View style={styles.heroTaxGrid}>
                                <View style={styles.heroTaxCol}>
                                    <ThemedText style={styles.heroTaxLabel} numberOfLines={1}>
                                        Base Imponible (Neto)
                                    </ThemedText>
                                    <ThemedText
                                        style={styles.heroTaxValue}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        USD ${metrics.totalNetUsd.toLocaleString("en-US")}
                                    </ThemedText>
                                    <ThemedText
                                        style={styles.heroTaxSub}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        Gs. {metrics.totalNetGs.toLocaleString("es-PY")}
                                    </ThemedText>
                                </View>

                                <View style={styles.heroTaxVerticalLine} />

                                <View style={styles.heroTaxCol}>
                                    <View style={styles.sifenBadgeRow}>
                                        <ThemedText style={styles.heroTaxLabel} numberOfLines={1}>
                                            IVA Débito 10%
                                        </ThemedText>
                                        <View style={styles.sifenTag}>
                                            <ThemedText style={styles.sifenTagText}>DNIT</ThemedText>
                                        </View>
                                    </View>
                                    <ThemedText
                                        style={styles.heroTaxValueIva}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        USD ${metrics.totalIvaUsd.toLocaleString("en-US")}
                                    </ThemedText>
                                    <ThemedText
                                        style={styles.heroTaxSub}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        Gs. {metrics.totalIvaGs.toLocaleString("es-PY")}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>

                        {/* KPI GRID: 4 KEY OPERATIONAL METRICS */}
                        <View style={styles.kpiGrid}>
                            {/* Card 1: Completed Flights */}
                            <View style={styles.kpiCard}>
                                <View style={styles.kpiIconWrapperBlue}>
                                    <MaterialCommunityIcons name="airplane-takeoff" size={20} color="#030436" />
                                </View>
                                <ThemedText
                                    style={styles.kpiNumber}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {metrics.completedFlightsCount}
                                </ThemedText>
                                <ThemedText style={styles.kpiLabel} numberOfLines={1}>
                                    Vuelos Facturados
                                </ThemedText>
                                <ThemedText style={styles.kpiSub} numberOfLines={2}>
                                    {metrics.statusCounts.paid} cobrados • {metrics.statusCounts.pending} pendientes
                                </ThemedText>
                            </View>

                            {/* Card 2: Total Flight Hours */}
                            <View style={styles.kpiCard}>
                                <View style={styles.kpiIconWrapperGold}>
                                    <MaterialCommunityIcons name="timer-sand-complete" size={20} color="#0165FF" />
                                </View>
                                <ThemedText
                                    style={styles.kpiNumber}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {metrics.totalFlightHours} <ThemedText style={styles.kpiUnit}>hrs</ThemedText>
                                </ThemedText>
                                <ThemedText style={styles.kpiLabel} numberOfLines={1}>
                                    Horas Voladas
                                </ThemedText>
                                <ThemedText style={styles.kpiSub} numberOfLines={1}>
                                    En vuelos comerciales
                                </ThemedText>
                            </View>

                            {/* Card 3: Avg Ticket */}
                            <View style={styles.kpiCard}>
                                <View style={styles.kpiIconWrapperGreen}>
                                    <Ionicons name="receipt-outline" size={20} color="#059669" />
                                </View>
                                <ThemedText
                                    style={styles.kpiNumber}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    ${metrics.avgTicketUsd.toLocaleString("en-US")}
                                </ThemedText>
                                <ThemedText style={styles.kpiLabel} numberOfLines={1}>
                                    Ticket Promedio
                                </ThemedText>
                                <ThemedText style={styles.kpiSub} numberOfLines={1}>
                                    Por reserva efectuada
                                </ThemedText>
                            </View>

                            {/* Card 4: Avg Hourly Revenue */}
                            <View style={styles.kpiCard}>
                                <View style={styles.kpiIconWrapperPurple}>
                                    <MaterialCommunityIcons name="speedometer" size={20} color="#7C3AED" />
                                </View>
                                <ThemedText
                                    style={styles.kpiNumber}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    ${metrics.avgPerHourUsd.toLocaleString("en-US")}
                                </ThemedText>
                                <ThemedText style={styles.kpiLabel} numberOfLines={1}>
                                    Ingreso / Hora
                                </ThemedText>
                                <ThemedText style={styles.kpiSub} numberOfLines={1}>
                                    Rendimiento operacional
                                </ThemedText>
                            </View>
                        </View>

                        {/* AIRCRAFT REVENUE SHARE CARD */}
                        <View style={styles.breakdownCard}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={styles.sectionTitleWithIcon}>
                                    <MaterialCommunityIcons name="chart-pie" size={18} color="#0165FF" />
                                    <ThemedText style={styles.sectionTitle}>
                                        Rendimiento por Aeronave
                                    </ThemedText>
                                </View>
                                <ThemedText style={styles.sectionSubBadge}>
                                    {metrics.aircraftBreakdown.length} flota
                                </ThemedText>
                            </View>

                            {metrics.aircraftBreakdown.length === 0 ? (
                                <ThemedText style={styles.emptyBreakdownText}>
                                    No hay registros de vuelos para esta selección.
                                </ThemedText>
                            ) : (
                                metrics.aircraftBreakdown.map((ac, idx) => (
                                    <View key={ac.aircraftId || idx} style={styles.aircraftRow}>
                                        <View style={styles.aircraftRowHeader}>
                                            <View style={styles.aircraftIdentGroup}>
                                                <View style={styles.registrationBadge}>
                                                    <ThemedText style={styles.registrationText}>
                                                        {ac.registration}
                                                    </ThemedText>
                                                </View>
                                                <ThemedText style={styles.aircraftModelText}>
                                                    {ac.model}
                                                </ThemedText>
                                            </View>
                                            <View style={styles.aircraftRevenueGroup}>
                                                <ThemedText style={styles.aircraftRevenueUsd}>
                                                    USD ${ac.revenueUsd.toLocaleString("en-US")}
                                                </ThemedText>
                                                <ThemedText style={styles.aircraftRevenuePercent}>
                                                    {ac.percentage}%
                                                </ThemedText>
                                            </View>
                                        </View>

                                        {/* Progress Bar */}
                                        <View style={styles.progressBarTrack}>
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    { width: `${Math.min(100, Math.max(4, ac.percentage))}%` },
                                                ]}
                                            />
                                        </View>

                                        <View style={styles.aircraftStatsRow}>
                                            <ThemedText style={styles.aircraftStatItem}>
                                                {ac.flightCount} vuelos realizados
                                            </ThemedText>
                                            <ThemedText style={styles.aircraftStatItem}>
                                                {ac.flightHours} horas voladas
                                            </ThemedText>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* PAYMENT METHODS & COLLECTION SUMMARY */}
                        <View style={styles.paymentMethodsCard}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={styles.sectionTitleWithIcon}>
                                    <Ionicons name="card-outline" size={18} color="#059669" />
                                    <ThemedText style={styles.sectionTitle}>
                                        Canales de Cobro
                                    </ThemedText>
                                </View>
                            </View>

                            <View style={styles.paymentMethodsGrid}>
                                <View style={styles.paymentMethodBox}>
                                    <View style={styles.paymentMethodHeader}>
                                        <Ionicons name="card" size={16} color="#00529B" />
                                        <ThemedText style={styles.paymentMethodName}>
                                            Bancard vPOS
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={styles.paymentMethodAmount}>
                                        USD ${metrics.paymentMethodsBreakdown.bancardUsd.toLocaleString("en-US")}
                                    </ThemedText>
                                    <ThemedText style={styles.paymentMethodTag}>
                                        Tarjetas Visa / MC / Débito
                                    </ThemedText>
                                </View>

                                <View style={styles.paymentMethodBox}>
                                    <View style={styles.paymentMethodHeader}>
                                        <Ionicons name="business" size={16} color="#059669" />
                                        <ThemedText style={styles.paymentMethodName}>
                                            SIPAP / Transf.
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={styles.paymentMethodAmount}>
                                        USD ${metrics.paymentMethodsBreakdown.transferUsd.toLocaleString("en-US")}
                                    </ThemedText>
                                    <ThemedText style={styles.paymentMethodTag}>
                                        Bancos Paraguayos
                                    </ThemedText>
                                </View>
                            </View>
                        </View>

                        {/* FLIGHT TRANSACTIONS LEDGER SECTION */}
                        <View style={styles.ledgerSection}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={styles.sectionTitleWithIcon}>
                                    <Ionicons name="list" size={18} color="#030436" />
                                    <ThemedText style={styles.sectionTitle}>
                                        Detalle de Entradas ({displayedFlights.length})
                                    </ThemedText>
                                </View>

                                <TouchableOpacity
                                    onPress={handleExportPdf}
                                    style={styles.exportButtonSmall}
                                    activeOpacity={0.8}
                                    disabled={isExporting}
                                >
                                    {isExporting ? (
                                        <ActivityIndicator size="small" color="#030436" />
                                    ) : (
                                        <>
                                            <Ionicons name="download-outline" size={14} color="#030436" />
                                            <ThemedText style={styles.exportButtonSmallText}>
                                                Exportar PDF
                                            </ThemedText>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Search Input */}
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={18} color="#94A3B8" />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Buscar por cliente, ruta, matrícula, factura..."
                                    placeholderTextColor="#94A3B8"
                                    style={styles.searchInput}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Status Filter Tabs */}
                            <View style={styles.statusTabsRow}>
                                <TouchableOpacity
                                    onPress={() => setStatusFilter("all")}
                                    style={[
                                        styles.statusTab,
                                        statusFilter === "all" ? styles.statusTabActive : styles.statusTabInactive,
                                    ]}
                                >
                                    <ThemedText
                                        style={[
                                            styles.statusTabText,
                                            statusFilter === "all" ? styles.statusTabTextActive : styles.statusTabTextInactive,
                                        ]}
                                    >
                                        Todos ({filteredFlights.length})
                                    </ThemedText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setStatusFilter("paid")}
                                    style={[
                                        styles.statusTab,
                                        statusFilter === "paid" ? styles.statusTabActive : styles.statusTabInactive,
                                    ]}
                                >
                                    <ThemedText
                                        style={[
                                            styles.statusTabText,
                                            statusFilter === "paid" ? styles.statusTabTextActive : styles.statusTabTextInactive,
                                        ]}
                                    >
                                        Cobrados ({filteredFlights.filter(f => f.paymentStatus === "paid").length})
                                    </ThemedText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setStatusFilter("pending")}
                                    style={[
                                        styles.statusTab,
                                        statusFilter === "pending" ? styles.statusTabActive : styles.statusTabInactive,
                                    ]}
                                >
                                    <ThemedText
                                        style={[
                                            styles.statusTabText,
                                            statusFilter === "pending" ? styles.statusTabTextActive : styles.statusTabTextInactive,
                                        ]}
                                    >
                                        Pendientes ({filteredFlights.filter(f => f.paymentStatus === "pending").length})
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>

                            {/* Flight Items List */}
                            {displayedFlights.length === 0 ? (
                                <View style={styles.emptyLedgerCard}>
                                    <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
                                    <ThemedText style={styles.emptyLedgerTitle}>
                                        No se encontraron vuelos
                                    </ThemedText>
                                    <ThemedText style={styles.emptyLedgerSub}>
                                        No hay registros de vuelos para el período y filtros seleccionados.
                                    </ThemedText>
                                </View>
                            ) : (
                                displayedFlights.map((flight) => {
                                    const isPaid = flight.paymentStatus === "paid";
                                    return (
                                        <View key={flight.id} style={styles.flightItemCard}>
                                            {/* Flight Header */}
                                            <View style={styles.flightItemHeader}>
                                                <View style={styles.flightDateWrapper}>
                                                    <ThemedText style={styles.flightDateText}>
                                                        {flight.flightDate.toLocaleDateString("es-PY", {
                                                            weekday: "short",
                                                            day: "2-digit",
                                                            month: "short",
                                                        }).toUpperCase()}
                                                    </ThemedText>
                                                    <ThemedText style={styles.flightTimeText}>
                                                        {flight.flightDate.toLocaleTimeString("es-PY", {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </ThemedText>
                                                </View>

                                                <View
                                                    style={[
                                                        styles.paymentBadge,
                                                        isPaid ? styles.paymentBadgePaid : styles.paymentBadgePending,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={isPaid ? "checkmark-circle" : "time-outline"}
                                                        size={12}
                                                        color={isPaid ? "#166534" : "#92400E"}
                                                    />
                                                    <ThemedText
                                                        style={[
                                                            styles.paymentBadgeText,
                                                            isPaid ? styles.paymentBadgeTextPaid : styles.paymentBadgeTextPending,
                                                        ]}
                                                    >
                                                        {isPaid
                                                            ? (flight.paymentMethod === "bancard_vpos" ? "BANCARD vPOS" : "SIPAP TRANSF.")
                                                            : "PENDIENTE DE PAGO"}
                                                    </ThemedText>
                                                </View>
                                            </View>

                                            {/* Route Display */}
                                            <View style={styles.flightRouteRow}>
                                                <View style={styles.airportBlock}>
                                                    <ThemedText style={styles.airportCode}>
                                                        {flight.route.originIdent}
                                                    </ThemedText>
                                                    <ThemedText style={styles.airportCity} numberOfLines={1}>
                                                        {flight.route.originCity}
                                                    </ThemedText>
                                                </View>

                                                <View style={styles.routeArrowGroup}>
                                                    <Ionicons name="airplane" size={16} color="#0165FF" />
                                                    <ThemedText style={styles.flightHoursTag}>
                                                        {flight.flightHours}h • {flight.distanceNm} nm
                                                    </ThemedText>
                                                </View>

                                                <View style={styles.airportBlockRight}>
                                                    <ThemedText style={styles.airportCode}>
                                                        {flight.route.destinationIdent}
                                                    </ThemedText>
                                                    <ThemedText style={styles.airportCity} numberOfLines={1}>
                                                        {flight.route.destinationCity}
                                                    </ThemedText>
                                                </View>
                                            </View>

                                            {/* Aircraft & Client Info */}
                                            <View style={styles.flightDetailsBar}>
                                                <View style={styles.detailItem}>
                                                    <Ionicons name="airplane-outline" size={14} color="#64748B" />
                                                    <ThemedText style={styles.detailText}>
                                                        {flight.aircraft.registration} ({flight.aircraft.model})
                                                    </ThemedText>
                                                </View>

                                                <View style={styles.detailItem}>
                                                    <Ionicons name="person-outline" size={14} color="#64748B" />
                                                    <ThemedText style={styles.detailText} numberOfLines={1}>
                                                        {flight.client.company || flight.client.name}
                                                    </ThemedText>
                                                </View>
                                            </View>

                                            {/* Invoice & Fiscal Info (e-Kuatia SIFEN) */}
                                            {flight.invoiceNumber ? (
                                                <View style={styles.invoiceInfoBox}>
                                                    <View style={styles.invoiceInfoHeader}>
                                                        <View style={styles.invoiceTag}>
                                                            <ThemedText style={styles.invoiceTagText}>
                                                                Factura SIFEN
                                                            </ThemedText>
                                                        </View>
                                                        <ThemedText style={styles.invoiceNumberText}>
                                                            Nº {flight.invoiceNumber}
                                                        </ThemedText>
                                                    </View>
                                                    <ThemedText style={styles.invoiceTimbradoText}>
                                                        Timbrado: {flight.invoiceTimbrado || "17492831"} • IVA 10%: USD ${flight.iva10Usd}
                                                    </ThemedText>
                                                </View>
                                            ) : null}

                                            {/* Amounts & Actions Footer */}
                                            <View style={styles.flightFooter}>
                                                <View>
                                                    <ThemedText style={styles.footerAmountUsd}>
                                                        USD ${flight.amountUsd.toLocaleString("en-US")}
                                                    </ThemedText>
                                                    <ThemedText style={styles.footerAmountGs}>
                                                        Gs. {flight.amountGs.toLocaleString("es-PY")}
                                                    </ThemedText>
                                                </View>

                                                {isPaid && (
                                                    <TouchableOpacity
                                                        onPress={() => handleViewInvoice(flight)}
                                                        style={styles.viewInvoiceButton}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
                                                        <ThemedText style={styles.viewInvoiceButtonText}>
                                                            Ver Factura (PDF)
                                                        </ThemedText>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </>
                )}
                    </>
                )}
            </ScrollView>

            {/* MONTH PICKER MODAL */}
            <Modal
                visible={isMonthPickerVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsMonthPickerVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Período</Text>
                            <TouchableOpacity onPress={() => setIsMonthPickerVisible(false)}>
                                <Ionicons name="close" size={22} color="#030436" />
                            </TouchableOpacity>
                        </View>

                        {/* Year Selector */}
                        <View style={styles.yearSelectorRow}>
                            <TouchableOpacity
                                onPress={() => setSelectedYear(y => y - 1)}
                                style={styles.yearArrowBtn}
                            >
                                <Ionicons name="chevron-back" size={18} color="#030436" />
                            </TouchableOpacity>
                            <Text style={styles.yearTitleText}>{selectedYear}</Text>
                            <TouchableOpacity
                                onPress={() => setSelectedYear(y => y + 1)}
                                style={styles.yearArrowBtn}
                            >
                                <Ionicons name="chevron-forward" size={18} color="#030436" />
                            </TouchableOpacity>
                        </View>

                        {/* Months Grid */}
                        <View style={styles.monthsGrid}>
                            {MONTH_NAMES_ES.map((name, index) => {
                                const isSelected = selectedMonth === index;
                                return (
                                    <TouchableOpacity
                                        key={name}
                                        onPress={() => {
                                            setSelectedMonth(index);
                                            setIsMonthPickerVisible(false);
                                        }}
                                        style={[
                                            styles.monthGridItem,
                                            isSelected ? styles.monthGridItemActive : styles.monthGridItemInactive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.monthGridItemText,
                                                isSelected ? styles.monthGridItemTextActive : styles.monthGridItemTextInactive,
                                            ]}
                                        >
                                            {name.slice(0, 3)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 40,
    },
    // Month Navigator
    monthNavigatorCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    navArrowButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    monthDisplayButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    calendarIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#FFFBEB",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#FEF3C7",
    },
    monthTextContainer: {
        alignItems: "center",
    },
    monthText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#030436",
    },
    monthSubText: {
        fontSize: 10,
        color: "#64748B",
    },
    // Demo toggle bar
    demoToggleBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    demoTextWrapper: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    demoLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#334155",
    },
    // Aircraft Filter Chips
    aircraftChipsScroll: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 14,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipActive: {
        backgroundColor: "#030436",
        borderColor: "#030436",
    },
    chipInactive: {
        backgroundColor: "#FFFFFF",
        borderColor: "#E2E8F0",
    },
    chipText: {
        fontSize: 12,
        fontWeight: "600",
    },
    chipTextActive: {
        color: "#FFFFFF",
    },
    chipTextInactive: {
        color: "#030436",
    },
    // Hero Card
    heroCard: {
        backgroundColor: "#030436",
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
    },
    heroHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    heroEyebrow: {
        fontSize: 11,
        color: "#0165FF",
        fontWeight: "bold",
        letterSpacing: 1,
    },
    heroAmountUsd: {
        fontSize: 20,
        fontWeight: "800",
        color: "#FFFFFF",
        marginTop: 4,
    },
    heroAmountGs: {
        fontSize: 13,
        color: "#94A3B8",
        fontWeight: "500",
        marginTop: 2,
    },
    variationBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    variationBadgePositive: {
        backgroundColor: "#DCFCE7",
    },
    variationBadgeNegative: {
        backgroundColor: "#FEE2E2",
    },
    variationText: {
        fontSize: 11,
        fontWeight: "bold",
    },
    variationTextPositive: {
        color: "#166534",
    },
    variationTextNegative: {
        color: "#991B1B",
    },
    heroDivider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        marginVertical: 16,
    },
    heroTaxGrid: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    heroTaxCol: {
        flex: 1,
    },
    heroTaxVerticalLine: {
        width: 1,
        height: 38,
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        marginHorizontal: 12,
    },
    heroTaxLabel: {
        fontSize: 10,
        color: "#94A3B8",
        textTransform: "uppercase",
        fontWeight: "600",
    },
    heroTaxValue: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#34D399",
        marginTop: 2,
    },
    heroTaxValueIva: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#60A5FA",
        marginTop: 2,
    },
    heroTaxSub: {
        fontSize: 10,
        color: "#94A3B8",
        marginTop: 1,
    },
    sifenBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    sifenTag: {
        backgroundColor: "rgba(96, 165, 250, 0.2)",
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    sifenTagText: {
        color: "#93C5FD",
        fontSize: 9,
        fontWeight: "bold",
    },
    // KPI Grid
    kpiGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 14,
    },
    kpiCard: {
        width: "48%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        minHeight: 135,
        justifyContent: "space-between",
    },
    kpiIconWrapperBlue: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#EEF2F6",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    kpiIconWrapperGold: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#FFFBEB",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    kpiIconWrapperGreen: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#ECFDF5",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    kpiIconWrapperPurple: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#F5F3FF",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    kpiNumber: {
        fontSize: 17,
        fontWeight: "bold",
        color: "#030436",
    },
    kpiUnit: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "normal",
    },
    kpiLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#334155",
        marginTop: 2,
    },
    kpiSub: {
        fontSize: 9,
        color: "#94A3B8",
        marginTop: 2,
    },
    // Breakdown Card
    breakdownCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    sectionTitleWithIcon: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#030436",
    },
    sectionSubBadge: {
        fontSize: 11,
        fontWeight: "600",
        color: "#0165FF",
        backgroundColor: "#FFFBEB",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    emptyBreakdownText: {
        fontSize: 12,
        color: "#94A3B8",
        fontStyle: "italic",
        textAlign: "center",
        paddingVertical: 16,
    },
    aircraftRow: {
        marginBottom: 14,
    },
    aircraftRowHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    aircraftIdentGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    registrationBadge: {
        backgroundColor: "#030436",
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    registrationText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "bold",
    },
    aircraftModelText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#334155",
    },
    aircraftRevenueGroup: {
        alignItems: "flex-end",
    },
    aircraftRevenueUsd: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#030436",
    },
    aircraftRevenuePercent: {
        fontSize: 10,
        color: "#64748B",
    },
    progressBarTrack: {
        height: 8,
        backgroundColor: "#F1F5F9",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 4,
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#0165FF",
        borderRadius: 4,
    },
    aircraftStatsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    aircraftStatItem: {
        fontSize: 10,
        color: "#94A3B8",
    },
    // Payment Channels
    paymentMethodsCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    paymentMethodsGrid: {
        flexDirection: "row",
        gap: 10,
    },
    paymentMethodBox: {
        flex: 1,
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    paymentMethodHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
    },
    paymentMethodName: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#334155",
    },
    paymentMethodAmount: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#030436",
    },
    paymentMethodTag: {
        fontSize: 9,
        color: "#64748B",
        marginTop: 2,
    },
    // Ledger Section
    ledgerSection: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    exportButtonSmall: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#FFFBEB",
        borderWidth: 1,
        borderColor: "#FEF3C7",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    exportButtonSmallText: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#030436",
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: "#030436",
        padding: 0,
    },
    statusTabsRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 14,
    },
    statusTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    statusTabActive: {
        backgroundColor: "#030436",
        borderColor: "#030436",
    },
    statusTabInactive: {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
    },
    statusTabText: {
        fontSize: 11,
        fontWeight: "600",
    },
    statusTabTextActive: {
        color: "#FFFFFF",
    },
    statusTabTextInactive: {
        color: "#64748B",
    },
    emptyLedgerCard: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 32,
    },
    emptyLedgerTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#334155",
        marginTop: 10,
    },
    emptyLedgerSub: {
        fontSize: 11,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 4,
        paddingHorizontal: 20,
    },
    // Flight Item Card
    flightItemCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    flightItemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    flightDateWrapper: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    flightDateText: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#030436",
    },
    flightTimeText: {
        fontSize: 11,
        color: "#64748B",
    },
    paymentBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    paymentBadgePaid: {
        backgroundColor: "#DCFCE7",
    },
    paymentBadgePending: {
        backgroundColor: "#FEF3C7",
    },
    paymentBadgeText: {
        fontSize: 9,
        fontWeight: "bold",
    },
    paymentBadgeTextPaid: {
        color: "#166534",
    },
    paymentBadgeTextPending: {
        color: "#92400E",
    },
    flightRouteRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        padding: 10,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#EEF2F6",
    },
    airportBlock: {
        flex: 1,
    },
    airportBlockRight: {
        flex: 1,
        alignItems: "flex-end",
    },
    airportCode: {
        fontSize: 16,
        fontWeight: "800",
        color: "#030436",
    },
    airportCity: {
        fontSize: 10,
        color: "#64748B",
        marginTop: 1,
    },
    routeArrowGroup: {
        alignItems: "center",
        paddingHorizontal: 8,
    },
    flightHoursTag: {
        fontSize: 9,
        color: "#0165FF",
        fontWeight: "bold",
        marginTop: 2,
    },
    flightDetailsBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        maxWidth: "48%",
    },
    detailText: {
        fontSize: 10,
        color: "#475569",
    },
    invoiceInfoBox: {
        backgroundColor: "#ECFDF5",
        borderRadius: 10,
        padding: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#D1FAE5",
    },
    invoiceInfoHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    invoiceTag: {
        backgroundColor: "#059669",
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    invoiceTagText: {
        color: "#FFFFFF",
        fontSize: 8,
        fontWeight: "bold",
    },
    invoiceNumberText: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#065F46",
    },
    invoiceTimbradoText: {
        fontSize: 9,
        color: "#047857",
        marginTop: 2,
    },
    flightFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        paddingTop: 10,
    },
    footerAmountUsd: {
        fontSize: 16,
        fontWeight: "800",
        color: "#030436",
    },
    footerAmountGs: {
        fontSize: 10,
        color: "#64748B",
    },
    viewInvoiceButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "#059669",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    viewInvoiceButtonText: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    // Month Modal Styles (Strict React Native Native Components as per Rule 5)
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(3, 4, 54, 0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#030436",
    },
    yearSelectorRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginBottom: 16,
    },
    yearArrowBtn: {
        padding: 4,
    },
    yearTitleText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#030436",
    },
    monthsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    monthGridItem: {
        width: "30.5%",
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    monthGridItemActive: {
        backgroundColor: "#0165FF",
    },
    monthGridItemInactive: {
        backgroundColor: "#F1F5F9",
    },
    monthGridItemText: {
        fontSize: 13,
        fontWeight: "bold",
    },
    monthGridItemTextActive: {
        color: "#FFFFFF",
    },
    monthGridItemTextInactive: {
        color: "#334155",
    },
    topModeSwitcher: {
        flexDirection: "row",
        backgroundColor: "#E2E8F0",
        padding: 4,
        borderRadius: 14,
        marginBottom: 12,
        gap: 6,
    },
    topModeBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    topModeBtnActive: {
        backgroundColor: "#030436",
    },
    topModeBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
    },
    topModeBtnTextActive: {
        color: "#FFFFFF",
    },
});
