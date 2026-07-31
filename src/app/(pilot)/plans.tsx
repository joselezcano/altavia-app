import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { useAuth } from "@/hooks/useAuth";
import { usePilotFlightPlans } from "@/hooks/usePilotFlightPlans";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View
} from "react-native";

export default function PilotPlansScreen() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: flightPlans = [],
    isLoading,
    refetch,
  } = usePilotFlightPlans(user?.uid);

  const displayName =
    userData?.firstName && userData?.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : user?.email?.split("@")[0] || "Piloto";

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "Approved":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
        };
      case "Pending":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          dot: "bg-amber-500",
        };
      case "Completed":
        return {
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          dot: "bg-slate-500",
        };
      default:
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          dot: "bg-blue-500",
        };
    }
  };

  const translateStatus = (status?: string) => {
    switch (status) {
      case "Approved":
        return "Aprobado";
      case "Pending":
        return "Pendiente";
      case "Completed":
        return "Completado";
      default:
        return "Borrador";
    }
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
          <View className="space-y-4 mb-8">
            {flightPlans.map((plan) => {
              const statusStyle = getStatusStyle(plan.status);
              const depIcao = plan.flight_plan?.departure?.icao || "N/A";
              const arrIcao = plan.flight_plan?.arrival?.icao || "N/A";
              const aircraftReg = plan.flight_plan?.aircraft?.registration || "S/M";
              const aircraftType = plan.flight_plan?.aircraft?.type || "";
              const routeLabel = `${depIcao} ➔ ${arrIcao}`;
              const departureDate = plan.flight_plan?.departure?.datetime_utc
                ? formatDate(plan.flight_plan.departure.datetime_utc)
                : formatDate(plan.created_at);

              return (
                <View
                  key={plan.id}
                  className="bg-brand-white border border-slate-100 rounded-xl p-4 shadow-sm"
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View>
                      <ThemedText className="font-bold text-base text-brand-blue">
                        {routeLabel}
                      </ThemedText>
                      <ThemedText type="caption" className="text-xs mt-0.5">
                        {aircraftReg} {aircraftType ? `(${aircraftType})` : ""}
                      </ThemedText>
                    </View>
                    <View
                      className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusStyle.bg}`}
                    >
                      <View
                        className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`}
                      />
                      <ThemedText className="text-xs font-semibold">
                        {translateStatus(plan.status)}
                      </ThemedText>
                    </View>
                  </View>

                  <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-4">
                      <View>
                        <ThemedText
                          type="caption"
                          className="text-[10px] uppercase font-semibold"
                        >
                          Origen
                        </ThemedText>
                        <ThemedText className="text-xs font-bold text-slate-700">
                          {depIcao}
                        </ThemedText>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color="#64748B" />
                      <View>
                        <ThemedText
                          type="caption"
                          className="text-[10px] uppercase font-semibold"
                        >
                          Destino
                        </ThemedText>
                        <ThemedText className="text-xs font-bold text-slate-700">
                          {arrIcao}
                        </ThemedText>
                      </View>
                    </View>

                    <View className="items-end">
                      <ThemedText
                        type="caption"
                        className="text-[10px] uppercase font-semibold"
                      >
                        Salida
                      </ThemedText>
                      <ThemedText className="text-xs font-medium text-slate-700">
                        {departureDate}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
