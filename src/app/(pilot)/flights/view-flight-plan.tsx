import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useFlightPlanByReservation } from "@/hooks/useFlightPlanByReservation";
import { useFlightPlanDetails } from "@/hooks/useFlightPlanDetails";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex-row justify-between py-2.5 border-b border-slate-100 items-start">
      <ThemedText type="caption" className="text-slate-500 font-medium mr-4">
        {label}
      </ThemedText>
      <ThemedText className="font-semibold text-slate-700 text-right flex-1">
        {value || "-"}
      </ThemedText>
    </View>
  );
};

const BadgesList = ({
  label,
  items,
}: {
  label: string;
  items: string[] | string | undefined | null;
}) => {
  const list = Array.isArray(items)
    ? items
    : typeof items === "string" && items.trim() !== ""
      ? items.split(/[\s,]+/).filter(Boolean)
      : [];

  const hasItems = list.length > 0;
  return (
    <View className="py-2.5 border-b border-slate-100">
      <ThemedText type="caption" className="text-slate-500 font-medium mb-1.5">
        {label}
      </ThemedText>
      {hasItems ? (
        <View className="flex-row flex-wrap gap-1.5 mt-0.5">
          {list.map((item, idx) => (
            <View
              key={`${item}-${idx}`}
              className="bg-slate-100 border border-slate-200/65 px-2.5 py-1 rounded-md"
            >
              <ThemedText className="text-xs font-semibold text-slate-700">
                {String(item)}
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

export default function ViewFlightPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    flightPlanId?: string;
    reservationId?: string;
    aircraftModel?: string;
  }>();

  const { data: planById, isLoading: isLoadingById } = useFlightPlanDetails(params.flightPlanId);
  const { data: planByRes, isLoading: isLoadingByRes } = useFlightPlanByReservation(
    params.flightPlanId ? undefined : params.reservationId
  );

  const plan = planById || planByRes;
  const isLoading = isLoadingById || isLoadingByRes;

  const handleEdit = () => {
    if (!plan) return;
    router.push({
      pathname: "/flights/create-flight-plan",
      params: {
        flightPlanId: plan.id,
        reservationId: plan.aircraft_reservation_id || params.reservationId || "",
      },
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Approved":
        return { label: "Aprobado", bg: "bg-emerald-50 border-emerald-200 text-emerald-700" };
      case "Updated":
        return { label: "Actualizado", bg: "bg-blue-50 border-blue-200 text-blue-700" };
      case "New":
        return { label: "Nuevo", bg: "bg-amber-50 border-amber-200 text-amber-700" };
      default:
        return { label: status || "Borrador", bg: "bg-lime-50 border-lime-200 text-lime-700" };
    }
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(pilot)/flights");
            }
          }}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 shadow-sm"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#0f1e3d" />
        </TouchableOpacity>
        <View className="items-center">
          <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[10px]">
            Plan de Vuelo Registrado
          </ThemedText>
          <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
            Detalles del Plan
          </ThemedText>
        </View>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {isLoading ? (
          <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
            <ActivityIndicator size="large" color="#0f1e3d" />
            <ThemedText className="text-slate-500 font-medium mt-3 text-center text-sm">
              Cargando plan de vuelo...
            </ThemedText>
          </View>
        ) : !plan ? (
          <View className="bg-brand-white rounded-3xl p-8 border border-slate-200 items-center justify-center my-6 shadow-sm">
            <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center mb-4 border border-rose-100">
              <Ionicons name="alert-circle-outline" size={32} color="#e11d48" />
            </View>
            <ThemedText type="subtitle" className="text-center text-slate-800 text-lg">
              Plan de Vuelo No Encontrado
            </ThemedText>
            <ThemedText className="text-slate-500 text-xs text-center mt-1 mb-6 px-4">
              No fue posible recuperar la información de este plan de vuelo.
            </ThemedText>
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-brand-blue px-5 py-3 rounded-xl flex-row items-center gap-2 shadow-md"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
              <ThemedText className="text-sm font-bold text-white">Volver</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (() => {
          const status = getStatusBadge(plan.status);
          const fp = plan.flight_plan;
          const ac = fp?.aircraft;
          const fd = fp?.flight_details;
          const dep = fp?.departure;
          const arr = fp?.arrival;
          const rt = fp?.route;
          const perf = fp?.performance;
          const em = fp?.emergency;
          const plt = fp?.pilot;

          return (
            <View className="gap-4 mb-24">
              {/* Header Status Card */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm flex-row items-center justify-between">
                <View>
                  <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg">
                    {dep?.icao || "N/A"} ➔ {arr?.icao || "N/A"}
                  </ThemedText>
                  <ThemedText type="caption" className="text-slate-500 text-xs mt-0.5 font-medium">
                    {params.aircraftModel || `Callsign: ${fd?.callsign}` || `${ac?.registration}` || "N/A"}
                  </ThemedText>
                </View>
                <View className={`px-3 py-1 rounded-full border ${status.bg}`}>
                  <ThemedText className="text-xs font-bold">
                    {status.label}
                  </ThemedText>
                </View>
              </View>

              {/* 1. Aeronave y Detalles del Vuelo */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <MaterialCommunityIcons name="airplane" size={20} color="#0f1e3d" />
                  <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Aeronave y Vuelo
                  </ThemedText>
                </View>
                <DetailRow label="Matrícula" value={ac?.registration || ""} />
                <DetailRow label="Tipo de Aeronave" value={ac?.type || ""} />
                <DetailRow label="Estela Turbulenta" value={ac?.wake_turbulence || ""} />
                <DetailRow label="Transpondedor" value={ac?.transponder || ""} />
                <BadgesList label="Equipamiento" items={ac?.equipment} />
                <DetailRow label="Callsign" value={fd?.callsign || ""} />
                <DetailRow label="Reglas de Vuelo" value={fd?.flight_rules || ""} />
                <DetailRow label="Tipo de Vuelo" value={fd?.flight_type || ""} />
              </View>

              {/* 2. Aeropuertos y Horarios */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <Ionicons name="time-outline" size={20} color="#0f1e3d" />
                  <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Aeropuertos y Horarios
                  </ThemedText>
                </View>
                <DetailRow label="Origen (OACI)" value={dep?.icao || ""} />
                <DetailRow label="Fecha de Salida (UTC)" value={dep?.datetime_utc.split('T')[0] || ""} />
                <DetailRow label="Hora de Salida (UTC)" value={dep?.datetime_utc.split('T')[1].split('Z')[0].split('.')[0] || ""} />
                <DetailRow label="Fuera de Calzos (UTC)" value={dep?.off_block_time ? `${dep.off_block_time} (HHMM)` : ""} />
                <DetailRow label="Destino (OACI)" value={arr?.icao || ""} />
                <DetailRow label="Fecha de Llegada (UTC)" value={arr?.datetime_utc.split('T')[0] || ""} />
                <DetailRow label="Hora de Llegada (UTC)" value={arr?.datetime_utc.split('T')[1].split('Z')[0].split('.')[0] || ""} />
                <DetailRow label="Alternativo (OACI)" value={arr?.alternate_icao || "N/A"} />
              </View>

              {/* 3. Ruta y Rendimiento */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <Ionicons name="navigate-outline" size={20} color="#0f1e3d" />
                  <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Ruta y Rendimiento
                  </ThemedText>
                </View>
                <DetailRow
                  label="Velocidad de Crucero"
                  value={rt?.cruising_speed_knots ? `${rt.cruising_speed_knots} nudos` : ""}
                />
                <DetailRow
                  label="Altitud de Crucero"
                  value={rt?.cruising_altitude_feet ? `${rt.cruising_altitude_feet} pies` : ""}
                />
                <BadgesList label="Puntos de Ruta" items={rt?.waypoints} />
                <BadgesList label="Ruta Codificada" items={rt?.encoded_route} />
                <DetailRow
                  label="Tiempo Estimado (EET)"
                  value={`${perf?.eet_hours || 0}h ${perf?.eet_minutes || 0}m`}
                />
                <DetailRow
                  label="Autonomía de Combustible"
                  value={`${perf?.fuel_hours || 0}h ${perf?.fuel_minutes || 0}m`}
                />
              </View>

              {/* 4. Emergencia y Seguridad */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <Ionicons name="shield-checkmark-outline" size={20} color="#0f1e3d" />
                  <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Seguridad y Emergencia
                  </ThemedText>
                </View>
                <DetailRow label="Personas a Bordo (POB)" value={em?.pax_count !== undefined ? String(em.pax_count) : ""} />
                <BadgesList label="Equipamiento Radio Emergencia" items={em?.radio_equipment} />
                <BadgesList label="Equipos de Supervivencia" items={em?.survival_equipment} />
                <BadgesList label="Chalecos Salvavidas" items={em?.life_jacket_equipment} />
                <DetailRow
                  label="Lleva Balsas Salvavidas"
                  value={em?.dinghies_capacity?.carried ? "Sí" : "No"}
                />
                {em?.dinghies_capacity?.carried && (
                  <>
                    <DetailRow label="Cantidad de Balsas" value={String(em.dinghies_capacity.number || 0)} />
                    <DetailRow label="Capacidad Total Balsas" value={`${em.dinghies_capacity.total_capacity || 0} personas`} />
                    <DetailRow label="Cubierta de Protección" value={em.dinghies_capacity.covered ? "Sí" : "No"} />
                    <DetailRow label="Color de Balsas" value={em.dinghies_capacity.color || "-"} />
                  </>
                )}
              </View>

              {/* 5. Datos del Piloto */}
              <View className="bg-brand-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <MaterialCommunityIcons name="account-tie-hat" size={20} color="#0f1e3d" />
                  <ThemedText type="subtitle" className="font-bold text-brand-blue">
                    Piloto
                  </ThemedText>
                </View>
                <DetailRow label="Nombre" value={plt?.name || ""} />
                <DetailRow label="Teléfono" value={plt?.contact_info || ""} />
                <DetailRow label="Observaciones" value={plt?.observations || "Ninguna"} />
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {/* Footer / Editar Plan Button */}
      {plan && (
        <View className="p-4 bg-brand-light border-t border-slate-200">
          <TouchableOpacity
            onPress={handleEdit}
            className="bg-brand-gold py-4 px-6 rounded-2xl items-center justify-center flex-row gap-2 shadow-md"
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <ThemedText className="text-white font-bold text-base">
              Editar Plan de Vuelo
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}
