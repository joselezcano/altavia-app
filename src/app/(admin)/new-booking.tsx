import AirportPicker from "@/components/airport-picker";
import { grossFromNet } from "@/utils/flight-pricing";
import { CustomDatePicker } from "@/components/custom-date-picker";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useAllAircrafts } from "@/hooks/useAllAircrafts";
import { useClients, useCreateQuickClient } from "@/hooks/useClients";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { computeFlightQuote, DEFAULT_CRUISE_SPEED_KNOTS } from "@/utils/flight-pricing";
import { Airport, AircraftAvailability, AircraftReservation } from "@/types/all-roles";
import { QuickClientForm, QuickClientFormSchema } from "@/types/client";
import { BaseUser } from "@/types/user";
import { showNotice } from "@/utils/dialogs";
import { getDistanceBetweenAirports } from "@/utils/flight-distance";
import { roleFlightRoute, roleHomeRoute, toHref } from "@/utils/role-routes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
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

export default function NewBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, role, profileData } = useAuth();

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
  const [currentStep, setCurrentStep] = useState(1);

  // Form states: Client
  const [selectedClient, setSelectedClient] = useState<BaseUser | null>(null);
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
  const [originAirport, setOriginAirport] = useState<Airport | undefined>(undefined);
  const [destinationAirport, setDestinationAirport] = useState<Airport | undefined>(undefined);
  const [roundtrip, setRoundtrip] = useState(false);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [passengers, setPassengers] = useState(1);

  // Selected aircraft (pre-select first if only 1 exists)
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>("");

  React.useEffect(() => {
    if (aircrafts.length > 0 && !selectedAircraftId) {
      setSelectedAircraftId(aircrafts[0].id);
    }
  }, [aircrafts, selectedAircraftId]);

  const activeAircraft = useMemo(() => {
    return aircrafts.find((a) => a.id === selectedAircraftId) || aircrafts[0] || null;
  }, [aircrafts, selectedAircraftId]);

  // Calculations
  const distanceNm = useMemo(() => {
    return Math.round(getDistanceBetweenAirports(originAirport, destinationAirport, "nm"));
  }, [originAirport, destinationAirport]);

  const distanceKm = useMemo(() => {
    return Math.round(distanceNm * 1.852);
  }, [distanceNm]);

  const cruiseSpeed = activeAircraft?.operating_specs?.cruise_speed_knots || DEFAULT_CRUISE_SPEED_KNOTS;
  const flightDurationHours = distanceNm > 0 ? distanceNm / cruiseSpeed : 0;

  // Hangaraje por noche de ESTE vuelo (variable). Vacío = el de la tarifa de la aeronave.
  const [hangarInput, setHangarInput] = useState<string>("");

  // Cotización por hora: horas facturables (incluye reposicionamiento y regreso vacío) × tarifa + pernoctes.
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
        hangarPerNightOverrideUsd: hangarInput.trim() === "" ? null : parseFloat(hangarInput) || 0,
      }),
    [originAirport, destinationAirport, activeAircraft, roundtrip, departureDate, returnDate, cruiseSpeed, hangarInput]
  );

  const suggestedPrice = quote.totalUsd;

  // Editable final price
  const [finalPriceInput, setFinalPriceInput] = useState<string>("");
  const [userOverrodePrice, setUserOverrodePrice] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync suggested price if user has not manually overwritten it
  React.useEffect(() => {
    if (!userOverrodePrice && suggestedPrice > 0) {
      setFinalPriceInput(String(suggestedPrice));
    }
  }, [suggestedPrice, userOverrodePrice]);

  const effectivePriceNumber = parseFloat(finalPriceInput) || 0;
  const exchangeRateValue = exchangeRate?.dolar && exchangeRate.dolar > 0 ? exchangeRate.dolar : 0;
  // El equivalente en Gs es del TOTAL con IVA (lo que paga el cliente).
  const effectivePricePyg = Math.round(grossFromNet(effectivePriceNumber) * exchangeRateValue);

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

  // Submit Booking
  const handleCreateBooking = async () => {
    if (!selectedClient) {
      Alert.alert("Cliente Requerido", "Por favor selecciona o crea un cliente para la reserva.");
      setCurrentStep(1);
      return;
    }
    if (!originAirport || !destinationAirport) {
      Alert.alert("Ruta Incompleta", "Debes seleccionar aeropuerto de origen y destino.");
      setCurrentStep(2);
      return;
    }
    if (!departureDate) {
      Alert.alert("Fecha Requerida", "Debes seleccionar la fecha y hora de salida.");
      setCurrentStep(2);
      return;
    }
    if (roundtrip && !returnDate) {
      Alert.alert("Fecha de Retorno", "Marcaste vuelo de ida y vuelta. Selecciona la fecha de retorno.");
      setCurrentStep(2);
      return;
    }
    if (roundtrip && returnDate && returnDate <= departureDate) {
      Alert.alert("Fecha Inválida", "La fecha de retorno debe ser posterior a la de salida.");
      setCurrentStep(2);
      return;
    }
    if (!activeAircraft) {
      Alert.alert("Aeronave Requerida", "No hay una aeronave activa seleccionada.");
      return;
    }
    if (effectivePriceNumber <= 0) {
      Alert.alert("Precio Inválido", "Por favor ingresa un precio mayor a 0 para el vuelo.");
      return;
    }

    setIsSubmitting(true);
    try {
      const durationMs = (flightDurationHours || 1) * 3600 * 1000;
      const outboundStart = new Date(departureDate);
      const outboundEnd = new Date(outboundStart.getTime() + durationMs);

      // Pre-flight collision validation
      const checkResQuery = query(
        collection(db, "aircraft-reservation"),
        where("aircraftId", "==", activeAircraft.id)
      );
      const activeResSnap = await getDocs(checkResQuery);
      let isAlreadyBooked = false;

      for (const docSnap of activeResSnap.docs) {
        const d = docSnap.data();
        if (d.client_status === "canceled" || d.internal_status === "cancelled") continue;
        const existOutStart = d.schedule?.outbound_flight_departure_time?.toDate
          ? d.schedule.outbound_flight_departure_time.toDate()
          : new Date(d.schedule.outbound_flight_departure_time);
        const existOutEnd = d.schedule?.outbound_flight_arrival_time?.toDate
          ? d.schedule.outbound_flight_arrival_time.toDate()
          : new Date(d.schedule.outbound_flight_arrival_time);

        if (existOutStart && existOutEnd && !isNaN(existOutStart.getTime()) && !isNaN(existOutEnd.getTime())) {
          if (outboundStart.getTime() < existOutEnd.getTime() && outboundEnd.getTime() > existOutStart.getTime()) {
            isAlreadyBooked = true;
            break;
          }
        }
      }

      if (isAlreadyBooked) {
        Alert.alert(
          "Horario no disponible",
          "La aeronave ya cuenta con una reserva activa para ese horario. Modifica el horario de salida."
        );
        setIsSubmitting(false);
        return;
      }

      const eventIds: string[] = [];

      // 1. Availability Outbound
      const outboundEvent: AircraftAvailability = {
        aircraftId: activeAircraft.id,
        selected_date: outboundStart.toISOString().split("T")[0],
        start_time: `${String(outboundStart.getHours()).padStart(2, "0")}:${String(outboundStart.getMinutes()).padStart(2, "0")}`,
        end_time: `${String(outboundEnd.getHours()).padStart(2, "0")}:${String(outboundEnd.getMinutes()).padStart(2, "0")}`,
        start_timestamp: outboundStart,
        end_timestamp: outboundEnd,
        all_day: false,
        recurrence: {
          period: "none",
          interval: 1,
          days_of_week: [],
          ends: { type: "never", date: null, occurrences: 0 },
        },
        reason: "flight",
        notes: `Vuelo telefónico de ${originAirport.ident} a ${destinationAirport.ident}`,
      };
      const outboundDocRef = await addDoc(collection(db, "aircraft-availability"), outboundEvent);
      eventIds.push(outboundDocRef.id);

      // 2. Availability Return (if roundtrip)
      let returnStart: Date | null = null;
      let returnEnd: Date | null = null;
      if (roundtrip && returnDate) {
        returnStart = new Date(returnDate);
        returnEnd = new Date(returnStart.getTime() + durationMs);

        const returnEvent: AircraftAvailability = {
          aircraftId: activeAircraft.id,
          selected_date: returnStart.toISOString().split("T")[0],
          start_time: `${String(returnStart.getHours()).padStart(2, "0")}:${String(returnStart.getMinutes()).padStart(2, "0")}`,
          end_time: `${String(returnEnd.getHours()).padStart(2, "0")}:${String(returnEnd.getMinutes()).padStart(2, "0")}`,
          start_timestamp: returnStart,
          end_timestamp: returnEnd,
          all_day: false,
          recurrence: {
            period: "none",
            interval: 1,
            days_of_week: [],
            ends: { type: "never", date: null, occurrences: 0 },
          },
          reason: "flight",
          notes: `Retorno telefónico de ${destinationAirport.ident} a ${originAirport.ident}`,
        };
        const returnDocRef = await addDoc(collection(db, "aircraft-availability"), returnEvent);
        eventIds.push(returnDocRef.id);
      }

      // 3. Aircraft Reservation Document
      const reservationData: AircraftReservation = {
        aircraftId: activeAircraft.id,
        fa_flight_id: null,
        clientId: selectedClient.uid,
        // El precio acordado es sin IVA; la reserva guarda el total con IVA (lo que cobra Bancard).
        price: grossFromNet(effectivePriceNumber),
        price_net_usd: effectivePriceNumber,
        estimated_price: suggestedPrice,
        currency: "USD",
        distance_nm: distanceNm,
        cruise_speed_knots: cruiseSpeed,
        billable_hours: quote.billableHours,
        price_per_hour_usd: quote.pricePerHourUsd,
        overnight_nights: quote.nights,
        overnight_fee_usd: quote.overnightFeeUsd,
        hangar_per_night_usd: quote.hangarPerNightUsd,
        trip: {
          origin_airport_ident: originAirport.ident,
          origin_timezone: originAirport.timezone || "",
          destination_airport_ident: destinationAirport.ident,
          destination_timezone: destinationAirport.timezone || "",
        },
        schedule: {
          roundtrip,
          outbound_flight_departure_time: outboundStart,
          outbound_flight_arrival_time: outboundEnd,
          return_flight_departure_time: returnStart,
          return_flight_arrival_time: returnEnd,
        },
        capacity: {
          passangers: passengers,
        },
        event_ids: eventIds,
        client_status: "unpaid",
        internal_status: "pending_approval",
        status_notes: bookingNotes.trim()
          ? `Despacho telefónico. Notas: ${bookingNotes.trim()}`
          : "Reserva telefónica cargada por administración.",
        pilot_ids: [],
        created_at: new Date(),
      };

      const resDocRef = await addDoc(collection(db, "aircraft-reservation"), reservationData);

      await queryClient.invalidateQueries({ queryKey: ["all-reservations-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["available-aircrafts"] });
      await queryClient.invalidateQueries({ queryKey: ["aircraft-availability"] });

      Toast.show({
        type: "success",
        text1: "¡Reserva Creada Exitosamente!",
        text2: `Vuelo registrado para ${selectedClient.firstName} ${selectedClient.lastName}`,
      });

      // Rutas del grupo del rol activo (el admin no tiene assign-pilots: solo vuelve al inicio).
      const assignPilotsRoute = roleFlightRoute(role, "assign-pilots", { reservationId: resDocRef.id });
      Alert.alert(
        "Reserva Creada",
        assignPilotsRoute
          ? `La reserva fue registrada con éxito por USD ${effectivePriceNumber.toLocaleString("en-US")} + IVA (total USD ${grossFromNet(effectivePriceNumber).toLocaleString("en-US")}).\n\n¿Deseas asignar tripulación y aprobarla ahora?`
          : `La reserva fue registrada con éxito por USD ${effectivePriceNumber.toLocaleString("en-US")} + IVA (total USD ${grossFromNet(effectivePriceNumber).toLocaleString("en-US")}).`,
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
      console.error("Error al registrar reserva concierge:", error);
      Alert.alert("Error", error?.message || "No se pudo registrar la reserva.");
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
                  {step === 1 ? "Cliente" : step === 2 ? "Ruta" : "Tarifa"}
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
                  <Text style={styles.nextButtonText}>Continuar a Cotización</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: PRICING & CONFIRMATION */}
          {currentStep === 3 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="cash-outline" size={24} color="#030436" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>3. Cotización y Confirmación</Text>
                  <Text style={styles.cardSubtitle}>
                    Revisa el valor sugerido o modifica el precio final acordado.
                  </Text>
                </View>
              </View>

              {/* Suggested Price Card */}
              <View style={styles.priceCalculationBox}>
                {quote.legs.map((leg, idx) => (
                  <View
                    key={`${leg.from}-${leg.to}-${idx}`}
                    style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: idx === 0 ? 0 : 4 }}
                  >
                    <Text style={styles.priceSublabel}>
                      {leg.from} → {leg.to}
                      {leg.kind === "positioning" ? " (posicionamiento)" : leg.kind === "return_empty" ? " (regreso vacío)" : ""}
                    </Text>
                    <Text style={styles.priceSubvalue}>{leg.hours.toFixed(1)} h</Text>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <Text style={styles.priceSublabel}>
                    {quote.billableHours} h (factor de bloque {quote.blockFactor}) × tarifa por hora (sin IVA):
                  </Text>
                  <Text style={styles.priceSubvalue}>
                    {quote.hasPricing ? `USD $${quote.pricePerHourUsd.toLocaleString("en-US")}` : "Sin tarifa cargada"}
                  </Text>
                </View>
                {quote.nights > 0 && (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Text style={styles.priceSublabel}>
                        {quote.nights} {quote.nights === 1 ? "noche" : "noches"} × (pernocte USD ${quote.overnightFeeUsd} + hangaraje):
                      </Text>
                      <Text style={styles.priceSubvalue}>USD ${quote.overnightTotalUsd.toLocaleString("en-US")}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <Text style={styles.priceSublabel}>Hangaraje por noche (USD):</Text>
                      <TextInput
                        value={hangarInput}
                        onChangeText={(val) => setHangarInput(val.replace(/[^0-9.]/g, ""))}
                        placeholder={String(activeAircraft?.pricing?.hangarPerNightUsd ?? 0)}
                        keyboardType="numeric"
                        style={{ minWidth: 80, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, textAlign: "right" }}
                      />
                    </View>
                  </>
                )}
                {!quote.hasPricing && (
                  <Text style={[styles.priceSublabel, { marginTop: 6, color: "#B45309" }]}>
                    Esta aeronave no tiene tarifa por hora. Cargala en Contable → Ajustes, o escribí el precio final abajo.
                  </Text>
                )}
                <View style={styles.priceDivider} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.suggestedTitle}>Precio Sugerido por Sistema:</Text>
                  <Text style={styles.suggestedValue}>USD ${suggestedPrice.toLocaleString("en-US")}</Text>
                </View>
              </View>

              {/* Editable Final Price Input */}
              <View style={{ marginVertical: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <Text style={styles.inputLabelBold}>Precio Final Acordado (USD, sin IVA)</Text>
                  {userOverrodePrice && (
                    <TouchableOpacity
                      onPress={() => {
                        setUserOverrodePrice(false);
                        setFinalPriceInput(String(suggestedPrice));
                      }}
                    >
                      <Text style={styles.resetPriceText}>Restablecer sugerido</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.priceInputWrapper}>
                  <Text style={styles.priceCurrencySymbol}>$</Text>
                  <TextInput
                    value={finalPriceInput}
                    onChangeText={(val) => {
                      setUserOverrodePrice(true);
                      setFinalPriceInput(val.replace(/[^0-9.]/g, ""));
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                    style={styles.priceTextInput}
                  />
                  <Text style={styles.priceCurrencyBadge}>USD</Text>
                </View>

                {effectivePriceNumber > 0 && (
                  <Text style={styles.pygEquivalentText}>
                    Equivalente en Guaraníes: ₲ {effectivePricePyg.toLocaleString("es-PY")} (T.C. {exchangeRateValue.toLocaleString("es-PY")})
                  </Text>
                )}
              </View>

              {/* Notes */}
              <View style={{ marginVertical: 8 }}>
                <Text style={styles.inputLabel}>Notas de la Reserva (Opcional)</Text>
                <TextInput
                  value={bookingNotes}
                  onChangeText={setBookingNotes}
                  placeholder="Ej: Cliente solicitó catering especial o espera en pista..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  style={styles.notesTextInput}
                />
              </View>

              {/* Booking Summary Box */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxTitle}>Resumen del Vuelo</Text>
                <Text style={styles.summaryBoxLine}>
                  • <Text style={{ fontWeight: "bold" }}>Cliente:</Text> {selectedClient?.firstName} {selectedClient?.lastName} ({selectedClient?.phone || selectedClient?.email})
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

              {/* Submit CTA */}
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
                  onPress={handleCreateBooking}
                  style={[styles.confirmButtonFlex, isSubmitting && { opacity: 0.7 }]}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.confirmButtonText}>Crear Reserva</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
    fontWeight: "bold",
    color: "#64748B",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  stepLabelCurrent: {
    color: "#030436",
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: "#030436",
  },
  cardSubtitle: {
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
    fontWeight: "bold",
    fontSize: 16,
  },
  clientNameText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#030436",
  },
  clientSubText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  clientDocText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
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
    fontWeight: "600",
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
    fontWeight: "bold",
    fontSize: 13,
  },
  clientItemName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#030436",
  },
  clientItemSub: {
    fontSize: 11,
    color: "#64748B",
  },
  noClientsText: {
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
    fontWeight: "bold",
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
    fontWeight: "bold",
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
    fontWeight: "600",
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
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  aircraftBadgeSub: {
    fontSize: 11,
    color: "#CBD5E1",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#030436",
    marginBottom: 4,
  },
  inputLabelBold: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#030436",
  },
  distancePreviewBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  previewLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  previewValue: {
    fontSize: 11,
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: "#030436",
  },
  switchSub: {
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
    fontWeight: "bold",
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
    fontSize: 12,
    color: "#64748B",
  },
  priceSubvalue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#030436",
  },
  priceDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
  suggestedTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#030436",
  },
  suggestedValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0165FF",
  },
  resetPriceText: {
    fontSize: 11,
    color: "#00529B",
    fontWeight: "600",
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
    fontWeight: "bold",
    color: "#030436",
    marginRight: 6,
  },
  priceTextInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "bold",
    color: "#030436",
    paddingVertical: 10,
  },
  priceCurrencyBadge: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#94A3B8",
  },
  pygEquivalentText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 4,
  },
  notesTextInput: {
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
    fontWeight: "bold",
    color: "#030436",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryBoxLine: {
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
    fontWeight: "bold",
    fontSize: 14,
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
    fontWeight: "bold",
    color: "#030436",
  },
  modalHeaderSub: {
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
    fontWeight: "600",
  },
  typeTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#030436",
    marginBottom: 3,
  },
  modalInput: {
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
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
