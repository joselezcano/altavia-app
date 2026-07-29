import React from "react";
import { ScrollView, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAllAircrafts } from "@/hooks/useAllAircrafts";
import { useAircraftTemplates } from "@/hooks/useAircraftTemplates";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";

export default function AdminDashboard() {
  const router = useRouter();
  
  // Fetch real data to show metrics
  const { data: aircrafts = [], isLoading: isLoadingAircrafts } = useAllAircrafts();
  const { data: templates = [], isLoading: isLoadingTemplates } = useAircraftTemplates();

  // Fetch real reservations from the collection
  const { data: reservations = [], isLoading: isLoadingReservations } = useQuery({
    queryKey: ["all-reservations-dashboard"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "aircraft-reservation"));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  });

  const isLoading = isLoadingAircrafts || isLoadingTemplates || isLoadingReservations;

  // Statistics with real values
  const stats = [
    {
      title: "Modelos Base",
      value: templates.length,
      icon: "airplane-outline" as const,
      color: "bg-blue-500/10 text-blue-600",
      route: "/(admin)/templates",
    },
    {
      title: "Flota Activa",
      value: aircrafts.length,
      icon: "key-outline" as const,
      color: "bg-emerald-500/10 text-emerald-600",
      route: "/(admin)/fleet-pricing",
    },
    {
      title: "Vuelos Reservados",
      value: reservations.length,
      icon: "calendar-outline" as const,
      color: "bg-amber-500/10 text-amber-600",
      route: null,
    },
    {
      title: "Pilotos Activos",
      value: 6, // Mocked for CRM presentation
      icon: "people-outline" as const,
      color: "bg-purple-500/10 text-purple-600",
      route: null,
    },
  ];

  const recentFlights = [
    {
      id: "FL-983",
      route: "SGAS ➔ SUMU",
      aircraft: "ZP-MJS (Cessna Caravan)",
      date: "Hoy, 14:30",
      status: "Pendiente",
      statusColor: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      id: "FL-982",
      route: "SGAS ➔ SULS",
      aircraft: "ZP-LKA (King Air 250)",
      date: "Ayer, 09:15",
      status: "Confirmado",
      statusColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      id: "FL-980",
      route: "SBGR ➔ SGAS",
      aircraft: "ZP-XYZ (Learjet 45)",
      date: "23 Jul, 18:00",
      status: "Completado",
      statusColor: "text-slate-600 bg-slate-50 border-slate-100",
    },
  ];

  if (isLoading) {
    return (
      <ThemedView className="flex-1 justify-center items-center bg-brand-light">
        <ActivityIndicator size="large" color="#0f1e3d" />
        <ThemedText className="mt-4 text-slate-500">Cargando métricas del sistema...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 bg-brand-light">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4">
        {/* Welcome Banner */}
        <View className="bg-brand-blue rounded-3xl p-5 mb-6 shadow-md relative overflow-hidden">
          <View className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <Ionicons name="pie-chart" size={150} color="#FFFFFF" />
          </View>
          <ThemedText className="text-amber-300 uppercase font-bold text-xs tracking-widest mb-1">
            MÓDULO DE CONTROL CENTRAL
          </ThemedText>
          <ThemedText className="text-white font-bold text-2xl">
            Bienvenido, Administrador
          </ThemedText>
          <ThemedText className="text-slate-300 text-sm mt-1">
            Supervisa la operación de vuelos, flota y cumplimiento legal de Altavia.
          </ThemedText>
        </View>

        {/* Stats Grid */}
        <ThemedText className="font-bold text-slate-700 text-base mb-3 px-1">
          Estadísticas de la Plataforma
        </ThemedText>
        <View className="flex-row flex-wrap justify-between gap-4 mb-6">
          {stats.map((stat, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => stat.route && router.push(stat.route as any)}
              disabled={!stat.route}
              style={{ width: "47%" }}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm justify-between active:scale-98"
            >
              <View className="flex-row justify-between items-center mb-3">
                <View className={`w-9 h-9 rounded-xl items-center justify-center ${stat.color.split(" ")[0]}`}>
                  <Ionicons name={stat.icon} size={20} className={stat.color.split(" ")[1]} />
                </View>
                {stat.route && (
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                )}
              </View>
              <View>
                <ThemedText className="text-2xl font-bold text-brand-blue mb-0.5">
                  {stat.value}
                </ThemedText>
                <ThemedText className="text-xs text-slate-500 font-medium">
                  {stat.title}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <ThemedText className="font-bold text-slate-700 text-base mb-3 px-1">
          Accesos Rápidos
        </ThemedText>
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/(admin)/templates")}
            className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-row items-center gap-3 active:bg-slate-50"
          >
            <View className="w-10 h-10 rounded-xl bg-brand-gold/15 items-center justify-center flex-shrink-0">
              <Ionicons name="airplane" size={20} color="#C5A059" />
            </View>
            <View className="flex-1 flex-shrink">
              <ThemedText className="font-bold text-brand-blue text-sm" numberOfLines={1}>Aeronaves</ThemedText>
              <ThemedText className="text-[10px] text-slate-500" numberOfLines={1}>Modelos y specs</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(admin)/fleet-pricing")}
            className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-row items-center gap-3 active:bg-slate-50"
          >
            <View className="w-10 h-10 rounded-xl bg-brand-gold/15 items-center justify-center flex-shrink-0">
              <Ionicons name="cash" size={20} color="#C5A059" />
            </View>
            <View className="flex-1 flex-shrink">
              <ThemedText className="font-bold text-brand-blue text-sm" numberOfLines={1}>Tarifas</ThemedText>
              <ThemedText className="text-[10px] text-slate-500" numberOfLines={1}>Precios y comisiones</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Flights Section */}
        <View className="flex-row justify-between items-center mb-3 px-1">
          <ThemedText className="font-bold text-slate-700 text-base">
            Actividad Reciente
          </ThemedText>
          <ThemedText className="text-brand-gold text-xs font-bold">
            Ver Todo
          </ThemedText>
        </View>

        <View className="gap-3 mb-10">
          {recentFlights.map((flight) => (
            <View
              key={flight.id}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-row justify-between items-center"
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <ThemedText className="font-bold text-brand-blue text-sm">
                    {flight.route}
                  </ThemedText>
                  <ThemedText className="text-[10px] text-slate-400 font-medium">
                    {flight.id}
                  </ThemedText>
                </View>
                <ThemedText className="text-xs text-slate-500 mb-1">
                  {flight.aircraft}
                </ThemedText>
                <ThemedText className="text-[10px] text-slate-400">
                  {flight.date}
                </ThemedText>
              </View>
              <View className={`px-2.5 py-1 rounded-full border ${flight.statusColor}`}>
                <ThemedText className="text-[10px] font-bold">
                  {flight.status}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
