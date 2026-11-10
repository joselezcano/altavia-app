import AirportPicker from "@/components/airport-picker";
import { QuoteEditor } from "@/components/quote/quote-editor";
import { BRAND_COLORS } from "@/constants/brand";
import { CustomDatePicker } from "@/components/custom-date-picker";
import { useAuth } from "@/hooks/useAuth";
import { useAircraftOperationsConfig } from "@/hooks/useAircraftOperations";
import { useAirportByIdent } from "@/hooks/useAirportByIdent";
import { useAllAircrafts } from "@/hooks/useAllAircrafts";
import { useClients, useCreateQuickClient } from "@/hooks/useClients";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { ReservationConflictError, useCreatePhoneReservation } from "@/hooks/usePhoneReservation";
import { isItemEdited, useQuoteDraft } from "@/hooks/useQuoteDraft";
import { QuoteInput, useQuote, useSaveQuote } from "@/hooks/useQuotes";
import { computeFlightQuote, DEFAULT_CRUISE_SPEED_KNOTS, grossFromNet } from "@/utils/flight-pricing";
import { Airport } from "@/types/all-roles";
import { QuickClientFormSchema } from "@/types/client";
import { NewBookingFormProps, QuoteEditLoaderProps } from "@/types/quote-ui";
import { BaseUser } from "@/types/user";
import { brandFont } from "@/utils/brand-fonts";
import { confirmAction, showNotice } from "@/utils/dialogs";
import { getDistanceBetweenAirports } from "@/utils/flight-distance";
import { DEFAULT_QUOTE_VALIDITY_DAYS } from "@/utils/quote-builder";
import { estimatedCostsFromQuote, quoteShortNumber, toDateSafe } from "@/utils/quote-format";
import { roleFlightRoute, roleHomeRoute, toHref } from "@/utils/role-routes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

/**
 * Nueva reserva telefónica / presupuesto (admin, owner y encargada por re-export).
 * Paso 3 = editor de presupuesto: "Guardar presupuesto" (flujo nuevo) o "Reservar sin
 * presupuesto" (la reserva directa de siempre).
 * Con el param quoteId (ruta quote-edit) reabre el editor con un presupuesto guardado.
 */
export default function NewBookingScreen() {
  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();
  // Al guardar un presupuesto nuevo se reinicia el formulario (en el Drawer del admin la pantalla queda montada).
  const [formKey, setFormKey] = useState(0);
  if (quoteId) return <QuoteEditLoader quoteId={String(quoteId)} />;
  return <NewBookingForm key={`new-${formKey}`} initialQuote={null} onQuoteSaved={() => setFormKey((k) => k + 1)} />;
}

/** Carga el presupuesto, sus aeropuertos y el cliente antes de abrir el editor. */
function QuoteEditLoader({ quoteId }: QuoteEditLoaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { data: quote, isLoading, error } = useQuote(quoteId);
  const origin = useAirportByIdent(quote?.trip?.origin_airport_ident);
  const destination = useAirportByIdent(quote?.trip?.destination_airport_ident);
  const { data: clients = [], isLoading: isLoadingClients } = useClients();

  const goBack = () => {
    const route = roleFlightRoute(role, "quote-details", { quoteId });
    if (role !== "ADMIN" && router.canGoBack()) router.back();
    else if (route) router.replace(toHref(route));
  };

  if (isLoading || isLoadingClients || (quote && (origin.isLoading || destination.isLoading))) {
    return (
      <View style={[styles.centerBox, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator color={BRAND_COLORS.navy} />
        <Text style={[styles.cardSubtitle, { marginTop: 10 }]}>Cargando presupuesto...</Text>
      </View>
    );
  }
  if (error || !quote || quote.status === "converted") {
    return (
      <View style={[styles.centerBox, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="alert-circle-outline" size={32} color="#B45309" />
        <Text style={[styles.cardTitle, { marginTop: 10, textAlign: "center" }]}>
          {quote?.status === "converted"
            ? "Este presupuesto ya se convirtió en reserva y no se puede editar."
            : "No se pudo cargar el presupuesto."}
        </Text>
        <TouchableOpacity onPress={goBack} style={[styles.backButton, { marginTop: 16 }]}>
          <Ionicons name="arrow-back" size={18} color="#030436" />
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const client: BaseUser | null =
    clients.find((c) => c.uid === quote.clientId) ||
    (quote.clientId
      ? {
          uid: quote.clientId,
          email: quote.clientEmail || "",
          firstName: quote.clientName,
          lastName: "",
          phone: quote.clientPhone,
          roles: ["CLIENT"],
        }
      : null);

  const updatedAt = toDateSafe(quote.updatedAt)?.getTime() ?? 0;
  return (
    <NewBookingForm
      key={`${quote.id}-${updatedAt}`}
      initialQuote={quote}
      initialClient={client}
      initialOrigin={origin.data ?? undefined}
      initialDestination={destination.data ?? undefined}
    />
  );
}

function NewBookingForm({ initialQuote, initialClient, initialOrigin, initialDestination, onQuoteSaved }: NewBookingFormProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, role, profileData } = useAuth();
  const isEditingQuote = !!initialQuote;
  const saveQuoteMutation = useSaveQuote();
  const createReservationMutation = useCreatePhoneReservation();

  // Queries
  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: allAircrafts = [], isLoading: isLoadingAircrafts } = useAllAircrafts();

  // Solo las aeronaves que el rol activo puede gestionar (si no, firestore.rules rechaza el alta):
  // admin, todas; owner, las suyas; encargada, sus managed_aircrafts.
  const aircrafts = useMemo(() => {
    if (role === "ADMIN") return allAircrafts;
    if (role === "OWNER") return allAircrafts.filter((a) => !!user?.uid && a.ownerId === user.uid);
    if (role === "PILOT" && profileData?.isEncargado === true) {
      const managed: string[] = Array.isArray(profileData?.managed_aircrafts) ? profileData.managed_aircrafts : [];
      return allAircrafts.filter((a) => managed.includes(a.id));
    }
    return [];
  }, [allAircrafts, role, user?.uid, profileData]);
  const { data: exchangeRate } = useExchangeRate();
  const createQuickClientMutation = useCreateQuickClient();

  // Step state (1: Cliente, 2: Vuelo & Ruta, 3: Tarifa & Confirmación)
  const [currentStep, setCurrentStep] = useState(initialQuote ? 3 : 1);

  // Form states: Client
  const [selectedClient, setSelectedClient] = useState<BaseUser | null>(initialClient ?? null);
  const [clientSearch, setClientSearch] = useState("");
  const [isQuickClientModalVisible, setIsQuickClientModalVisible] = useState(false);

  // Quick Client form
  const [quickFirstName, setQuickFirstName] = useState("");
  const [quickLastName, setQuickLastName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickDoc, setQuickDoc] = useState("");
  const [quickPersonType, setQuickPersonType] = useState<"individual" | "company">("individual");
  const [quickBusinessName, setQuickBusinessName] = useState("");

  // Form states: Flight
  const [originAirport, setOriginAirport] = useState<Airport | undefined>(initialOrigin);
  const [destinationAirport, setDestinationAirport] = useState<Airport | undefined>(initialDestination);
  const [roundtrip, setRoundtrip] = useState(initialQuote?.schedule.roundtrip ?? false);
  const [departureDate, setDepartureDate] = useState<Date | null>(
    toDateSafe(initialQuote?.schedule.outbound_flight_departure_time)
  );
  const [returnDate, setReturnDate] = useState<Date | null>(
    toDateSafe(initialQuote?.schedule.return_flight_departure_time)
  );
  const [passengers, setPassengers] = useState(initialQuote?.passengers ?? 1);

  // Selected aircraft (pre-select first if only 1 exists). Al editar un presupuesto, la suya.
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>(initialQuote?.aircraftId ?? "");

  React.useEffect(() => {
    if (aircrafts.length > 0 && !selectedAircraftId) {
      setSelectedAircraftId(aircrafts[0].id);
    }
  }, [aircrafts, selectedAircraftId]);

  const activeAircraft = useMemo(() => {
    const found = aircrafts.find((a) => a.id === selectedAircraftId);
    // Al editar no se cambia de aeronave (las reglas no permiten cambiar aircraftId/ownerId).
    if (isEditingQuote) return found || null;
    return found || aircrafts[0] || null;
  }, [aircrafts, selectedAircraftId, isEditingQuote]);

  // Calculations
  const distanceNm = useMemo(() => {
    return Math.round(getDistanceBetweenAirports(originAirport, destinationAirport, "nm"));
  }, [originAirport, destinationAirport]);

  const distanceKm = useMemo(() => {
    return Math.round(distanceNm * 1.852);
  }, [distanceNm]);

  const cruiseSpeed = activeAircraft?.operating_specs?.cruise_speed_knots || DEFAULT_CRUISE_SPEED_KNOTS;
  const flightDurationHours = distanceNm > 0 ? distanceNm / cruiseSpeed : 0;

  // Cotización por hora: horas facturables (incluye reposicionamiento y regreso vacío) × tarifa + pernoctes.
  // El hangaraje por noche ahora se ajusta en la línea "Hangaraje / estacionamiento" del presupuesto.
  const quote = useMemo(
    () =>
      computeFlightQuote({
        origin: originAirport,
        destination: destinationAirport,
        base: activeAircraft?.base_airport,
        roundtrip,
        outboundDeparture: departureDate,
        returnDeparture: roundtrip ? returnDate : null,
        cruiseSpeedKnots: cruiseSpeed,
        pricing: activeAircraft?.pricing,
      }),
    [originAirport, destinationAirport, activeAircraft, roundtrip, departureDate, returnDate, cruiseSpeed]
  );

  // Ajustes de GIO de la aeronave (costos estimados del presupuesto).
  const opsCfgEnabled = !!activeAircraft?.ownerId && !!activeAircraft?.id;
  const opsCfg = useAircraftOperationsConfig(
    activeAircraft?.ownerId,
    activeAircraft?.id ?? "",
    activeAircraft?.basic_specs?.registration,
    activeAircraft?.basic_specs?.model
  );
  const cfgReady = !!activeAircraft && (!opsCfgEnabled || !opsCfg.isPending);

  // Editor del presupuesto (líneas, costos, totales). Ver useQuoteDraft para el recálculo.
  const draft = useQuoteDraft({
    flightQuote: quote,
    cfg: opsCfg.data ?? null,
    cfgReady,
    passengers,
    distanceNm,
    cruiseSpeedKnots: cruiseSpeed,
    initial: initialQuote,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const exchangeRateValue = exchangeRate?.dolar && exchangeRate.dolar > 0 ? exchangeRate.dolar : 0;

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 5);
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.documentNumber && c.documentNumber.includes(q)) ||
        (c.businessName && c.businessName.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  // Handle Quick Client Submit
  const handleCreateQuickClient = async () => {
    const rawData = {
      firstName: quickFirstName,
      lastName: quickLastName,
      phone: quickPhone,
      email: quickEmail.trim(),
      documentNumber: quickDoc,
      personType: quickPersonType,
      businessName: quickPersonType === "company" ? quickBusinessName : undefined,
    };

    const validation = QuickClientFormSchema.safeParse(rawData);
    if (!validation.success) {
      const firstError = validation.error.issues?.[0]?.message || "Datos incompletos";
      Alert.alert("Campos requeridos", firstError);
      return;
    }

    try {
      const { client: created, matchedBy } = await createQuickClientMutation.mutateAsync(validation.data);
      setSelectedClient(created);
      setIsQuickClientModalVisible(false);
      if (matchedBy === "document") {
        // No se creó un duplicado: se reutilizó la ficha que ya tenía ese documento.
        showNotice(
          "Cliente existente",
          `Ya existe un cliente con ese documento: se usó el existente (${created.firstName} ${created.lastName}).`
        );
      } else {
        Toast.show({
          type: "success",
          text1: "Cliente Registrado",
          text2: `${created.firstName} ${created.lastName} fue dado de alta con éxito.`,
        });
      }
      // Clear quick form
      setQuickFirstName("");
      setQuickLastName("");
      setQuickPhone("");
      setQuickEmail("");
      setQuickDoc("");
      setQuickBusinessName("");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "No se pudo registrar el cliente.");
    }
  };

  // Validaciones comunes a "Guardar presupuesto" y "Reservar sin presupuesto".
  const validateForm = (): boolean => {
    if (!selectedClient) {
      showNotice("Cliente Requerido", "Por favor selecciona o crea un cliente.");
      setCurrentStep(1);
      return false;
    }
    if (!originAirport || !destinationAirport) {
      showNotice("Ruta Incompleta", "Debes seleccionar aeropuerto de origen y destino.");
      setCurrentStep(2);
      return false;
    }
    if (!departureDate) {
      showNotice("Fecha Requerida", "Debes seleccionar la fecha y hora de salida.");
      setCurrentStep(2);
      return false;
    }
    if (roundtrip && !returnDate) {
      showNotice("Fecha de Retorno", "Marcaste vuelo de ida y vuelta. Selecciona la fecha de retorno.");
      setCurrentStep(2);
      return false;
    }
    if (roundtrip && returnDate && returnDate <= departureDate) {
      showNotice("Fecha Inválida", "La fecha de retorno debe ser posterior a la de salida.");
      setCurrentStep(2);
      return false;
    }
    if (!activeAircraft) {
      showNotice("Aeronave Requerida", "No hay una aeronave activa seleccionada.");
      return false;
    }
    if (draft.totals.subtotalUsd <= 0) {
      showNotice("Precio Inválido", "El subtotal (sin IVA) tiene que ser mayor a 0.");
      return false;
    }
    return true;
  };

  const quoteDetailsRoute = (quoteId: string) => roleFlightRoute(role, "quote-details", { quoteId });

  /** Sale del editor (modo edición) hacia el detalle del presupuesto. */
  const leaveQuoteEditor = () => {
    if (!initialQuote) return;
    const route = quoteDetailsRoute(initialQuote.id);
    if (role !== "ADMIN" && router.canGoBack()) router.back();
    else if (route) router.replace(toHref(route));
  };

  /** Arma el documento del presupuesto con lo que hay en pantalla. */
  const buildQuoteInput = (): QuoteInput | null => {
    if (!selectedClient || !originAirport || !destinationAirport || !departureDate || !activeAircraft) return null;
    const validityDays = Math.max(1, parseInt(draft.validityDaysInput, 10) || DEFAULT_QUOTE_VALIDITY_DAYS);
    const { costs: fullCosts, ...totals } = draft.totals;
    const clientName =
      `${selectedClient.firstName || ""} ${selectedClient.lastName || ""}`.trim() || selectedClient.businessName || "Cliente";

    const base: QuoteInput = {
      ...totals,
      aircraftId: activeAircraft.id,
      ownerId: initialQuote?.ownerId ?? activeAircraft.ownerId ?? "",
      aircraftRegistration: activeAircraft.basic_specs?.registration || "",
      aircraftModel: activeAircraft.basic_specs?.model || "",
      clientId: selectedClient.uid || null,
      clientName,
      clientPhone: selectedClient.phone || undefined,
      clientEmail: selectedClient.email || undefined,
      trip: {
        origin_airport_ident: originAirport.ident,
        origin_name: originAirport.name,
        origin_timezone: originAirport.timezone || undefined,
        destination_airport_ident: destinationAirport.ident,
        destination_name: destinationAirport.name,
        destination_timezone: destinationAirport.timezone || undefined,
      },
      schedule: {
        roundtrip,
        outbound_flight_departure_time: departureDate,
        return_flight_departure_time: roundtrip ? returnDate : null,
      },
      passengers,
      withCopilot: draft.withCopilot,
      pricing: draft.pricing,
      // Si la admin cambió un monto, el detalle sugerido ("3 h × USD 900") ya no corresponde: no sale en la hoja.
      lines: draft.lines.map((l) => (isItemEdited(l) ? { ...l, detail: undefined } : l)),
      costs: fullCosts,
      notes: draft.notes.trim(),
      internalNotes: draft.internalNotes.trim(),
      status: "draft",
      validUntil: new Date(Date.now() + validityDays * 86_400_000),
    };

    if (!initialQuote) return base;

    // Edición: un presupuesto ya enviado sigue "enviado" (sube la versión); si estaba aceptado,
    // rechazado o vencido, vuelve a "enviado" y el cliente tiene que aceptarlo de nuevo.
    const wasSent = !!initialQuote.sentAt || initialQuote.status !== "draft";
    const reopened = ["accepted", "rejected", "expired"].includes(initialQuote.status);
    return {
      ...base,
      id: initialQuote.id,
      version: initialQuote.version ?? 1,
      status: wasSent ? "sent" : "draft",
      ...(reopened ? { acceptedAt: null, acceptedVia: null, acceptedBy: null, rejectedAt: null } : {}),
    };
  };

  // Guardar presupuesto (acción principal del paso 3)
  const handleSaveQuote = async () => {
    if (!validateForm()) return;
    if (initialQuote?.status === "accepted") {
      const ok = await confirmAction({
        title: "Presupuesto aceptado",
        message: "El cliente ya aceptó este presupuesto. Si guardás cambios vuelve a \"Enviado\" y tiene que aceptarlo de nuevo.",
        confirmText: "Guardar igual",
      });
      if (!ok) return;
    }
    const input = buildQuoteInput();
    if (!input) return;

    setIsSubmitting(true);
    try {
      const quoteId = await saveQuoteMutation.mutateAsync(input);
      Toast.show({
        type: "success",
        text1: initialQuote ? "Presupuesto actualizado" : "Presupuesto guardado",
        text2: `#${quoteShortNumber(quoteId)} · ${input.clientName}`,
      });
      if (initialQuote) {
        leaveQuoteEditor();
        return;
      }
      const route = quoteDetailsRoute(quoteId);
      if (route) router.replace(toHref(route));
      onQuoteSaved?.();
    } catch (error: any) {
      console.error("Error al guardar el presupuesto:", error);
      showNotice("Error", error?.message || "No se pudo guardar el presupuesto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reservar sin presupuesto: la creación directa de la reserva de siempre.
  const handleCreateBooking = async () => {
    if (!validateForm() || !selectedClient || !originAirport || !destinationAirport || !departureDate || !activeAircraft) {
      return;
    }
    const netPrice = draft.totals.subtotalUsd;
    const internalNotes = draft.internalNotes.trim();

    setIsSubmitting(true);
    try {
      const { reservationId } = await createReservationMutation.mutateAsync({
        aircraftId: activeAircraft.id,
        clientId: selectedClient.uid,
        priceNetUsd: netPrice,
        estimatedPriceUsd: draft.totals.subtotalSuggestedUsd,
        distanceNm,
        cruiseSpeedKnots: cruiseSpeed,
        billableHours: quote.billableHours,
        pricePerHourUsd: quote.pricePerHourUsd,
        overnightNights: quote.nights,
        overnightFeeUsd: quote.overnightFeeUsd,
        hangarPerNightUsd: quote.hangarPerNightUsd,
        trip: {
          origin_airport_ident: originAirport.ident,
          origin_timezone: originAirport.timezone || "",
          destination_airport_ident: destinationAirport.ident,
          destination_timezone: destinationAirport.timezone || "",
        },
        roundtrip,
        outboundDeparture: departureDate,
        returnDeparture: roundtrip ? returnDate : null,
        passengers,
        statusNotes: internalNotes
          ? `Despacho telefónico. Notas: ${internalNotes}`
          : "Reserva telefónica cargada por administración.",
        estimatedCosts: estimatedCostsFromQuote(draft.totals.costs, quote.billableHours),
      });

      Toast.show({
        type: "success",
        text1: "¡Reserva Creada Exitosamente!",
        text2: `Vuelo registrado para ${selectedClient.firstName} ${selectedClient.lastName}`,
      });

      // Rutas del grupo del rol activo (el admin no tiene assign-pilots: solo vuelve al inicio).
      const assignPilotsRoute = roleFlightRoute(role, "assign-pilots", { reservationId });
      const summary = `La reserva fue registrada con éxito por USD ${netPrice.toLocaleString("en-US")} + IVA (total USD ${grossFromNet(netPrice).toLocaleString("en-US")}).`;
      Alert.alert(
        "Reserva Creada",
        assignPilotsRoute ? `${summary}\n\n¿Deseas asignar tripulación y aprobarla ahora?` : summary,
        [
          {
            text: role === "ADMIN" ? "Ir al Dashboard" : "Ir a Vuelos",
            style: "cancel",
            onPress: () => router.replace(roleHomeRoute(role)),
          },
          ...(assignPilotsRoute
            ? [
                {
                  text: "Asignar Piloto y Aprobar",
                  onPress: () => router.replace(toHref(assignPilotsRoute)),
                },
              ]
            : []),
        ]
      );
    } catch (error: any) {
      if (error instanceof ReservationConflictError) {
        showNotice("Horario no disponible", error.message);
        return;
      }
      console.error("Error al registrar reserva concierge:", error);
      showNotice("Error", error?.message || "No se pudo registrar la reserva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {isEditingQuote && initialQuote && (
          <View style={styles.editBanner}>
            <Ionicons name="document-text-outline" size={18} color={BRAND_COLORS.azur} />
            <Text style={[styles.editBannerText, brandFont(700)]}>
              Editando presupuesto #{quoteShortNumber(initialQuote.id)} · v{initialQuote.version ?? 1}
            </Text>
            <TouchableOpacity onPress={leaveQuoteEditor} hitSlop={8}>
              <Text style={[styles.editBannerLink, brandFont(600)]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Step Indicator Header */}
        <View style={styles.stepHeaderContainer}>
          {[1, 2, 3].map((step) => {
            const isCurrent = currentStep === step;
            const isCompleted = currentStep > step;
            return (
              <TouchableOpacity
                key={step}
                onPress={() => setCurrentStep(step)}
                style={styles.stepItem}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stepCircle,
                    isCurrent && styles.stepCircleCurrent,
                    isCompleted && styles.stepCircleCompleted,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepNumber,
                        (isCurrent || isCompleted) && styles.stepNumberActive,
                      ]}
                    >
                      {step}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                >
                  {step === 1 ? "Cliente" : step === 2 ? "Ruta" : "Presupuesto"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* STEP 1: CLIENT SELECTION */}
          {currentStep === 1 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle-outline" size={24} color="#030436" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>1. Seleccionar o Dar de Alta Cliente</Text>
                  <Text style={styles.cardSubtitle}>
                    Busca al cliente por nombre, WhatsApp o RUC, o regístralo al instante.
                  </Text>
                </View>
              </View>

              {/* Selected Client Card */}
              {selectedClient ? (
                <View style={styles.selectedClientBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={styles.clientAvatarBadge}>
                        <Text style={styles.clientAvatarText}>
                          {selectedClient.firstName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.clientNameText}>
                          {selectedClient.firstName} {selectedClient.lastName}
                        </Text>
                        <Text style={styles.clientSubText}>
                          {selectedClient.phone || "Sin teléfono"}{selectedClient.email ? ` • ${selectedClient.email}` : ""}
                        </Text>
                        {selectedClient.documentNumber && (
                          <Text style={styles.clientDocText}>
                            Doc/RUC: {selectedClient.documentNumber}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedClient(null)}
                      style={styles.changeClientButton}
                    >
                      <Ionicons name="pencil" size={14} color="#030436" />
                      <Text style={styles.changeClientText}>Cambiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {/* Search bar */}
                  <View style={styles.searchBarContainer}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                      value={clientSearch}
                      onChangeText={setClientSearch}
                      placeholder="Buscar por nombre, teléfono o RUC..."
                      placeholderTextColor="#94A3B8"
                      style={styles.searchInput}
                    />
                    {clientSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setClientSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Results list */}
                  {isLoadingClients ? (
                    <ActivityIndicator size="small" color="#030436" style={{ marginVertical: 16 }} />
                  ) : filteredClients.length > 0 ? (
                    <View style={{ gap: 8, marginVertical: 8 }}>
                      {filteredClients.map((c) => (
                        <TouchableOpacity
                          key={c.uid}
                          onPress={() => {
                            setSelectedClient(c);
                            setClientSearch("");
                          }}
                          style={styles.clientItemRow}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={styles.clientAvatarSmall}>
                              <Text style={styles.clientAvatarSmallText}>
                                {c.firstName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.clientItemName}>
                                {c.firstName} {c.lastName} {c.businessName ? `(${c.businessName})` : ""}
                              </Text>
                              <Text style={styles.clientItemSub}>
                                {c.phone || c.email} {c.documentNumber ? `• RUC: ${c.documentNumber}` : ""}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noClientsText}>
                      No se encontraron clientes con "{clientSearch}".
                    </Text>
                  )}

                  {/* Button: Nuevo Cliente Rápido */}
                  <TouchableOpacity
                    onPress={() => setIsQuickClientModalVisible(true)}
                    style={styles.newClientButton}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add" size={18} color="#FFFFFF" />
                    <Text style={styles.newClientButtonText}>+ Alta Rápida de Cliente</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Navigation CTA */}
              <TouchableOpacity
                onPress={() => {
                  if (!selectedClient) {
                    Alert.alert("Selecciona un cliente", "Por favor selecciona o crea el cliente para avanzar.");
                    return;
                  }
                  setCurrentStep(2);
                }}
                style={[styles.nextButton, !selectedClient && styles.nextButtonDisabled]}
                disabled={!selectedClient}
              >
                <Text style={styles.nextButtonText}>Continuar a Ruta y Horario</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: ROUTE, AIRPORTS & SCHEDULE */}
          {currentStep === 2 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="airplane-takeoff" size={24} color="#030436" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>2. Ruta, Aeronave y Fechas</Text>
                  <Text style={styles.cardSubtitle}>
                    Configura el trayecto solicitado por el cliente.
                  </Text>
                </View>
              </View>

              {!activeAircraft && !isLoadingAircrafts && (
                <Text style={[styles.cardSubtitle, { color: "#B45309", marginBottom: 12 }]}>
                  No tenés aeronaves habilitadas para cargar reservas con este rol.
                </Text>
              )}

              {/* Selected Aircraft Banner */}
              {activeAircraft && (
                <View style={styles.aircraftBadgeBox}>
                  <Ionicons name="airplane" size={18} color="#0165FF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aircraftBadgeTitle}>
                      Aeronave: {activeAircraft.basic_specs.model} ({activeAircraft.basic_specs.registration})
                    </Text>
                    <Text style={styles.aircraftBadgeSub}>
                      Capacidad: {activeAircraft.basic_specs.pax_count} pax • Crucero: {cruiseSpeed} kts
                    </Text>
                  </View>
                </View>
              )}

              {/* Origin Airport */}
              <View style={{ marginVertical: 6 }}>
                <Text style={styles.inputLabel}>Aeropuerto de Origen</Text>
                <AirportPicker
                  value={originAirport}
                  onChange={(airport) => setOriginAirport(airport || undefined)}
                />
              </View>

              {/* Destination Airport */}
              <View style={{ marginVertical: 6 }}>
                <Text style={styles.inputLabel}>Aeropuerto de Destino</Text>
                <AirportPicker
                  value={destinationAirport}
                  onChange={(airport) => setDestinationAirport(airport || undefined)}
                />
              </View>

              {/* Distance & Flight time preview */}
              {distanceNm > 0 && (
                <View style={styles.distancePreviewBox}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.previewLabel}>Distancia estimada:</Text>
                    <Text style={styles.previewValue}>{distanceNm} NM ({distanceKm} km)</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={styles.previewLabel}>Tiempo de vuelo por tramo:</Text>
                    <Text style={styles.previewValue}>
                      {Math.floor(flightDurationHours)}h {Math.round((flightDurationHours % 1) * 60)}min
                    </Text>
                  </View>
                </View>
              )}

              {/* Roundtrip Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Vuelo de Ida y Vuelta</Text>
                  <Text style={styles.switchSub}>Multiplica el kilometraje y habilita retorno</Text>
                </View>
                <Switch
                  value={roundtrip}
                  onValueChange={setRoundtrip}
                  trackColor={{ false: "#CBD5E1", true: "#030436" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Outbound Date/Time */}
              <View style={{ marginVertical: 6 }}>
                <Text style={styles.inputLabel}>Fecha y Hora de Salida (Ida)</Text>
                <CustomDatePicker
                  value={departureDate}
                  onChange={(date) => setDepartureDate(date || null)}
                  placeholder="Seleccionar salida..."
                />
              </View>

              {/* Return Date/Time (if roundtrip) */}
              {roundtrip && (
                <View style={{ marginVertical: 6 }}>
                  <Text style={styles.inputLabel}>Fecha y Hora de Retorno (Vuelta)</Text>
                  <CustomDatePicker
                    value={returnDate}
                    onChange={(date) => setReturnDate(date || null)}
                    placeholder="Seleccionar retorno..."
                  />
                </View>
              )}

              {/* Passenger counter */}
              <View style={{ marginVertical: 10 }}>
                <Text style={styles.inputLabel}>Cantidad de Pasajeros</Text>
                <View style={styles.paxCounterRow}>
                  <TouchableOpacity
                    onPress={() => setPassengers((p) => Math.max(1, p - 1))}
                    style={styles.paxButton}
                  >
                    <Ionicons name="remove" size={18} color="#030436" />
                  </TouchableOpacity>
                  <Text style={styles.paxCountValue}>{passengers} pasajero(s)</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const maxPax = activeAircraft?.basic_specs?.pax_count || 8;
                      setPassengers((p) => Math.min(maxPax, p + 1));
                    }}
                    style={styles.paxButton}
                  >
                    <Ionicons name="add" size={18} color="#030436" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Navigation CTAs */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setCurrentStep(1)}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={18} color="#030436" />
                  <Text style={styles.backButtonText}>Atrás</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (!originAirport || !destinationAirport) {
                      Alert.alert("Origen y Destino", "Selecciona origen y destino para continuar.");
                      return;
                    }
                    if (!departureDate) {
                      Alert.alert("Fecha requerida", "Indica la fecha y hora de salida.");
                      return;
                    }
                    setCurrentStep(3);
                  }}
                  style={styles.nextButtonFlex}
                >
                  <Text style={styles.nextButtonText}>Continuar al Presupuesto</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: PRESUPUESTO (editor) */}
          {currentStep === 3 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={24} color="#030436" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>3. Presupuesto</Text>
                  <Text style={styles.cardSubtitle}>
                    Ajustá lo que se cobra (sin IVA) y guardalo para enviarlo al cliente por WhatsApp.
                  </Text>
                </View>
              </View>

              {isEditingQuote && !activeAircraft && !isLoadingAircrafts && (
                <Text style={[styles.cardSubtitle, { color: "#B45309", marginBottom: 12 }]}>
                  No tenés acceso a la aeronave de este presupuesto con el rol activo.
                </Text>
              )}

              <QuoteEditor
                draft={draft}
                flightQuote={quote}
                exchangeRate={exchangeRateValue}
                costsFromDefaults={cfgReady && opsCfgEnabled && !!opsCfg.data && !opsCfg.data.id}
              />

              {/* Booking Summary Box */}
              <View style={[styles.summaryBox, { marginTop: 16 }]}>
                <Text style={styles.summaryBoxTitle}>Resumen del Vuelo</Text>
                <Text style={styles.summaryBoxLine}>
                  • <Text style={{ fontWeight: "bold" }}>Cliente:</Text> {selectedClient?.firstName} {selectedClient?.lastName} ({selectedClient?.phone || selectedClient?.email || "sin contacto"})
                </Text>
                <Text style={styles.summaryBoxLine}>
                  • <Text style={{ fontWeight: "bold" }}>Ruta:</Text> {originAirport?.name || originAirport?.ident} ➔ {destinationAirport?.name || destinationAirport?.ident}
                </Text>
                <Text style={styles.summaryBoxLine}>
                  • <Text style={{ fontWeight: "bold" }}>Aeronave:</Text> {activeAircraft?.basic_specs.model} ({activeAircraft?.basic_specs.registration})
                </Text>
                <Text style={styles.summaryBoxLine}>
                  • <Text style={{ fontWeight: "bold" }}>Salida:</Text> {departureDate?.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })} hs
                </Text>
                {roundtrip && (
                  <Text style={styles.summaryBoxLine}>
                    • <Text style={{ fontWeight: "bold" }}>Retorno:</Text> {returnDate?.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })} hs
                  </Text>
                )}
                <Text style={styles.summaryBoxLine}>
                  • <Text style={{ fontWeight: "bold" }}>Pasajeros:</Text> {passengers}
                </Text>
              </View>

              {/* Acciones */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setCurrentStep(2)}
                  style={styles.backButton}
                  disabled={isSubmitting}
                >
                  <Ionicons name="arrow-back" size={18} color="#030436" />
                  <Text style={styles.backButtonText}>Atrás</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveQuote}
                  style={[styles.saveQuoteButton, isSubmitting && { opacity: 0.7 }]}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="document-text" size={20} color="#FFFFFF" />
                      <Text style={[styles.confirmButtonText, brandFont(700)]}>
                        {isEditingQuote ? "Guardar cambios" : "Guardar presupuesto"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {!isEditingQuote && (
                <TouchableOpacity
                  onPress={handleCreateBooking}
                  style={[styles.directBookingButton, isSubmitting && { opacity: 0.6 }]}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                  <Text style={[styles.directBookingText, brandFont(700)]}>Reservar sin presupuesto</Text>
                </TouchableOpacity>
              )}
              {!isEditingQuote && (
                <Text style={styles.directBookingHint}>
                  Crea la reserva directa (como hasta ahora) por {draft.totals.subtotalUsd.toLocaleString("es-PY")} USD + IVA.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* QUICK CLIENT MODAL */}
      <Modal
        visible={isQuickClientModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsQuickClientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Alta Rápida de Cliente</Text>
                <Text style={styles.modalHeaderSub}>Crea la ficha para asignar reservas y cobrar.</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsQuickClientModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Type Switcher */}
              <View style={styles.modalTypeRow}>
                <TouchableOpacity
                  onPress={() => setQuickPersonType("individual")}
                  style={[
                    styles.typeTab,
                    quickPersonType === "individual" && styles.typeTabActive,
                  ]}
                >
                  <Text style={[styles.typeTabText, quickPersonType === "individual" && styles.typeTabTextActive]}>
                    Persona Física
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setQuickPersonType("company")}
                  style={[
                    styles.typeTab,
                    quickPersonType === "company" && styles.typeTabActive,
                  ]}
                >
                  <Text style={[styles.typeTabText, quickPersonType === "company" && styles.typeTabTextActive]}>
                    Empresa / RUC
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <View style={{ gap: 10 }}>
                {quickPersonType === "company" && (
                  <View>
                    <Text style={styles.modalInputLabel}>Razón Social</Text>
                    <TextInput
                      value={quickBusinessName}
                      onChangeText={setQuickBusinessName}
                      placeholder="Ej: Agrovanguardia S.A."
                      style={styles.modalInput}
                    />
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalInputLabel}>Nombre *</Text>
                    <TextInput
                      value={quickFirstName}
                      onChangeText={setQuickFirstName}
                      placeholder="Juan"
                      style={styles.modalInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalInputLabel}>Apellido *</Text>
                    <TextInput
                      value={quickLastName}
                      onChangeText={setQuickLastName}
                      placeholder="Pérez"
                      style={styles.modalInput}
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.modalInputLabel}>Teléfono / WhatsApp * (Para link de pago)</Text>
                  <TextInput
                    value={quickPhone}
                    onChangeText={setQuickPhone}
                    placeholder="0981 123 456"
                    keyboardType="phone-pad"
                    style={styles.modalInput}
                  />
                </View>

                <View>
                  <Text style={styles.modalInputLabel}>Correo Electrónico (opcional)</Text>
                  <TextInput
                    value={quickEmail}
                    onChangeText={setQuickEmail}
                    placeholder="cliente@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.modalInput}
                  />
                </View>

                <View>
                  <Text style={styles.modalInputLabel}>
                    {quickPersonType === "company" ? "RUC de la Empresa *" : "C.I. / Pasaporte *"}
                  </Text>
                  <TextInput
                    value={quickDoc}
                    onChangeText={setQuickDoc}
                    placeholder={quickPersonType === "company" ? "80098765-4" : "1.234.567"}
                    style={styles.modalInput}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setIsQuickClientModalVisible(false)}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateQuickClient}
                style={styles.modalSaveButton}
                disabled={createQuickClientMutation.isPending}
              >
                {createQuickClientMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Guardar y Seleccionar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleCurrent: {
    backgroundColor: "#030436",
  },
  stepCircleCompleted: {
    backgroundColor: "#0165FF",
  },
  stepNumber: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#64748B",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontFamily: "NotoSans_500Medium",
  },
  stepLabelCurrent: {
    color: "#030436",
    fontFamily: "NotoSans_700Bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  cardSubtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  selectedClientBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  clientAvatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#030436",
    alignItems: "center",
    justifyContent: "center",
  },
  clientAvatarText: {
    color: "#0165FF",
    fontFamily: "NotoSans_700Bold",
    fontSize: 16,
  },
  clientNameText: {
    fontSize: 15,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  clientSubText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  clientDocText: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "NotoSans_500Medium",
  },
  changeClientButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  changeClientText: {
    fontSize: 11,
    color: "#030436",
    fontFamily: "NotoSans_600SemiBold",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    fontFamily: "NotoSans_400Regular",
    flex: 1,
    fontSize: 13,
    color: "#030436",
  },
  clientItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  clientAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  clientAvatarSmallText: {
    color: "#030436",
    fontFamily: "NotoSans_700Bold",
    fontSize: 13,
  },
  clientItemName: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  clientItemSub: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#64748B",
  },
  noClientsText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginVertical: 10,
  },
  newClientButton: {
    backgroundColor: "#030436",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  newClientButtonText: {
    color: "#FFFFFF",
    fontFamily: "NotoSans_700Bold",
    fontSize: 13,
  },
  nextButton: {
    backgroundColor: "#0165FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 6,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontFamily: "NotoSans_700Bold",
    fontSize: 14,
  },
  nextButtonFlex: {
    flex: 1,
    backgroundColor: "#0165FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  backButtonText: {
    color: "#030436",
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 13,
  },
  aircraftBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#030436",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  aircraftBadgeTitle: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
  aircraftBadgeSub: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#CBD5E1",
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    marginBottom: 4,
  },
  inputLabelBold: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  distancePreviewBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  previewLabel: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#64748B",
  },
  previewValue: {
    fontSize: 11,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    marginVertical: 8,
  },
  switchLabel: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  switchSub: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#64748B",
  },
  paxCounterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 6,
  },
  paxButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  paxCountValue: {
    fontSize: 14,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  priceCalculationBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
  },
  priceSublabel: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 12,
    color: "#64748B",
  },
  priceSubvalue: {
    fontSize: 12,
    fontFamily: "NotoSans_600SemiBold",
    color: "#030436",
  },
  priceDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
  suggestedTitle: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  suggestedValue: {
    fontSize: 16,
    fontFamily: "NotoSans_700Bold",
    color: "#0165FF",
  },
  resetPriceText: {
    fontSize: 11,
    color: "#00529B",
    fontFamily: "NotoSans_600SemiBold",
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0165FF",
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  priceCurrencySymbol: {
    fontSize: 22,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    marginRight: 6,
  },
  priceTextInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    paddingVertical: 10,
  },
  priceCurrencyBadge: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#94A3B8",
  },
  pygEquivalentText: {
    fontSize: 12,
    color: "#059669",
    fontFamily: "NotoSans_600SemiBold",
    marginTop: 4,
  },
  notesTextInput: {
    fontFamily: "NotoSans_400Regular",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: "#030436",
    textAlignVertical: "top",
  },
  summaryBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginTop: 8,
  },
  summaryBoxTitle: {
    fontSize: 12,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryBoxLine: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  confirmButtonFlex: {
    flex: 1,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontFamily: "NotoSans_700Bold",
    fontSize: 14,
  },

  // Presupuesto
  saveQuoteButton: {
    flex: 1,
    backgroundColor: "#0165FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  directBookingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#059669",
    backgroundColor: "#FFFFFF",
  },
  directBookingText: {
    fontFamily: "NotoSans_400Regular",
    color: "#059669",
    fontSize: 14,
  },
  directBookingHint: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAF3FF",
    borderWidth: 1,
    borderColor: "#7AB4FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  editBannerText: {
    fontFamily: "NotoSans_400Regular",
    flex: 1,
    fontSize: 13,
    color: "#030436",
  },
  editBannerLink: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 13,
    color: "#0165FF",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F8FAFC",
  },

  // Modal styles (native styling for NativeWind v4 compatibility)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
  },
  modalHeaderSub: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 11,
    color: "#64748B",
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  modalTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  typeTabActive: {
    backgroundColor: "#030436",
    borderColor: "#030436",
  },
  typeTabText: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "NotoSans_600SemiBold",
  },
  typeTabTextActive: {
    color: "#FFFFFF",
    fontFamily: "NotoSans_700Bold",
  },
  modalInputLabel: {
    fontSize: 11,
    fontFamily: "NotoSans_700Bold",
    color: "#030436",
    marginBottom: 3,
  },
  modalInput: {
    fontFamily: "NotoSans_400Regular",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#030436",
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  modalCancelButtonText: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#64748B",
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#030436",
    alignItems: "center",
  },
  modalSaveButtonText: {
    fontSize: 13,
    fontFamily: "NotoSans_700Bold",
    color: "#FFFFFF",
  },
});
