import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

// OACI / Spec Translations & Descriptions

const FLIGHT_RULES_MAP: Record<string, string> = {
  IFR: "IFR (Reglas de Vuelo por Instrumentos)",
  VFR: "VFR (Reglas de Vuelo Visual)",
  Y: "Y (IFR primero, luego VFR)",
  Z: "Z (VFR primero, luego IFR)",
};

const WAKE_TURBULENCE_MAP: Record<string, string> = {
  L: "L (Ligera - ≤ 7,000 kg)",
  M: "M (Media - 7,000 a 136,000 kg)",
  H: "H (Pesada - ≥ 136,000 kg)",
  J: "J (Super - Airbus A380-800)",
};

const TRANSPONDER_MAP: Record<string, string> = {
  A: "Modo A (sin altitud)",
  C: "Modo A/C (con altitud de presión)",
  S: "Modo S (altitud e identificación)",
  E: "Modo S con Extended Squitter (ADS-B Out)",
  H: "Modo S con Enhanced Surveillance",
  L: "Modo S con Enhanced Surveillance & Extended Squitter (ADS-B Out)",
  I: "Modo S con ACID (sin altitud de presión)",
  P: "Modo S con altitud de presión (sin ACID)",
  X: "Modo S sin ACID ni altitud de presión",
};

const EQUIPMENT_MAP: Record<string, string> = {
  D: "DME instalado",
  F: "ADF instalado",
  G: "GNSS instalado",
  I: "ILS instalado",
  O: "VOR / Örn instalado",
  P: "TACAN instalado",
  R: "Radioaltímetro instalado",
  S: "Transponder Modo S instalado",
  T: "Transponder Modo A/C instalado",
  U: "SSR Transponder Modo S instalado",
  X: "Transponder Modo X instalado",
  Z: "Sin ADS-B Out",
};

const RADIO_EQUIPMENT_MAP: Record<string, string> = {
  N: "Nil (Ningún equipo)",
  S: "Estándar (VHF, VOR e ILS)",
  V: "VHF RTF (Voz VHF estándar)",
  Y: "VHF espaciado 8.33 kHz (Obligatorio en Europa)",
  H: "HF RTF (Voz HF para rutas de larga distancia)",
  U: "UHF RTF (Frecuencia militar UHF)",
  Z: "Otro equipo (Ver detalles en Item 18)",
  J1: "CPDLC ATN VDL Modo 2",
  J2: "CPDLC FANS 1/A HFDL",
  J3: "CPDLC FANS 1/A VDL Modo A",
  J4: "CPDLC FANS 1/A VDL Modo 2",
  J5: "CPDLC FANS 1/A SATCOM (Inmarsat)",
  J6: "CPDLC FANS 1/A SATCOM (MTSAT)",
  J7: "CPDLC FANS 1/A SATCOM (Iridium)",
  M1: "ATC Satvoice via Inmarsat",
  M2: "ATC Satvoice via MTSAT",
  M3: "ATC Satvoice via Iridium",
};

const SURVIVAL_EQUIPMENT_MAP: Record<string, string> = {
  P: "Polar (Clima ártico/nieve)",
  D: "Desert (Desierto y alta temperatura)",
  M: "Maritime (Marítimo y mar abierto)",
  J: "Jungle (Selva y vegetación densa)",
};

const LIFE_JACKETS_MAP: Record<string, string> = {
  L: "Luz de localización (Light)",
  F: "Fluoresceína (Marcador de color)",
  U: "Radio baliza UHF",
  V: "Radio transmisor VHF",
};

// Helper details row component
const DetailRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex-row justify-between py-2.5 border-b border-slate-100 items-start">
      <ThemedText type="caption" className="text-slate-500 font-medium mr-4">
        {label}
      </ThemedText>
      <ThemedText className="font-semibold text-slate-700 text-right flex-1">
        {value}
      </ThemedText>
    </View>
  );
};

// Helper badge list renderer component
const BadgesList = ({
  label,
  items,
  map,
}: {
  label: string;
  items: string[] | undefined;
  map: Record<string, string>;
}) => {
  const hasItems = items && items.length > 0;
  return (
    <View className="py-2.5 border-b border-slate-100">
      <ThemedText type="caption" className="text-slate-500 font-medium mb-1.5">
        {label}
      </ThemedText>
      {hasItems ? (
        <View className="flex-row flex-wrap gap-1.5 mt-0.5">
          {items.map((item) => (
            <View
              key={item}
              className="bg-slate-100 border border-slate-200/65 px-2.5 py-1 rounded-md"
            >
              <ThemedText className="text-xs font-semibold text-slate-700">
                {item} - {map[item] || item}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : (
        <ThemedText className="font-semibold text-slate-400 italic">
          Ninguno
        </ThemedText>
      )}
    </View>
  );
};

export default function AircraftDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [aircraft, setAircraft] = useState<AircraftSpecs | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(
    id ? null : "No se especificó un identificador de aeronave."
  );

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, "AircraftSpecs", id);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setAircraft(docSnap.data() as AircraftSpecs);
        } else {
          setError("La aeronave no existe o ha sido eliminada.");
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching aircraft specs:", err);
        setError("Error al recuperar los datos de la aeronave.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Helper functions for displaying empty values for optional fields cleanly
  const formatValue = (val: string | number | undefined | null) => {
    return val !== undefined && val !== null ? String(val) : "";
  };

  const formatUnit = (val: number | undefined | null, unit: string) => {
    return val !== undefined && val !== null ? `${val} ${unit}` : "";
  };

  const formatBoolean = (val: boolean | undefined | null) => {
    if (val === true) return "Sí";
    if (val === false) return "No";
    return "";
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0f1e3d" />
        <ThemedText className="text-slate-500 mt-2">
          Cargando especificaciones...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !aircraft) {
    return (
      <ThemedView className="flex-1 px-4 justify-center items-center">
        <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={36} color="#EF4444" />
        </View>
        <ThemedText type="subtitle" className="text-center text-slate-800 mb-2">
          Ocurrió un error
        </ThemedText>
        <ThemedText type="caption" className="text-center text-slate-500 mb-6">
          {error || "No se pudieron obtener los detalles de la aeronave."}
        </ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-brand-blue px-6 py-2.5 rounded-xl flex-row items-center gap-2"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <ThemedText className="text-white font-semibold">Regresar</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const { basic_specs, technical_specs, operating_specs, emergency, notes } =
    aircraft;

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center p-1"
        >
          <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
          <ThemedText className="font-semibold text-brand-blue ml-1">
            Volver
          </ThemedText>
        </TouchableOpacity>
        <ThemedText className="font-bold text-brand-blue text-lg">
          Detalle de Aeronave
        </ThemedText>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Title Section Card */}
        <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center">
          <View className="flex-1 mr-4">
            <ThemedText className="font-bold text-2xl text-white">
              {basic_specs.model}
            </ThemedText>
            <View className="flex-row items-center gap-2 mt-1.5">
              <View className="bg-white/15 px-2 py-0.5 rounded">
                <ThemedText
                  type="caption"
                  className="text-[10px] font-bold text-white uppercase tracking-wider"
                >
                  {basic_specs.type}
                </ThemedText>
              </View>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: "/aircraft-calendar",
                  params: {
                    id,
                    model: basic_specs.model,
                    registration: basic_specs.registration,
                  },
                });
              }}
              className="bg-white/10 w-10 h-10 rounded-full items-center justify-center border border-white/10"
              activeOpacity={0.7}
            >
              <Ionicons name="calendar" size={20} color="#C5A059" />
            </TouchableOpacity>

            <View className="bg-brand-gold px-4 py-1.5 rounded-full">
              <ThemedText className="text-brand-blue text-sm font-bold uppercase tracking-wider">
                {basic_specs.registration}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* 1. Basic Specs Card */}
        <ThemedView
          variant="card"
          className="p-5 mb-4 border border-slate-100"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="information-circle" size={20} color="#0f1e3d" />
            <ThemedText type="subtitle" className="font-bold text-brand-blue">
              Especificaciones Básicas
            </ThemedText>
          </View>
          <DetailRow label="Modelo" value={formatValue(basic_specs.model)} />
          <DetailRow label="Tipo (ICAO)" value={formatValue(basic_specs.type)} />
          <DetailRow
            label="Matrícula"
            value={formatValue(basic_specs.registration)}
          />
          <DetailRow
            label="Capacidad POB (Pax + Tripulación)"
            value={formatUnit(basic_specs.pax_count, "personas")}
          />
        </ThemedView>

        {/* 2. Technical Specs Card */}
        <ThemedView
          variant="card"
          className="p-5 mb-4 border border-slate-100"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="settings" size={20} color="#0f1e3d" />
            <ThemedText type="subtitle" className="font-bold text-brand-blue">
              Especificaciones Técnicas
            </ThemedText>
          </View>
          <DetailRow
            label="Reglas de Vuelo"
            value={
              technical_specs.flight_rules
                ? FLIGHT_RULES_MAP[technical_specs.flight_rules] ||
                  technical_specs.flight_rules
                : ""
            }
          />
          <DetailRow
            label="Estela Turbulenta"
            value={
              technical_specs.wake_turbulence_category
                ? WAKE_TURBULENCE_MAP[technical_specs.wake_turbulence_category] ||
                  technical_specs.wake_turbulence_category
                : ""
            }
          />
          <DetailRow
            label="Capacidad Combustible Usable"
            value={formatUnit(technical_specs.fuel_capacity_gallons, "Galones")}
          />
          <DetailRow
            label="Transpondedor"
            value={
              technical_specs.transponder
                ? TRANSPONDER_MAP[technical_specs.transponder] ||
                  technical_specs.transponder
                : ""
            }
          />
          <BadgesList
            label="Equipamiento OACI"
            items={technical_specs.equipment}
            map={EQUIPMENT_MAP}
          />
        </ThemedView>

        {/* 3. Operating/Performance Specs Card */}
        <ThemedView
          variant="card"
          className="p-5 mb-4 border border-slate-100"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="speedometer" size={20} color="#0f1e3d" />
            <ThemedText type="subtitle" className="font-bold text-brand-blue">
              Rendimiento y Operación
            </ThemedText>
          </View>
          <DetailRow
            label="Velocidad de Crucero"
            value={formatUnit(operating_specs.cruise_speed_knots, "Nudos (TAS)")}
          />
          <DetailRow
            label="Consumo de Combustible"
            value={formatUnit(operating_specs.fuel_burn_rate_gph, "GPH (Galones por Hora)")}
          />
          <DetailRow
            label="Techo de Servicio"
            value={formatUnit(operating_specs.service_ceiling_feet, "Pies (Altitud Máxima)")}
          />
          <DetailRow
            label="Peso Máximo de Despegue (MTOW)"
            value={formatUnit(operating_specs.max_takeoff_weight_lbs, "Libras")}
          />
          <DetailRow
            label="Carrera de Despegue Requerida"
            value={formatUnit(operating_specs.takeoff_distance_feet, "Pies")}
          />
          <DetailRow
            label="Distancia de Aterrizaje Requerida"
            value={formatUnit(operating_specs.landing_distance_feet, "Pies")}
          />
          <DetailRow
            label="Régimen de Ascenso"
            value={formatUnit(operating_specs.rate_of_climb_fpm, "FPM (Pies por Minuto)")}
          />
        </ThemedView>

        {/* 4. Emergency Card */}
        <ThemedView
          variant="card"
          className="p-5 mb-4 border border-slate-100"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="medical" size={20} color="#0f1e3d" />
            <ThemedText type="subtitle" className="font-bold text-brand-blue">
              Seguridad y Emergencia
            </ThemedText>
          </View>

          <BadgesList
            label="Equipamiento de Radio"
            items={emergency.radio_equipment}
            map={RADIO_EQUIPMENT_MAP}
          />
          <BadgesList
            label="Equipamiento de Supervivencia"
            items={emergency.survival_equipment}
            map={SURVIVAL_EQUIPMENT_MAP}
          />
          <BadgesList
            label="Chalecos Salvavidas"
            items={emergency.life_jacket_equipment}
            map={LIFE_JACKETS_MAP}
          />

          <View className="mt-4 pt-3 border-t border-slate-100">
            <ThemedText type="caption" className="font-bold text-brand-blue mb-2.5">
              Balsas Salvavidas (Dinghies)
            </ThemedText>
            <DetailRow
              label="Lleva Balsas"
              value={formatBoolean(emergency.dinghies_capacity.carried)}
            />
            {emergency.dinghies_capacity.carried && (
              <>
                <DetailRow
                  label="Cantidad de Balsas"
                  value={formatValue(emergency.dinghies_capacity.number)}
                />
                <DetailRow
                  label="Capacidad Total"
                  value={formatUnit(
                    emergency.dinghies_capacity.total_capacity,
                    "personas"
                  )}
                />
                <DetailRow
                  label="Tienen Cubierta"
                  value={formatBoolean(emergency.dinghies_capacity.covered)}
                />
                <DetailRow
                  label="Color de las Balsas"
                  value={formatValue(emergency.dinghies_capacity.color)}
                />
              </>
            )}
          </View>
        </ThemedView>

        {/* 5. Notes/Observations Card */}
        <ThemedView
          variant="card"
          className="p-5 mb-6 border border-slate-100"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="document-text" size={20} color="#0f1e3d" />
            <ThemedText type="subtitle" className="font-bold text-brand-blue">
              Observaciones y Notas
            </ThemedText>
          </View>
          {notes ? (
            <ThemedText className="text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
              &quot;{notes}&quot;
            </ThemedText>
          ) : (
            <ThemedText className="text-slate-400 italic text-center py-2">
              Sin observaciones registradas.
            </ThemedText>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
