import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { useAuth } from "@/hooks/useAuth";
import { usePilotFlightPlans } from "@/hooks/usePilotFlightPlans";
import { getStatusBadge } from "@/utils/flight-plan";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

export default function PilotPlansScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: flightPlans = [],
    isLoading,
    refetch,
  } = usePilotFlightPlans(user?.uid);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return "S/F";
    const dateObj = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(dateObj.getTime())) return "S/F";
    return dateObj.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatEobt = (eobt?: string) => {
    if (!eobt || eobt.length !== 4) return null;
    return `${eobt.slice(0, 2)}:${eobt.slice(2)} Z`;
  };

  const formatEet = (hours?: number, minutes?: number) => {
    if (hours === undefined || minutes === undefined) return null;
    if (hours === 0 && minutes === 0) return null;
    const h = hours < 10 ? `0${hours}` : `${hours}`;
    const m = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${h}h ${m}m`;
  };

  const handlePlanPress = (planId: string) => {
    router.push({
      pathname: "/(pilot)/plans/view-flight-plan",
      params: { flightPlanId: planId },
    });
  };

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Cabecera */}
      <View className="flex-row justify-between items-center mb-6 mt-2">
        <View>
          <ThemedText
            type="caption"
            className="uppercase font-bold text-brand-gold tracking-widest text-xs"
          >
            Panel de Piloto
          </ThemedText>
          <ThemedText type="title" className="text-2xl font-bold mt-0.5">
            Mis Planes de Vuelo
          </ThemedText>
        </View>

        <UserAvatar size={44} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#0f1e3d" />
            <ThemedText className="text-slate-500 text-sm mt-3">
              Cargando planes de vuelo...
            </ThemedText>
          </View>
        ) : flightPlans.length === 0 ? (
          <View className="bg-brand-white border border-slate-100 rounded-2xl p-8 items-center justify-center my-8 shadow-sm">
            <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
            <ThemedText className="font-bold text-lg text-brand-blue mt-3">
              No tienes planes de vuelo
            </ThemedText>
            <ThemedText className="text-slate-500 text-center text-sm mt-1">
              Los planes de vuelo que crees para tus próximos vuelos aparecerán aquí.
            </ThemedText>
          </View>
        ) : (
          <View className="space-y-4 mb-8 gap-4">
            {flightPlans.map((plan) => {
              const statusBadge = getStatusBadge(plan.status);
              const fp = plan.flight_plan;
              const depIcao = fp?.departure?.icao || "N/A";
              const arrIcao = fp?.arrival?.icao || "N/A";
              const aircraftReg = fp?.aircraft?.registration || "S/M";
              const aircraftType = fp?.aircraft?.type || "";
              const eobtFormatted = formatEobt(fp?.departure?.off_block_time);
              const eetFormatted = formatEet(fp?.performance?.eet_hours, fp?.performance?.eet_minutes);
              const paxCount = fp?.emergency?.pax_count;
              const departureDate = fp?.departure?.datetime_utc
                ? formatDate(fp.departure.datetime_utc)
                : formatDate(plan.created_at);

              return (
                <TouchableOpacity
                  key={plan.id}
                  onPress={() => handlePlanPress(plan.id)}
                  activeOpacity={0.75}
                  className="bg-brand-white border border-slate-200/90 rounded-2xl p-4 shadow-sm"
                >
                  {/* Card Header: Icon + Callsign/Reg + Status Badge */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <View className="w-11 h-11 rounded-xl bg-brand-blue/10 items-center justify-center border border-brand-blue/10">
                        <Ionicons name="document-text" size={20} color="#0f1e3d" />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <ThemedText className="font-bold text-base text-brand-blue">
                            {aircraftReg}
                          </ThemedText>
                        </View>
                        <ThemedText type="caption" className="text-xs text-slate-500 mt-0.5">
                          {aircraftType ? `(${aircraftType})` : ""}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View
                      className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border ${statusBadge.badgeBg} ${statusBadge.badgeBorder}`}
                    >
                      <Ionicons
                        name={statusBadge.icon as any}
                        size={14}
                        color={statusBadge.iconColor}
                      />
                      <ThemedText className={`text-xs font-bold ${statusBadge.textColor}`}>
                        {statusBadge.label}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Route Visual Section */}
                  <View className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 my-1.5">
                    <View className="flex-row items-center justify-between">
                      {/* Origin */}
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1 mb-0.5">
                          <ThemedText
                            type="caption"
                            className="text-[10px] uppercase font-bold text-slate-400 tracking-wider"
                          >
                            Origen
                          </ThemedText>
                        </View>
                        <ThemedText className="text-lg font-black text-brand-blue tracking-wide">
                          {depIcao}
                        </ThemedText>
                      </View>

                      {/* Route Arrow / Flight Info Pill */}
                      <View className="items-center justify-center px-2 flex-1">
                        {eetFormatted ? (
                          <View className="w-24 bg-brand-white border border-slate-200 px-2 py-0.5 rounded-full mb-1.5 flex-row items-center gap-1">
                            <Ionicons name="time-outline" size={10} color="#64748B" />
                            <ThemedText className="text-xs font-bold text-slate-600">
                              {eetFormatted}
                            </ThemedText>
                          </View>
                        ) : null}
                        <View className="flex-row items-center w-full justify-center">
                          <View className="h-[1.5px] bg-slate-200 flex-1" />
                          <View className="mx-1.5 bg-brand-gold/15 p-1 rounded-full border border-brand-gold/30">
                            <Ionicons name="airplane" size={12} color="#C5A059" />
                          </View>
                          <View className="h-[1.5px] bg-slate-200 flex-1" />
                        </View>
                      </View>

                      {/* Destination */}
                      <View className="flex-1 items-end">
                        <View className="flex-row items-center gap-1 mb-0.5">
                          <ThemedText
                            type="caption"
                            className="text-[10px] uppercase font-bold text-slate-400 tracking-wider"
                          >
                            Destino
                          </ThemedText>
                        </View>
                        <ThemedText className="text-lg font-black text-brand-blue tracking-wide">
                          {arrIcao}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {/* Footer metadata row */}
                  <View className="pt-3 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3 flex-wrap">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="calendar-outline" size={13} color="#64748B" />
                        <ThemedText className="text-xs font-semibold text-slate-600">
                          {departureDate}
                        </ThemedText>
                      </View>

                      {eobtFormatted && (
                        <View className="flex-row items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Ionicons name="time-outline" size={12} color="#475569" />
                          <ThemedText className="text-xs font-medium text-slate-700">
                            {eobtFormatted}
                          </ThemedText>
                        </View>
                      )}

                      {paxCount !== undefined && paxCount > 0 && (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="people-outline" size={13} color="#64748B" />
                          <ThemedText className="text-xs font-semibold text-slate-600">
                            {paxCount} pax
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    <View className="flex-row items-center gap-0.5">
                      <ThemedText className="text-xs font-bold text-brand-gold">
                        Ver
                      </ThemedText>
                      <Ionicons name="chevron-forward" size={14} color="#C5A059" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
