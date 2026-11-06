import { db } from "@/config/firebase";
import { ClientReservationItem, DocumentType, PassengerManifestItem } from "@/types/all-roles";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { saveManifestPreservingBoarding } from "@/utils/boarding-pass";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

interface Props {
  visible: boolean;
  onClose: () => void;
  reservation: ClientReservationItem;
  onSaved?: () => void;
}

export function PassengerManifestModal({ visible, onClose, reservation, onSaved }: Props) {
  const queryClient = useQueryClient();

  const [passengers, setPassengers] = useState<PassengerManifestItem[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("CI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [nationality, setNationality] = useState("Paraguaya");
  const [weightKg, setWeightKg] = useState("75");
  const [luggageKg, setLuggageKg] = useState("10");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");

  // Sync initial passengers from reservation
  useEffect(() => {
    if (visible && reservation) {
      if (reservation.passengers && Array.isArray(reservation.passengers)) {
        setPassengers(reservation.passengers);
      } else {
        setPassengers([]);
      }
      setIsFormVisible(false);
      setEditingIndex(null);
      resetForm();
    }
  }, [visible, reservation]);

  const resetForm = () => {
    setFullName("");
    setDocumentType("CI");
    setDocumentNumber("");
    setNationality("Paraguaya");
    setWeightKg("75");
    setLuggageKg("10");
    setIsPrimary(passengers.length === 0);
    setNotes("");
    setEditingIndex(null);
  };

  const openAddForm = () => {
    resetForm();
    setIsPrimary(passengers.length === 0);
    setIsFormVisible(true);
  };

  const openEditForm = (index: number) => {
    const p = passengers[index];
    setFullName(p.fullName);
    setDocumentType(p.documentType);
    setDocumentNumber(p.documentNumber);
    setNationality(p.nationality || "Paraguaya");
    setWeightKg(String(p.weightKg ?? 75));
    setLuggageKg(String(p.luggageKg ?? 10));
    setIsPrimary(!!p.isPrimary);
    setNotes(p.notes || "");
    setEditingIndex(index);
    setIsFormVisible(true);
  };

  // Pre-fill passenger 1 from Client Profile
  const handleAutoFillFromClient = async () => {
    if (!reservation.clientId) {
      Alert.alert("Información", "Esta reserva no tiene un cliente vinculado directamente.");
      return;
    }
    setIsLoadingClient(true);
    try {
      // 1. Fetch user doc
      const userDocRef = doc(db, "users", reservation.clientId);
      const userSnap = await getDoc(userDocRef);
      // 2. Fetch client doc
      const clientDocRef = doc(db, "clients", reservation.clientId);
      const clientSnap = await getDoc(clientDocRef);

      const userData = userSnap.exists() ? userSnap.data() : null;
      const clientData = clientSnap.exists() ? clientSnap.data() : null;

      const name = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || clientData?.fullName || "";
      const docNum = clientData?.documentNumber || clientData?.ruc || userData?.ruc || "";
      const nat = clientData?.nationality || "Paraguaya";

      if (name) {
        setFullName(name);
        if (docNum) setDocumentNumber(docNum);
        setNationality(nat);
        setIsPrimary(true);
        setIsFormVisible(true);
        Toast.show({
          type: "info",
          text1: "Datos cargados",
          text2: `Pasajero precargado con datos de ${name}`,
        });
      } else {
        Alert.alert("Aviso", "No se encontraron datos completos en el perfil del cliente.");
      }
    } catch (e) {
      console.error("Error autofilling client for manifest:", e);
      Alert.alert("Error", "No se pudieron obtener los datos del cliente.");
    } finally {
      setIsLoadingClient(false);
    }
  };

  const handleSavePassenger = () => {
    if (!fullName.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el nombre y apellido del pasajero.");
      return;
    }
    if (!documentNumber.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el número de documento.");
      return;
    }

    const parsedWeight = parseFloat(weightKg) || 75;
    const parsedLuggage = parseFloat(luggageKg) || 0;

    const newPassenger: PassengerManifestItem = {
      // Al editar se conservan los datos de embarque (boardingToken, boardedAt, boardedBy).
      ...(editingIndex !== null ? passengers[editingIndex] : {}),
      id: editingIndex !== null ? passengers[editingIndex].id : `pax_${Date.now()}`,
      fullName: fullName.trim(),
      documentType,
      documentNumber: documentNumber.trim(),
      nationality: nationality.trim() || "Paraguaya",
      weightKg: parsedWeight,
      luggageKg: parsedLuggage,
      isPrimary,
      notes: notes.trim() || undefined,
    };

    let updatedList = [...passengers];
    if (editingIndex !== null) {
      updatedList[editingIndex] = newPassenger;
    } else {
      updatedList.push(newPassenger);
    }

    // If marked as primary, unmark others
    if (isPrimary) {
      updatedList = updatedList.map((p, idx) => {
        if (editingIndex !== null && idx === editingIndex) return p;
        if (editingIndex === null && idx === updatedList.length - 1) return p;
        return { ...p, isPrimary: false };
      });
    }

    setPassengers(updatedList);
    setIsFormVisible(false);
    resetForm();
  };

  const handleDeletePassenger = (index: number) => {
    Alert.alert(
      "Eliminar Pasajero",
      `¿Deseas quitar a ${passengers[index].fullName} del manifiesto?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            const updated = passengers.filter((_, i) => i !== index);
            setPassengers(updated);
          },
        },
      ]
    );
  };

  // Calculations for Weight & Balance
  const totalPaxWeight = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.weightKg || 0), 0);
  }, [passengers]);

  const totalLuggageWeight = useMemo(() => {
    return passengers.reduce((sum, p) => sum + (p.luggageKg || 0), 0);
  }, [passengers]);

  const totalPayloadKg = totalPaxWeight + totalLuggageWeight;
  const totalPayloadLbs = Math.round(totalPayloadKg * 2.20462);

  const capacitySeats = reservation.capacity?.passangers || 1;

  // Persist manifest to Cloud Firestore
  const handlePersistManifest = async () => {
    if (!reservation?.id) return;

    setIsSaving(true);
    try {
      // Transacción: conserva tokens de boarding pass y embarques registrados mientras el modal
      // estaba abierto, y genera el token de los pasajeros nuevos (ver src/utils/boarding-pass.ts).
      await saveManifestPreservingBoarding(reservation.id, passengers);

      // TanStack Query cache invalidations
      await queryClient.invalidateQueries({ queryKey: ["admin-all-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["pilot-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["owner-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["reservation-details", reservation.id] });
      await queryClient.invalidateQueries({ queryKey: ["boarding-passes", reservation.id] });

      Toast.show({
        type: "success",
        text1: "Manifiesto Guardado",
        text2: `${passengers.length} pasajeros registrados con éxito.`,
      });

      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      console.error("Error saving passenger manifest:", e);
      Alert.alert("Error", "No se pudo guardar el manifiesto de pasajeros en la reserva.");
    } finally {
      setIsSaving(false);
    }
  };

  // Share / Export formatted manifest text
  const handleShareManifest = async () => {
    if (passengers.length === 0) {
      Alert.alert("Manifiesto Vacío", "Agrega al menos un pasajero antes de exportar.");
      return;
    }

    const origin = reservation.trip?.origin_airport_ident || "ORIGEN";
    const dest = reservation.trip?.destination_airport_ident || "DESTINO";
    const dateStr = reservation.schedule?.outbound_flight_departure_time
      ? new Date(reservation.schedule.outbound_flight_departure_time).toLocaleDateString("es-PY", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "A confirmar";

    let text = `✈️ *MANIFIESTO DE PASAJEROS - ALTAVIA / DINAC*\n`;
    text += `*Vuelo:* ${origin} ➔ ${dest}\n`;
    text += `*Fecha/Hora:* ${dateStr}\n`;
    text += `*Reserva:* #${reservation.id.slice(0, 8).toUpperCase()}\n`;
    text += `*Total Pasajeros:* ${passengers.length} personas\n`;
    text += `*Carga Útil Total:* ${totalPayloadKg} kg (${totalPayloadLbs} lbs)\n`;
    text += `------------------------------------\n`;

    passengers.forEach((p, index) => {
      text += `*${index + 1}. ${p.fullName.toUpperCase()}* ${p.isPrimary ? "👑 (Titular)" : ""}\n`;
      text += `   • Doc: ${p.documentType} ${p.documentNumber}\n`;
      text += `   • Nacionalidad: ${p.nationality}\n`;
      text += `   • Peso: ${p.weightKg} kg | Equipaje: ${p.luggageKg} kg\n`;
      if (p.notes) {
        text += `   • Obs: ${p.notes}\n`;
      }
      text += `\n`;
    });

    try {
      await Share.share({
        message: text,
        title: `Manifiesto DINAC - ${origin} a ${dest}`,
      });
    } catch (e) {
      console.error("Error sharing manifest:", e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color="#030436" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerEyebrow}>Requisito Oficial DINAC</Text>
            <Text style={styles.headerTitle}>Manifiesto de Pasajeros</Text>
          </View>
          <TouchableOpacity onPress={handleShareManifest} style={styles.shareBtn} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={20} color="#030436" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Flight Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.flightRouteRow}>
              <View>
                <Text style={styles.routeCode}>{reservation.trip?.origin_airport_ident || "ORIG"}</Text>
                <Text style={styles.routeCity}>Origen</Text>
              </View>
              <View style={styles.planeIconWrap}>
                <Ionicons name="airplane" size={18} color="#0165FF" />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.routeCode}>{reservation.trip?.destination_airport_ident || "DEST"}</Text>
                <Text style={styles.routeCity}>Destino</Text>
              </View>
            </View>

            {/* Weight & Balance Metrics Bar */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Pasajeros</Text>
                <Text style={[styles.metricValue, passengers.length > capacitySeats ? styles.metricAlert : null]}>
                  {passengers.length} / {capacitySeats}
                </Text>
                <Text style={styles.metricSub}>Cupos sol.</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Peso Pasajeros</Text>
                <Text style={styles.metricValue}>{totalPaxWeight} kg</Text>
                <Text style={styles.metricSub}>Masa corporal</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Equipaje</Text>
                <Text style={styles.metricValue}>{totalLuggageWeight} kg</Text>
                <Text style={styles.metricSub}>Maletas / Carga</Text>
              </View>

              <View style={styles.metricBoxHighlight}>
                <Text style={styles.metricLabelHighlight}>Carga Útil</Text>
                <Text style={styles.metricValueHighlight}>{totalPayloadKg} kg</Text>
                <Text style={styles.metricSubHighlight}>{totalPayloadLbs} lbs</Text>
              </View>
            </View>
          </View>

          {/* Action Toolbar */}
          <View style={styles.actionToolbar}>
            <TouchableOpacity onPress={openAddForm} style={styles.addPaxBtn} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.addPaxBtnText}>Agregar Pasajero</Text>
            </TouchableOpacity>

            {reservation.clientId && (
              <TouchableOpacity
                onPress={handleAutoFillFromClient}
                disabled={isLoadingClient}
                style={styles.autoFillBtn}
                activeOpacity={0.8}
              >
                {isLoadingClient ? (
                  <ActivityIndicator size="small" color="#030436" />
                ) : (
                  <>
                    <Ionicons name="copy-outline" size={16} color="#030436" />
                    <Text style={styles.autoFillBtnText}>Cargar Titular</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Passenger Form (Add / Edit) */}
          {isFormVisible && (
            <View style={styles.formContainer}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                  {editingIndex !== null ? "Editar Pasajero" : "Nuevo Pasajero DINAC"}
                </Text>
                <TouchableOpacity onPress={() => setIsFormVisible(false)}>
                  <Ionicons name="close-circle-outline" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Full Name */}
              <Text style={styles.inputLabel}>Nombre y Apellido Completo *</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Ej. Juan Pérez González"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />

              {/* Document Type Selector */}
              <Text style={styles.inputLabel}>Tipo de Documento *</Text>
              <View style={styles.docTypeRow}>
                {(["CI", "PASSPORT", "DNI", "OTHER"] as DocumentType[]).map((type) => {
                  const isSelected = documentType === type;
                  const labelMap: Record<DocumentType, string> = {
                    CI: "Cédula (CI)",
                    PASSPORT: "Pasaporte",
                    DNI: "DNI",
                    OTHER: "Otro",
                  };
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setDocumentType(type)}
                      style={[styles.docTypeBtn, isSelected && styles.docTypeBtnActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.docTypeBtnText, isSelected && styles.docTypeBtnTextActive]}>
                        {labelMap[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Document Number & Nationality */}
              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>N° Documento *</Text>
                  <TextInput
                    value={documentNumber}
                    onChangeText={setDocumentNumber}
                    placeholder="Ej. 4.123.456"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Nacionalidad</Text>
                  <TextInput
                    value={nationality}
                    onChangeText={setNationality}
                    placeholder="Ej. Paraguaya"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Weight & Luggage (Weight & Balance) */}
              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Peso Pasajero (kg) *</Text>
                  <TextInput
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="75"
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Equipaje (kg)</Text>
                  <TextInput
                    value={luggageKg}
                    onChangeText={setLuggageKg}
                    placeholder="10"
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Primary Contact Toggle */}
              <TouchableOpacity
                onPress={() => setIsPrimary(!isPrimary)}
                style={styles.primaryToggle}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isPrimary ? "checkbox" : "square-outline"}
                  size={20}
                  color={isPrimary ? "#030436" : "#64748B"}
                />
                <Text style={styles.primaryToggleText}>Pasajero Titular / Contacto del Vuelo</Text>
              </TouchableOpacity>

              {/* Notes */}
              <Text style={styles.inputLabel}>Observaciones / Requisitos especiales</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ej. Menor de edad, asistencia de movilidad, etc."
                placeholderTextColor="#94A3B8"
                style={[styles.textInput, { height: 60, textAlignVertical: "top" }]}
                multiline
              />

              {/* Form Buttons */}
              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  onPress={() => setIsFormVisible(false)}
                  style={styles.cancelFormBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelFormBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSavePassenger}
                  style={styles.savePaxBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.savePaxBtnText}>
                    {editingIndex !== null ? "Actualizar" : "Agregar a Lista"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Passenger List */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>Pasajeros a Bordo ({passengers.length})</Text>
            {passengers.length > capacitySeats && (
              <Text style={styles.capacityWarning}>⚠️ Supera cupos solicitados ({capacitySeats})</Text>
            )}
          </View>

          {passengers.length === 0 ? (
            <View style={styles.emptyList}>
              <Ionicons name="people-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyListTitle}>Aún no hay pasajeros en el manifiesto</Text>
              <Text style={styles.emptyListSub}>
                DINAC exige registrar a todos los pasajeros y sus pesos antes de autorizar el despegue.
              </Text>
              <TouchableOpacity onPress={openAddForm} style={styles.emptyAddBtn} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={18} color="#030436" />
                <Text style={styles.emptyAddBtnText}>Cargar Primer Pasajero</Text>
              </TouchableOpacity>
            </View>
          ) : (
            passengers.map((p, index) => (
              <View key={p.id || index} style={styles.paxCard}>
                <View style={styles.paxCardLeft}>
                  <View style={styles.paxAvatar}>
                    <Text style={styles.paxAvatarText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.paxNameRow}>
                      <Text style={styles.paxName}>{p.fullName}</Text>
                      {p.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Titular</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.paxDoc}>
                      {p.documentType}: {p.documentNumber} • {p.nationality}
                    </Text>
                    <Text style={styles.paxWeights}>
                      ⚖️ Pasajero: {p.weightKg} kg  |  🧳 Equipaje: {p.luggageKg} kg
                    </Text>
                    {p.notes ? <Text style={styles.paxNotes}>📝 {p.notes}</Text> : null}
                  </View>
                </View>

                {/* Card Actions */}
                <View style={styles.paxCardActions}>
                  <TouchableOpacity onPress={() => openEditForm(index)} style={styles.iconBtn}>
                    <Ionicons name="pencil-outline" size={18} color="#030436" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeletePassenger(index)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color="#E11D48" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Bottom Persistent Save Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={handlePersistManifest}
            disabled={isSaving}
            style={styles.persistBtn}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.persistBtnText}>
                  Guardar Manifiesto en Reserva ({passengers.length} Pasajeros)
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontSize: 10,
    color: "#0165FF",
    fontWeight: "bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#030436",
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  flightRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 12,
  },
  routeCode: {
    fontSize: 18,
    fontWeight: "800",
    color: "#030436",
  },
  routeCity: {
    fontSize: 11,
    color: "#64748B",
  },
  planeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FDF8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  metricBoxHighlight: {
    flex: 1.1,
    alignItems: "center",
    backgroundColor: "#030436",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748B",
    marginBottom: 2,
    textAlign: "center",
  },
  metricLabelHighlight: {
    fontSize: 10,
    color: "#0165FF",
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "center",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#030436",
  },
  metricAlert: {
    color: "#E11D48",
  },
  metricValueHighlight: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricSub: {
    fontSize: 9,
    color: "#94A3B8",
    marginTop: 1,
  },
  metricSubHighlight: {
    fontSize: 9,
    color: "#94A3B8",
    marginTop: 1,
  },
  actionToolbar: {
    flexDirection: "row",
    marginBottom: 16,
  },
  addPaxBtn: {
    flex: 1,
    backgroundColor: "#030436",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
  },
  addPaxBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  autoFillBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  autoFillBtnText: {
    color: "#030436",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 16,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#030436",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#030436",
  },
  docTypeRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  docTypeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  docTypeBtnActive: {
    backgroundColor: "#030436",
    borderColor: "#030436",
  },
  docTypeBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  docTypeBtnTextActive: {
    color: "#FFFFFF",
  },
  twoColRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  primaryToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#030436",
    marginLeft: 6,
  },
  formBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  cancelFormBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  cancelFormBtnText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  savePaxBtn: {
    backgroundColor: "#0165FF",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  savePaxBtnText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
    marginLeft: 4,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#030436",
  },
  capacityWarning: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E11D48",
  },
  emptyList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyListTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#030436",
    marginTop: 8,
  },
  emptyListSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#030436",
    marginLeft: 6,
  },
  paxCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  paxCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  paxAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  paxAvatarText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#030436",
  },
  paxNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  paxName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#030436",
    marginRight: 6,
  },
  primaryBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#92400E",
  },
  paxDoc: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  paxWeights: {
    fontSize: 11,
    color: "#030436",
    fontWeight: "600",
    marginTop: 3,
  },
  paxNotes: {
    fontSize: 10,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 2,
  },
  paxCardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  iconBtn: {
    padding: 6,
    marginLeft: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  persistBtn: {
    backgroundColor: "#030436",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  persistBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
});
