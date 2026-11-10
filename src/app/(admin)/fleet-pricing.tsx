import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSaveAircraftSalePricing } from "@/hooks/useAircraftOperations";
import { AdminAircraftSpecsDoc, useAllAircrafts } from "@/hooks/useAllAircrafts";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Control de Flota: tarifa de venta POR HORA de cada aeronave (sin IVA; el cliente paga + IVA),
 * más pernocte y hangaraje por noche. Reemplaza la antigua tarifa por milla.
 * Es la misma configuración que el owner y la encargada ven en Contable → Ajustes.
 */
export default function FleetPricingScreen() {
  const { data: aircrafts = [], isLoading } = useAllAircrafts();
  const savePricing = useSaveAircraftSalePricing();

  const [selected, setSelected] = useState<AdminAircraftSpecsDoc | null>(null);
  const [tarifaInput, setTarifaInput] = useState("");
  const [pernocteInput, setPernocteInput] = useState("");
  const [hangarInput, setHangarInput] = useState("");
  const [factorInput, setFactorInput] = useState("");

  const openEditor = (aircraft: AdminAircraftSpecsDoc) => {
    setSelected(aircraft);
    setTarifaInput(aircraft.pricing?.pricePerHourUsd ? String(aircraft.pricing.pricePerHourUsd) : "");
    setPernocteInput(String(aircraft.pricing?.overnightFeeUsd ?? 100));
    setHangarInput(String(aircraft.pricing?.hangarPerNightUsd ?? 0));
    setFactorInput(String(aircraft.pricing?.blockFactor ?? 1.12));
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!selected.ownerId) {
      Alert.alert("Falta el propietario", "Esta aeronave no tiene propietario asignado: no se puede guardar su tarifa.");
      return;
    }
    const tarifa = parseFloat(tarifaInput);
    const pernocte = parseFloat(pernocteInput || "0");
    const hangar = parseFloat(hangarInput || "0");
    const factor = parseFloat(factorInput || "1.12");
    if (!Number.isFinite(factor) || factor < 1 || factor > 2) {
      Alert.alert("Factor inválido", "El factor de bloque va entre 1 y 2 (ej. 1.12 = +12%).");
      return;
    }
    if (!Number.isFinite(tarifa) || tarifa <= 0 || pernocte < 0 || hangar < 0 || !Number.isFinite(pernocte) || !Number.isFinite(hangar)) {
      Alert.alert("Datos inválidos", "Ingresá una tarifa por hora mayor a 0 y montos no negativos.");
      return;
    }
    try {
      await savePricing.mutateAsync({
        ownerId: selected.ownerId,
        aircraftId: selected.id,
        aircraftRegistration: selected.basic_specs.registration,
        aircraftModel: selected.basic_specs.model,
        tarifaHora: tarifa,
        pernocteUsd: pernocte,
        hangarNocheUsd: hangar,
        factorBloque: factor,
      });
      Alert.alert("Tarifa guardada", "El buscador la va a usar en unos segundos.");
      setSelected(null);
    } catch {
      Alert.alert("Error", "No se pudo guardar la tarifa.");
    }
  };

  const renderItem = ({ item }: { item: AdminAircraftSpecsDoc }) => {
    const p = item.pricing;
    return (
      <View style={styles.card}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <ThemedText className="font-bold text-brand-blue">
            {item.basic_specs.registration} · {item.basic_specs.model}
          </ThemedText>
          {p?.pricePerHourUsd ? (
            <Text style={styles.cardSub}>
              USD {p.pricePerHourUsd.toLocaleString("es-PY")} / hora · pernocte USD {p.overnightFeeUsd} · hangaraje USD {p.hangarPerNightUsd} / noche · factor de bloque {p.blockFactor ?? 1.12}
            </Text>
          ) : (
            <Text style={[styles.cardSub, { color: "#B45309" }]}>Sin tarifa por hora: el buscador la muestra "A cotizar".</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => openEditor(item)} style={styles.editBtn} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1 bg-brand-light">
      <View style={styles.header}>
        <ThemedText type="subtitle" className="text-brand-blue font-bold">
          Tarifas por hora de vuelo
        </ThemedText>
        <Text style={styles.headerSub}>
          Montos sin IVA (el cliente paga + IVA 10 %). Se cobran todas las horas voladas, incluido el regreso vacío a la base, más pernocte y hangaraje por cada noche fuera.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#030436" />
      ) : (
        <FlatList
          data={aircrafts}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          ListEmptyComponent={<Text style={styles.headerSub}>No hay aeronaves registradas.</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {selected?.basic_specs.registration} · {selected?.basic_specs.model}
            </Text>

            <Text style={styles.label}>Tarifa por hora (USD, sin IVA)</Text>
            <TextInput value={tarifaInput} onChangeText={setTarifaInput} keyboardType="decimal-pad" placeholder="1000" style={styles.input} />

            <Text style={styles.label}>Pernocte (USD por noche fuera de base)</Text>
            <TextInput value={pernocteInput} onChangeText={setPernocteInput} keyboardType="decimal-pad" placeholder="100" style={styles.input} />

            <Text style={styles.label}>Hangaraje por noche (USD, valor por defecto)</Text>
            <TextInput value={hangarInput} onChangeText={setHangarInput} keyboardType="decimal-pad" placeholder="0" style={styles.input} />

            <Text style={styles.label}>Factor de bloque (horas Hobbs ÷ horas en línea recta)</Text>
            <TextInput value={factorInput} onChangeText={setFactorInput} keyboardType="decimal-pad" placeholder="1.12" style={styles.input} />
            <Text style={styles.hint}>Cubre rodaje, ascenso y desvíos. 1.12 = las horas estimadas se multiplican por 1,12.</Text>

            <View style={{ flexDirection: "row", marginTop: 20, gap: 12 }}>
              <TouchableOpacity onPress={() => setSelected(null)} style={[styles.sheetBtn, styles.sheetBtnGhost]}>
                <Text style={styles.sheetBtnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.sheetBtn} disabled={savePricing.isPending}>
                {savePricing.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sheetBtnText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerSub: { color: "#64748B", fontSize: 13, marginTop: 4, lineHeight: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
  },
  cardSub: { color: "#64748B", fontSize: 12, marginTop: 4 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#030436",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  editBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#030436", marginBottom: 8 },
  hint: { fontSize: 11, color: "#64748B", marginTop: 4 },
  label: { fontSize: 13, color: "#334155", fontWeight: "600", marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#0F172A",
  },
  sheetBtn: { flex: 1, backgroundColor: "#030436", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  sheetBtnText: { color: "#FFFFFF", fontWeight: "700" },
  sheetBtnGhost: { backgroundColor: "#F1F5F9" },
  sheetBtnGhostText: { color: "#334155", fontWeight: "700" },
});
