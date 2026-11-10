import { pickFlightPlanImage } from "@/hooks/useAircraftOperations";
import {
    AircraftOperationsConfig,
    FuelCalculationMode,
    FuelPaymentMethod,
    OperationalCurrency,
    OperationalFlightDoc,
    OperationalFlightDraft,
} from "@/types/aircraft-operations";
import {
    addDaysToIso,
    calcFlightFinancials,
    formatAmt,
    formatGsFromUsd,
    formatHours,
    formatIsoToDmy,
    formatSignedUsd,
    formatUsd,
    getFuelPaymentStatus,
    getHourlyFuelCostUsd,
    getSafeTc,
    getTodayIso,
    num,
    PAYABLE_METHOD_LABELS,
} from "@/utils/aircraft-operations-calc";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface OperationalFlightModalProps {
    visible: boolean;
    flight: OperationalFlightDoc | null;
    config: AircraftOperationsConfig;
    existingClients: string[];
    isSaving: boolean;
    onClose: () => void;
    onSave: (flightDoc: OperationalFlightDoc) => Promise<void>;
    onDelete?: (flightId: string) => Promise<void>;
    onOpenLightbox: (imageUri: string) => void;
}

const PAX_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

export function OperationalFlightModal({
    visible,
    flight,
    config,
    existingClients,
    isSaving,
    onClose,
    onSave,
    onDelete,
    onOpenLightbox,
}: OperationalFlightModalProps) {
    const isNew = !flight;

    const [fecha, setFecha] = useState(getTodayIso());
    const [cliente, setCliente] = useState("");
    const [ruta, setRuta] = useState("");
    const [horas, setHoras] = useState("");
    const [precio, setPrecio] = useState("");
    const [moneda, setMoneda] = useState<OperationalCurrency>("USD");
    const [priceTouched, setPriceTouched] = useState(false);
    const [pasajeros, setPasajeros] = useState<number>(1);
    const [cobrado, setCobrado] = useState<boolean>(true);

    // Costos específicos de este vuelo
    const [fuelModo, setFuelModo] = useState<FuelCalculationMode>("litros");
    const [litros, setLitros] = useState("");
    const [precioLt, setPrecioLt] = useState("");
    const [precioLtCur, setPrecioLtCur] = useState<OperationalCurrency>("GS");
    const [fuelTotal, setFuelTotal] = useState("");
    const [fuelCur, setFuelCur] = useState<OperationalCurrency>("GS");

    // Forma de pago del combustible
    const [fuelPago, setFuelPago] = useState<FuelPaymentMethod>("contado");
    const [fuelDias, setFuelDias] = useState("30");
    // Cuentas por pagar del combustible a crédito
    const [fuelProveedor, setFuelProveedor] = useState("");
    const [fuelFacturaNumero, setFuelFacturaNumero] = useState("");
    const [fuelFacturaFotoUrl, setFuelFacturaFotoUrl] = useState<string | null>(null);
    const [isPickingFuelFactura, setIsPickingFuelFactura] = useState(false);

    // Piloto
    const [pilotoHora, setPilotoHora] = useState("");
    const [pilotoHoraCur, setPilotoHoraCur] = useState<OperationalCurrency>("USD");

    // Plan de vuelo DINAC
    const [planBase, setPlanBase] = useState("");
    const [planPersona, setPlanPersona] = useState("");
    const [planCur, setPlanCur] = useState<OperationalCurrency>("GS");

    // Comprobante fotográfico
    const [hangarUsd, setHangarUsd] = useState("");
    const [fotoUrl, setFotoUrl] = useState<string | null>(null);
    const [isPickingImage, setIsPickingImage] = useState(false);

    // Confirmación de borrado en 2 pasos (igual que el artefacto)
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setConfirmDeleteStep(false);

        if (flight) {
            setFecha(flight.fecha || getTodayIso());
            setCliente(flight.cliente || "");
            setRuta(flight.ruta || "");
            setHoras(flight.horas != null ? String(flight.horas) : "");
            setPrecio(flight.precio != null ? String(flight.precio) : "");
            setMoneda(flight.moneda || "USD");
            setPriceTouched(num(flight.precio) > 0);
            setPasajeros(
                flight.pasajeros != null
                    ? Math.max(0, Math.min(7, Math.round(num(flight.pasajeros))))
                    : 1
            );
            setCobrado(flight.cobrado !== false);
            setFuelModo(flight.fuelModo === "total" ? "total" : "litros");
            setLitros(flight.litros != null ? String(flight.litros) : "");
            setPrecioLt(flight.precioLt != null ? String(flight.precioLt) : "");
            setPrecioLtCur(flight.precioLtCur || "GS");
            setFuelTotal(flight.fuelTotal != null ? String(flight.fuelTotal) : "");
            setFuelCur(flight.fuelCur || "GS");
            setFuelPago(flight.fuelPago === "credito" ? "credito" : "contado");
            setFuelDias(flight.fuelDias != null ? String(flight.fuelDias) : "30");
            setFuelProveedor(flight.fuelProveedor || "");
            setFuelFacturaNumero(flight.fuelFacturaNumero || "");
            setFuelFacturaFotoUrl(flight.fuelFacturaFotoUrl || null);
            setPilotoHora(flight.pilotoHora != null ? String(flight.pilotoHora) : "");
            setPilotoHoraCur(flight.pilotoHoraCur || "USD");
            setPlanBase(flight.planBase != null ? String(flight.planBase) : "");
            setPlanPersona(flight.planPersona != null ? String(flight.planPersona) : "");
            setPlanCur(flight.planCur || "GS");
            setFotoUrl(flight.fotoUrl || null);
            setHangarUsd(flight.hangarUsd != null ? String(flight.hangarUsd) : "");
        } else {
            setHangarUsd("");
            setFecha(getTodayIso());
            setCliente("");
            setRuta("");
            setHoras("");
            setPrecio("");
            setMoneda("USD");
            setPriceTouched(false);
            setPasajeros(1);
            setCobrado(true);
            setFuelModo("litros");
            setLitros("");
            setPrecioLt("");
            setPrecioLtCur("GS");
            setFuelTotal("");
            setFuelCur("GS");
            setFuelPago("contado");
            setFuelDias("30");
            setFuelProveedor("");
            setFuelFacturaNumero("");
            setFuelFacturaFotoUrl(null);
            setPilotoHora("");
            setPilotoHoraCur("USD");
            setPlanBase("");
            setPlanPersona("");
            setPlanCur("GS");
            setFotoUrl(null);
        }
    }, [visible, flight]);

    // Fila creada desde una reserva de AltaGo: fecha, cliente, ruta, pasajeros y precio
    // los manda la reserva (se sincronizan en el servidor) y no se editan acá.
    const isLinkedToReservation = !!flight?.reservationId;

    const handleHorasChange = (val: string) => {
        setHoras(val);
        if (!priceTouched && !isLinkedToReservation) {
            setMoneda("USD");
            const autoVal = Math.round(num(val) * num(config.tarifaHora));
            setPrecio(autoVal > 0 ? String(autoVal) : "");
        }
    };

    const handlePrecioChange = (val: string) => {
        setPrecio(val);
        setPriceTouched(true);
    };

    const handleRecalcFromHours = () => {
        setPriceTouched(false);
        setMoneda("USD");
        const autoVal = Math.round(num(horas) * num(config.tarifaHora));
        setPrecio(autoVal > 0 ? String(autoVal) : "");
    };

    const draft: OperationalFlightDraft = useMemo(
        () => ({
            fecha,
            cliente,
            ruta,
            horas,
            precio,
            moneda,
            cobrado,
            pasajeros,
            fuelModo,
            litros,
            precioLt,
            precioLtCur,
            fuelTotal,
            fuelCur,
            pilotoHora,
            pilotoHoraCur,
            planBase,
            planPersona,
            planCur,
            fuelPago,
            fuelDias,
            fotoUrl,
        }),
        [
            fecha,
            cliente,
            ruta,
            horas,
            precio,
            moneda,
            cobrado,
            pasajeros,
            fuelModo,
            litros,
            precioLt,
            precioLtCur,
            fuelTotal,
            fuelCur,
            pilotoHora,
            pilotoHoraCur,
            planBase,
            planPersona,
            planCur,
            fuelPago,
            fuelDias,
            fotoUrl,
        ]
    );

    const calc = useMemo(() => calcFlightFinancials(draft, config), [draft, config]);

    const tc = getSafeTc(config);
    const hh = num(horas);

    // Placeholders dinámicos grises (idénticos al artefacto)
    const litrosPlaceholder = Math.round(hh * num(config.consumoLt))
        ? String(Math.round(hh * num(config.consumoLt)))
        : String(config.consumoLt);
    const precioLtPlaceholder =
        precioLtCur === "GS"
            ? num(config.precioLtGs).toLocaleString("es-PY")
            : (num(config.precioLtGs) / tc).toFixed(2);
    const fuelTotalPlaceholder =
        fuelCur === "GS"
            ? Math.round(hh * getHourlyFuelCostUsd(config) * tc).toLocaleString("es-PY")
            : String(Math.round(hh * getHourlyFuelCostUsd(config)));
    const pilotoHoraPlaceholder =
        pilotoHoraCur === "GS"
            ? Math.round(num(config.pilotajeHora) * tc).toLocaleString("es-PY")
            : String(num(config.pilotajeHora));
    const planBasePlaceholder =
        planCur === "GS"
            ? num(config.planBaseGs).toLocaleString("es-PY")
            : (num(config.planBaseGs) / tc).toFixed(2);
    const planPersonaPlaceholder =
        planCur === "GS"
            ? num(config.planPersonaGs).toLocaleString("es-PY")
            : (num(config.planPersonaGs) / tc).toFixed(2);

    const creditDueDateFormatted =
        fuelPago === "credito" && fecha
            ? formatIsoToDmy(addDaysToIso(fecha, Math.max(1, num(fuelDias) || 30)))
            : "";

    const handlePickImage = async (source: "library" | "camera") => {
        try {
            setIsPickingImage(true);
            const uri = await pickFlightPlanImage(source);
            if (uri) {
                setFotoUrl(uri);
            }
        } catch (err: any) {
            Alert.alert("Comprobante", err.message || "No se pudo seleccionar la imagen.");
        } finally {
            setIsPickingImage(false);
        }
    };

    const handlePickFuelFactura = async (source: "library" | "camera") => {
        try {
            setIsPickingFuelFactura(true);
            const uri = await pickFlightPlanImage(source, { fileUriOnly: true });
            if (uri) setFuelFacturaFotoUrl(uri);
        } catch (err: any) {
            Alert.alert("Factura", err.message || "No se pudo seleccionar la imagen.");
        } finally {
            setIsPickingFuelFactura(false);
        }
    };

    // Estado del pago del combustible a crédito (se registra desde «Por pagar»).
    const fuelPaymentStatusText = (() => {
        if (!flight || flight.fuelPago !== "credito" || fuelPago !== "credito") return "";
        if (getFuelPaymentStatus(flight) === "pagado") {
            if (!flight.fuelEstadoPago) return "Se asume pagado al vencer (vuelo cargado antes del seguimiento de pagos).";
            const medio = flight.fuelMedioPago ? ` · ${PAYABLE_METHOD_LABELS[flight.fuelMedioPago]}` : "";
            return `Pagado el ${formatIsoToDmy(flight.fuelFechaPago || "")}${medio}.`;
        }
        return "Pendiente de pago. Registrá el pago desde la pestaña «Por pagar».";
    })();

    const handleSubmit = async () => {
        if (!fecha.trim()) {
            Alert.alert("Fecha requerida", "Ingresá la fecha del vuelo (AAAA-MM-DD).");
            return;
        }
        if (!horas.trim() || num(horas) <= 0) {
            Alert.alert("Horas requeridas", "Ingresá las horas de vuelo.");
            return;
        }

        const flightId =
            flight?.id ||
            `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

        const docToSave: OperationalFlightDoc = {
            id: flightId,
            ownerId: config.ownerId,
            aircraftId: config.aircraftId,
            aircraftRegistration: config.aircraftRegistration,
            aircraftModel: config.aircraftModel,
            fecha: fecha.trim(),
            cliente: cliente.trim(),
            ruta: ruta.trim(),
            horas: num(horas),
            precio: num(precio),
            moneda,
            cobrado,
            pasajeros,
            fuelModo,
            litros: litros.trim() === "" ? null : num(litros),
            precioLt: precioLt.trim() === "" ? null : num(precioLt),
            precioLtCur,
            fuelTotal: fuelTotal.trim() === "" ? null : num(fuelTotal),
            fuelCur,
            pilotoHora: pilotoHora.trim() === "" ? null : num(pilotoHora),
            pilotoHoraCur,
            planBase: planBase.trim() === "" ? null : num(planBase),
            planPersona: planPersona.trim() === "" ? null : num(planPersona),
            planCur,
            fuelPago,
            fuelDias: Math.max(1, Math.round(num(fuelDias) || 30)),
            fuelProveedor: fuelProveedor.trim() || null,
            fuelFacturaNumero: fuelFacturaNumero.trim() || null,
            fuelFacturaFotoUrl: fuelFacturaFotoUrl || null,
            // Combustible que pasa a crédito (vuelo nuevo o antes al contado): queda pendiente
            // de pago. En un vuelo que ya era a crédito no se toca: el pago se registra en «Por pagar».
            ...(fuelPago === "credito" && flight?.fuelPago !== "credito"
                ? {
                      fuelEstadoPago: "pendiente" as const,
                      fuelFechaPago: null,
                      fuelMedioPago: null,
                      fuelReciboFotoUrl: null,
                      fuelNotasPago: null,
                  }
                : {}),
            fotoUrl,
            reservationId: flight?.reservationId ?? null,
            noches: flight?.noches ?? 0,
            hangarUsd: hangarUsd.trim() === "" ? null : num(hangarUsd),
            // Las horas dejan de ser una estimación cuando se cargan las reales.
            horasEstimadas: !!flight?.horasEstimadas && num(horas) === num(flight?.horas),
            createdAt: flight?.createdAt,
        };

        await onSave(docToSave);
    };

    const handleDeletePress = async () => {
        if (!flight || !onDelete) return;
        if (!confirmDeleteStep) {
            setConfirmDeleteStep(true);
            return;
        }
        await onDelete(flight.id);
    };

    // Filtrar sugerencias de clientes previos
    const clientSuggestions = useMemo(() => {
        if (!existingClients.length) return [];
        const q = cliente.trim().toLowerCase();
        return existingClients
            .filter((c) => c && (!q || c.toLowerCase().includes(q)) && c !== cliente)
            .slice(0, 5);
    }, [existingClients, cliente]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.scrim}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.sheet}>
                    {/* Cabecera del Modal */}
                    <View style={styles.headerRow}>
                        <Text style={styles.headerTitle}>
                            {isNew ? "Nuevo vuelo" : `Vuelo del ${formatIsoToDmy(flight.fecha)}`}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollBody}
                        keyboardShouldPersistTaps="handled"
                    >
                        {isLinkedToReservation && (
                            <View style={styles.linkedBanner}>
                                <Text style={styles.linkedBannerText}>
                                    Vuelo de una reserva de AltaGo. La fecha, el cliente, la ruta, los
                                    pasajeros y el precio vienen de la reserva. Completá las horas
                                    reales y los gastos del vuelo.
                                </Text>
                            </View>
                        )}

                        {/* 1. Fecha del vuelo */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Fecha del vuelo (AAAA-MM-DD)</Text>
                            <View style={styles.dateRow}>
                                <TextInput
                                    value={fecha}
                                    onChangeText={setFecha}
                                    editable={!isLinkedToReservation}
                                    placeholder="2026-10-31"
                                    placeholderTextColor="#93A3B6"
                                    style={[styles.input, { flex: 1 }, isLinkedToReservation ? styles.inputLocked : null]}
                                />
                                {!isLinkedToReservation && (
                                    <TouchableOpacity
                                        onPress={() => setFecha(getTodayIso())}
                                        style={styles.todayChip}
                                    >
                                        <Text style={styles.todayChipText}>Hoy</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* 2. Cliente */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Cliente</Text>
                            <TextInput
                                value={cliente}
                                onChangeText={setCliente}
                                editable={!isLinkedToReservation}
                                placeholder="Nombre del cliente"
                                placeholderTextColor="#93A3B6"
                                style={[styles.input, isLinkedToReservation ? styles.inputLocked : null]}
                            />
                            {!isLinkedToReservation && clientSuggestions.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.suggestionsRow}
                                >
                                    {clientSuggestions.map((sug) => (
                                        <TouchableOpacity
                                            key={sug}
                                            onPress={() => setCliente(sug)}
                                            style={styles.suggestionPill}
                                        >
                                            <Text style={styles.suggestionPillText}>{sug}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>

                        {/* 3. A dónde fue (Ruta) */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>A dónde fue</Text>
                            <TextInput
                                value={ruta}
                                onChangeText={setRuta}
                                editable={!isLinkedToReservation}
                                placeholder="Ej: Asunción – Ciudad del Este – Asunción"
                                placeholderTextColor="#93A3B6"
                                style={[styles.input, isLinkedToReservation ? styles.inputLocked : null]}
                            />
                        </View>

                        {/* 4. Horas de vuelo & Cuánto se cobró */}
                        <View style={styles.grid2}>
                            <View style={styles.gridCol}>
                                <Text style={styles.label}>Horas de vuelo</Text>
                                <TextInput
                                    value={horas}
                                    onChangeText={handleHorasChange}
                                    placeholder="1.8"
                                    placeholderTextColor="#93A3B6"
                                    keyboardType="decimal-pad"
                                    style={styles.input}
                                />
                                <Text style={styles.hint}>
                                    {flight?.horasEstimadas
                                        ? "Estimadas por la distancia: cargá las del Hobbs"
                                        : "Ida y vuelta"}
                                </Text>
                            </View>

                            <View style={styles.gridCol}>
                                <Text style={styles.label}>Cuánto se cobró (sin IVA)</Text>
                                <View style={styles.amountCurrencyRow}>
                                    <TextInput
                                        value={precio}
                                        onChangeText={handlePrecioChange}
                                        editable={!isLinkedToReservation}
                                        placeholder="1800"
                                        placeholderTextColor="#93A3B6"
                                        keyboardType="decimal-pad"
                                        style={[styles.input, { flex: 1 }, isLinkedToReservation ? styles.inputLocked : null]}
                                    />
                                    <TouchableOpacity
                                        disabled={isLinkedToReservation}
                                        onPress={() =>
                                            setMoneda((prev) => (prev === "USD" ? "GS" : "USD"))
                                        }
                                        style={styles.currencyToggleBtn}
                                    >
                                        <Text style={styles.currencyToggleText}>
                                            {moneda === "USD" ? "USD" : "Gs"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.hint}>
                                    Se calcula solo a {formatUsd(config.tarifaHora)} la hora.
                                </Text>
                                {priceTouched && !isLinkedToReservation && (
                                    <TouchableOpacity
                                        onPress={handleRecalcFromHours}
                                        style={styles.linkButton}
                                    >
                                        <Text style={styles.linkButtonText}>
                                            Calcular desde las horas
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {(num(flight?.noches) > 0 || hangarUsd.trim() !== "") && (
                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Pernocte y hangaraje</Text>
                                <Text style={styles.hint}>
                                    {num(flight?.noches)} {num(flight?.noches) === 1 ? "noche" : "noches"} fuera de base: se suma el pernocte del piloto ({formatUsd(num(config.pilotoPernocteUsd ?? 100))} por noche).
                                </Text>
                                <TextInput
                                    value={hangarUsd}
                                    onChangeText={setHangarUsd}
                                    placeholder="Hangaraje total pagado (USD)"
                                    placeholderTextColor="#93A3B6"
                                    keyboardType="decimal-pad"
                                    style={[styles.input, { marginTop: 8 }]}
                                />
                            </View>
                        )}

                        {/* 5. Pasajeros (Botonera 0 a 7) */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Pasajeros</Text>
                            <View style={styles.paxGrid}>
                                {PAX_OPTIONS.map((n) => {
                                    const isSelected = pasajeros === n;
                                    return (
                                        <TouchableOpacity
                                            key={n}
                                            disabled={isLinkedToReservation}
                                            onPress={() => setPasajeros(n)}
                                            style={[
                                                styles.paxButton,
                                                isSelected ? styles.paxButtonActive : null,
                                            ]}
                                            activeOpacity={0.75}
                                        >
                                            <Text
                                                style={[
                                                    styles.paxButtonText,
                                                    isSelected ? styles.paxButtonTextActive : null,
                                                ]}
                                            >
                                                {n}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text style={styles.hint}>
                                Sin contar al piloto ni al copiloto.
                            </Text>
                        </View>

                        {/* SECCIÓN: Costos de este vuelo */}
                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionHeader}>COSTOS DE ESTE VUELO</Text>
                            <Text style={styles.hint}>
                                Los precios salen de Ajustes. Cambialos acá solo si este vuelo
                                fue distinto; si los dejás vacíos se usa el de siempre, que
                                aparece en gris.
                            </Text>
                        </View>

                        {/* 6. Combustible */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Combustible</Text>
                            <View style={styles.segmentedRow}>
                                <TouchableOpacity
                                    onPress={() => setFuelModo("litros")}
                                    style={[
                                        styles.segButton,
                                        fuelModo === "litros" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            fuelModo === "litros"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        Por litros
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setFuelModo("total")}
                                    style={[
                                        styles.segButton,
                                        fuelModo === "total" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            fuelModo === "total"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        Importe total
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {fuelModo === "litros" ? (
                                <View style={[styles.grid2, { marginTop: 12 }]}>
                                    <View style={styles.gridCol}>
                                        <Text style={styles.subLabel}>Litros cargados</Text>
                                        <TextInput
                                            value={litros}
                                            onChangeText={setLitros}
                                            placeholder={litrosPlaceholder}
                                            placeholderTextColor="#93A3B6"
                                            keyboardType="decimal-pad"
                                            style={styles.input}
                                        />
                                    </View>
                                    <View style={styles.gridCol}>
                                        <Text style={styles.subLabel}>Precio por litro</Text>
                                        <View style={styles.amountCurrencyRow}>
                                            <TextInput
                                                value={precioLt}
                                                onChangeText={setPrecioLt}
                                                placeholder={precioLtPlaceholder}
                                                placeholderTextColor="#93A3B6"
                                                keyboardType="decimal-pad"
                                                style={[styles.input, { flex: 1 }]}
                                            />
                                            <TouchableOpacity
                                                onPress={() =>
                                                    setPrecioLtCur((prev) =>
                                                        prev === "GS" ? "USD" : "GS"
                                                    )
                                                }
                                                style={styles.currencyToggleBtn}
                                            >
                                                <Text style={styles.currencyToggleText}>
                                                    {precioLtCur === "GS" ? "Gs" : "USD"}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.subLabel}>Importe total pagado</Text>
                                    <View style={styles.amountCurrencyRow}>
                                        <TextInput
                                            value={fuelTotal}
                                            onChangeText={setFuelTotal}
                                            placeholder={fuelTotalPlaceholder}
                                            placeholderTextColor="#93A3B6"
                                            keyboardType="decimal-pad"
                                            style={[styles.input, { flex: 1 }]}
                                        />
                                        <TouchableOpacity
                                            onPress={() =>
                                                setFuelCur((prev) =>
                                                    prev === "GS" ? "USD" : "GS"
                                                )
                                            }
                                            style={styles.currencyToggleBtn}
                                        >
                                            <Text style={styles.currencyToggleText}>
                                                {fuelCur === "GS" ? "Gs" : "USD"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <View style={styles.unitSummaryPill}>
                                <Text style={styles.unitSummaryText}>
                                    Combustible de este vuelo:{" "}
                                    <Text style={styles.unitSummaryBold}>
                                        ${formatAmt(calc.fuel)}
                                    </Text>{" "}
                                    · {formatGsFromUsd(calc.fuel, config)}
                                </Text>
                            </View>
                        </View>

                        {/* 7. Forma de pago del combustible */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>¿Cómo se paga el combustible?</Text>
                            <View style={styles.segmentedRow}>
                                <TouchableOpacity
                                    onPress={() => setFuelPago("contado")}
                                    style={[
                                        styles.segButton,
                                        fuelPago === "contado" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            fuelPago === "contado"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        Contado
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setFuelPago("credito")}
                                    style={[
                                        styles.segButton,
                                        fuelPago === "credito" ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            fuelPago === "credito"
                                                ? styles.segButtonTextActive
                                                : null,
                                        ]}
                                    >
                                        A crédito
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {fuelPago === "credito" && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.subLabel}>Días de plazo</Text>
                                    <TextInput
                                        value={fuelDias}
                                        onChangeText={setFuelDias}
                                        placeholder="30"
                                        placeholderTextColor="#93A3B6"
                                        keyboardType="number-pad"
                                        style={styles.input}
                                    />
                                    {!!creditDueDateFormatted && (
                                        <Text style={styles.hint}>
                                            Sale de la caja el{" "}
                                            <Text style={{ fontWeight: "700", color: "#091626" }}>
                                                {creditDueDateFormatted}
                                            </Text>
                                            .
                                        </Text>
                                    )}

                                    <Text style={[styles.subLabel, { marginTop: 12 }]}>
                                        Proveedor del combustible
                                    </Text>
                                    <TextInput
                                        value={fuelProveedor}
                                        onChangeText={setFuelProveedor}
                                        placeholder="Ej: Petropar Aeropuerto"
                                        placeholderTextColor="#93A3B6"
                                        style={styles.input}
                                    />

                                    <Text style={[styles.subLabel, { marginTop: 12 }]}>
                                        Nº de factura
                                    </Text>
                                    <TextInput
                                        value={fuelFacturaNumero}
                                        onChangeText={setFuelFacturaNumero}
                                        placeholder="001-001-0001234"
                                        placeholderTextColor="#93A3B6"
                                        style={styles.input}
                                    />

                                    <Text style={[styles.subLabel, { marginTop: 12 }]}>
                                        Foto de la factura
                                    </Text>
                                    <View style={styles.photoActionsRow}>
                                        <TouchableOpacity
                                            onPress={() => handlePickFuelFactura("library")}
                                            disabled={isPickingFuelFactura}
                                            style={styles.photoPickerBtn}
                                        >
                                            <Ionicons name="image-outline" size={18} color="#1540C9" />
                                            <Text style={styles.photoPickerBtnText}>
                                                {isPickingFuelFactura ? "Cargando…" : "Galería"}
                                            </Text>
                                        </TouchableOpacity>
                                        {Platform.OS !== "web" && (
                                            <TouchableOpacity
                                                onPress={() => handlePickFuelFactura("camera")}
                                                disabled={isPickingFuelFactura}
                                                style={styles.photoPickerBtn}
                                            >
                                                <Ionicons name="camera-outline" size={18} color="#1540C9" />
                                                <Text style={styles.photoPickerBtnText}>Cámara</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {fuelFacturaFotoUrl ? (
                                        <View style={{ marginTop: 12 }}>
                                            <TouchableOpacity
                                                onPress={() => onOpenLightbox(fuelFacturaFotoUrl)}
                                                activeOpacity={0.85}
                                            >
                                                <Image
                                                    source={{ uri: fuelFacturaFotoUrl }}
                                                    style={styles.photoThumb}
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                            <View style={styles.photoFooterRow}>
                                                <Text style={styles.hint}>
                                                    Tocá la foto para verla en grande.
                                                </Text>
                                                <TouchableOpacity onPress={() => setFuelFacturaFotoUrl(null)}>
                                                    <Text style={styles.linkButtonText}>
                                                        Quitar la foto
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : null}

                                    {!!fuelPaymentStatusText && (
                                        <Text style={[styles.hint, { color: "#091626" }]}>
                                            {fuelPaymentStatusText}
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* 8. Piloto */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Piloto: precio por hora</Text>
                            <View style={styles.amountCurrencyRow}>
                                <TextInput
                                    value={pilotoHora}
                                    onChangeText={setPilotoHora}
                                    placeholder={pilotoHoraPlaceholder}
                                    placeholderTextColor="#93A3B6"
                                    keyboardType="decimal-pad"
                                    style={[styles.input, { flex: 1 }]}
                                />
                                <TouchableOpacity
                                    onPress={() =>
                                        setPilotoHoraCur((prev) =>
                                            prev === "USD" ? "GS" : "USD"
                                        )
                                    }
                                    style={styles.currencyToggleBtn}
                                >
                                    <Text style={styles.currencyToggleText}>
                                        {pilotoHoraCur === "USD" ? "USD" : "Gs"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.unitSummaryPill}>
                                <Text style={styles.unitSummaryText}>
                                    Piloto por {formatHours(hh)}:{" "}
                                    <Text style={styles.unitSummaryBold}>
                                        ${formatAmt(calc.piloto)}
                                    </Text>{" "}
                                    · {formatGsFromUsd(calc.piloto, config)}
                                </Text>
                            </View>
                        </View>

                        {/* 9. Plan de vuelo (Tasas DINAC) */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Plan de vuelo</Text>
                            <View style={styles.grid2}>
                                <View style={styles.gridCol}>
                                    <Text style={styles.subLabel}>Base por vuelo</Text>
                                    <TextInput
                                        value={planBase}
                                        onChangeText={setPlanBase}
                                        placeholder={planBasePlaceholder}
                                        placeholderTextColor="#93A3B6"
                                        keyboardType="decimal-pad"
                                        style={styles.input}
                                    />
                                </View>
                                <View style={styles.gridCol}>
                                    <Text style={styles.subLabel}>Por pasajero</Text>
                                    <View style={styles.amountCurrencyRow}>
                                        <TextInput
                                            value={planPersona}
                                            onChangeText={setPlanPersona}
                                            placeholder={planPersonaPlaceholder}
                                            placeholderTextColor="#93A3B6"
                                            keyboardType="decimal-pad"
                                            style={[styles.input, { flex: 1 }]}
                                        />
                                        <TouchableOpacity
                                            onPress={() =>
                                                setPlanCur((prev) =>
                                                    prev === "GS" ? "USD" : "GS"
                                                )
                                            }
                                            style={styles.currencyToggleBtn}
                                        >
                                            <Text style={styles.currencyToggleText}>
                                                {planCur === "GS" ? "Gs" : "USD"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.unitSummaryPill}>
                                <Text style={styles.unitSummaryText}>
                                    Plan de vuelo con {pasajeros}{" "}
                                    {pasajeros === 1 ? "pasajero" : "pasajeros"}:{" "}
                                    <Text style={styles.unitSummaryBold}>
                                        ${formatAmt(calc.tasas)}
                                    </Text>{" "}
                                    · {formatGsFromUsd(calc.tasas, config)}
                                </Text>
                            </View>
                        </View>

                        {/* SECCIÓN: Comprobante fotográfico del Plan de Vuelo */}
                        <View style={styles.sectionDivider}>
                            <Text style={styles.sectionHeader}>COMPROBANTE</Text>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Foto del plan de vuelo</Text>

                            <View style={styles.photoActionsRow}>
                                <TouchableOpacity
                                    onPress={() => handlePickImage("library")}
                                    disabled={isPickingImage}
                                    style={styles.photoPickerBtn}
                                >
                                    <Ionicons name="image-outline" size={18} color="#1540C9" />
                                    <Text style={styles.photoPickerBtnText}>
                                        {isPickingImage ? "Cargando…" : "Elegir de galería"}
                                    </Text>
                                </TouchableOpacity>

                                {Platform.OS !== "web" && (
                                    <TouchableOpacity
                                        onPress={() => handlePickImage("camera")}
                                        disabled={isPickingImage}
                                        style={styles.photoPickerBtn}
                                    >
                                        <Ionicons name="camera-outline" size={18} color="#1540C9" />
                                        <Text style={styles.photoPickerBtnText}>Cámara</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {fotoUrl ? (
                                <View style={{ marginTop: 12 }}>
                                    <TouchableOpacity
                                        onPress={() => onOpenLightbox(fotoUrl)}
                                        activeOpacity={0.85}
                                    >
                                        <Image
                                            source={{ uri: fotoUrl }}
                                            style={styles.photoThumb}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                    <View style={styles.photoFooterRow}>
                                        <Text style={styles.hint}>
                                            Tocá la foto para verla en grande.
                                        </Text>
                                        <TouchableOpacity onPress={() => setFotoUrl(null)}>
                                            <Text style={styles.linkButtonText}>
                                                Quitar la foto
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.hint}>
                                    Opcional. Sirve para que después se pueda comprobar que los
                                    datos coinciden.
                                </Text>
                            )}
                        </View>

                        {/* 10. ¿Ya nos pagaron? */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>¿Ya nos pagaron?</Text>
                            <View style={styles.segmentedRow}>
                                <TouchableOpacity
                                    onPress={() => setCobrado(true)}
                                    style={[
                                        styles.segButton,
                                        cobrado ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            cobrado ? styles.segButtonTextActive : null,
                                        ]}
                                    >
                                        Sí, cobrado
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setCobrado(false)}
                                    style={[
                                        styles.segButton,
                                        !cobrado ? styles.segButtonActive : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segButtonText,
                                            !cobrado ? styles.segButtonTextActive : null,
                                        ]}
                                    >
                                        Todavía no
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 11. Caja de Resumen en Vivo del Vuelo */}
                        <View style={styles.summaryBox}>
                            {[
                                { label: "Se cobra", val: calc.ingreso, extra: "" },
                                {
                                    label: "Combustible",
                                    val: -calc.fuel,
                                    extra: creditDueDateFormatted
                                        ? ` · a crédito, vence el ${creditDueDateFormatted}`
                                        : "",
                                },
                                { label: "Piloto", val: -calc.piloto, extra: "" },
                                { label: "Plan de vuelo", val: -calc.tasas, extra: "" },
                                {
                                    label: "Reserva de mantenimiento",
                                    val: -calc.reserva,
                                    extra: "",
                                },
                            ].map((row) => (
                                <View key={row.label} style={styles.summaryLine}>
                                    <Text
                                        style={[
                                            styles.summaryLineLabel,
                                            row.extra ? { color: "#1540C9" } : null,
                                        ]}
                                    >
                                        {row.label}
                                        {row.extra}
                                    </Text>
                                    <View style={styles.summaryLineRight}>
                                        <Text style={styles.summaryLineUsd}>
                                            {formatUsd(row.val)}
                                        </Text>
                                        <Text style={styles.summaryLineGs}>
                                            {formatGsFromUsd(row.val, config)}
                                        </Text>
                                    </View>
                                </View>
                            ))}

                            <View style={[styles.summaryLine, styles.summaryTotalLine]}>
                                <Text style={styles.summaryTotalLabel}>Deja este vuelo</Text>
                                <View style={styles.summaryLineRight}>
                                    <Text
                                        style={[
                                            styles.summaryTotalUsd,
                                            calc.resultado >= 0
                                                ? { color: "#0A7042" }
                                                : { color: "#BC3324" },
                                        ]}
                                    >
                                        {formatSignedUsd(calc.resultado)}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.summaryLineGs,
                                            calc.resultado >= 0
                                                ? { color: "#0A7042" }
                                                : { color: "#BC3324" },
                                        ]}
                                    >
                                        {formatGsFromUsd(calc.resultado, config)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* 12. Botones de Acción */}
                        <View style={styles.actionsRow}>
                            {!isNew && onDelete && (
                                <TouchableOpacity
                                    onPress={handleDeletePress}
                                    disabled={isSaving}
                                    style={[
                                        styles.deleteBtn,
                                        confirmDeleteStep ? styles.deleteBtnConfirm : null,
                                    ]}
                                >
                                    <Text style={styles.deleteBtnText}>
                                        {confirmDeleteStep ? "¿Seguro?" : "Borrar"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={isSaving}
                                style={[
                                    styles.saveBtn,
                                    isSaving ? { opacity: 0.7 } : null,
                                ]}
                            >
                                {isSaving ? (
                                    <View style={styles.savingRow}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.saveBtnText}>Guardando…</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.saveBtnText}>
                                        {isNew ? "Guardar vuelo" : "Guardar cambios"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: "rgba(9, 22, 38, 0.45)",
        justifyContent: "flex-end",
        alignItems: "center",
    },
    sheet: {
        backgroundColor: "#FFFFFF",
        width: "100%",
        maxWidth: 520,
        maxHeight: "92%",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: "#E7EDF5",
        paddingHorizontal: 22,
        paddingTop: 20,
        paddingBottom: 28,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: "700",
        color: "#091626",
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#F4F7FC",
        alignItems: "center",
        justifyContent: "center",
    },
    closeBtnText: {
        fontSize: 22,
        color: "#52647A",
        lineHeight: 24,
    },
    scrollBody: {
        paddingBottom: 20,
    },
    fieldGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14.5,
        fontWeight: "600",
        color: "#091626",
        marginBottom: 8,
    },
    subLabel: {
        fontSize: 13.5,
        fontWeight: "600",
        color: "#091626",
        marginBottom: 6,
    },
    hint: {
        fontSize: 13,
        color: "#52647A",
        marginTop: 6,
        lineHeight: 18,
    },
    inputLocked: {
        backgroundColor: "#F1F5F9",
        color: "#52647A",
    },
    linkedBanner: {
        backgroundColor: "#EAF3FF",
        borderColor: "#7AB4FF",
        borderWidth: 1,
        borderRadius: 11,
        padding: 12,
        marginBottom: 16,
    },
    linkedBannerText: {
        color: "#030436",
        fontSize: 13,
        lineHeight: 18,
    },
    input: {
        backgroundColor: "#FFFFFF",
        color: "#091626",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 11,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: "500",
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    todayChip: {
        backgroundColor: "#EEF3FE",
        borderWidth: 1,
        borderColor: "#7BA4FF",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 11,
    },
    todayChipText: {
        color: "#1540C9",
        fontWeight: "700",
        fontSize: 14,
    },
    suggestionsRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 8,
    },
    suggestionPill: {
        backgroundColor: "#F4F7FC",
        borderWidth: 1,
        borderColor: "#E6ECF6",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 99,
    },
    suggestionPillText: {
        fontSize: 12.5,
        color: "#1540C9",
        fontWeight: "600",
    },
    grid2: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    gridCol: {
        flex: 1,
    },
    amountCurrencyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    currencyToggleBtn: {
        backgroundColor: "#F4F7FC",
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        borderRadius: 11,
        paddingHorizontal: 12,
        paddingVertical: 12,
        minWidth: 64,
        alignItems: "center",
        justifyContent: "center",
    },
    currencyToggleText: {
        fontSize: 14.5,
        fontWeight: "700",
        color: "#1540C9",
    },
    linkButton: {
        marginTop: 7,
    },
    linkButtonText: {
        color: "#1540C9",
        fontSize: 13.5,
        fontWeight: "600",
        textDecorationLine: "underline",
    },
    paxGrid: {
        flexDirection: "row",
        gap: 6,
    },
    paxButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    paxButtonActive: {
        backgroundColor: "#1540C9",
        borderColor: "#1540C9",
    },
    paxButtonText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#091626",
    },
    paxButtonTextActive: {
        color: "#FFFFFF",
    },
    sectionDivider: {
        borderTopWidth: 1.5,
        borderTopColor: "#E7EDF5",
        paddingTop: 18,
        marginTop: 8,
        marginBottom: 14,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.1,
        color: "#52647A",
        textTransform: "uppercase",
    },
    segmentedRow: {
        flexDirection: "row",
        gap: 8,
    },
    segButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    segButtonActive: {
        backgroundColor: "#EEF3FE",
        borderColor: "#1540C9",
    },
    segButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#091626",
    },
    segButtonTextActive: {
        color: "#1540C9",
    },
    unitSummaryPill: {
        marginTop: 9,
        backgroundColor: "#F4F7FC",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    unitSummaryText: {
        fontSize: 13.5,
        color: "#52647A",
    },
    unitSummaryBold: {
        color: "#091626",
        fontWeight: "700",
        fontSize: 15,
    },
    photoActionsRow: {
        flexDirection: "row",
        gap: 10,
    },
    photoPickerBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#EEF3FE",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    photoPickerBtnText: {
        color: "#1540C9",
        fontWeight: "600",
        fontSize: 14,
    },
    photoThumb: {
        width: "100%",
        height: 200,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#E7EDF5",
    },
    photoFooterRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
    },
    summaryBox: {
        backgroundColor: "#F4F7FC",
        borderRadius: 12,
        padding: 15,
        marginTop: 6,
    },
    summaryLine: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingVertical: 6,
        gap: 12,
    },
    summaryLineLabel: {
        flex: 1,
        fontSize: 14,
        color: "#091626",
    },
    summaryLineRight: {
        alignItems: "flex-end",
    },
    summaryLineUsd: {
        fontSize: 14.5,
        fontWeight: "600",
        color: "#091626",
    },
    summaryLineGs: {
        fontSize: 12,
        fontWeight: "500",
        color: "#52647A",
        marginTop: 2,
    },
    summaryTotalLine: {
        borderTopWidth: 1,
        borderTopColor: "#E6ECF6",
        marginTop: 6,
        paddingTop: 10,
    },
    summaryTotalLabel: {
        fontSize: 15,
        fontWeight: "700",
        color: "#091626",
    },
    summaryTotalUsd: {
        fontSize: 16.5,
        fontWeight: "700",
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 22,
    },
    deleteBtn: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 999,
        backgroundColor: "transparent",
    },
    deleteBtnConfirm: {
        backgroundColor: "#FCEAE7",
    },
    deleteBtnText: {
        color: "#BC3324",
        fontWeight: "700",
        fontSize: 15,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: "#1540C9",
        paddingVertical: 15,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    savingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    saveBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 15.5,
    },
});

