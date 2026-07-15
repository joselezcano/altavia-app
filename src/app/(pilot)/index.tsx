import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";

import SignOutButton from "@/components/sign-out-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/useAuth";

interface FlightPlanSample {
  id: string;
  route: string;
  depIcao: string;
  arrIcao: string;
  aircraft: string;
  date: string;
  time: string;
  status: "Approved" | "Pending" | "Completed" | "Draft";
}


// const fp = {
//   "flight_plan": {
//     "aircraft": {
//       "registration": "N12345",
//       // "type": "C172",
//       // "wake_turbulence": "L",
//       // "equipment": ["S", "D", "G", "S"],
//       "transponder": "C"
//     },
//     "flight_details": {
//       // "callsign": "AAL123", Numero
//       // "flight_rules": "IFR",
//       // "flight_type": "S"
//     },
//     "departure": {
//       // "icao": "KSEA",
//       // "datetime_utc": "2026-07-15T15:00:00Z",
//       "off_block_time": "1500"
//     },
//     "arrival": {
//       // "icao": "KPDX",
//       // "datetime_utc": "2026-07-15T16:00:00Z",
//       // "alternate_icao": "KSLE"
//     },
//     "route": {
//       // "cruising_speed_knots": 120,
//       "cruising_altitude_feet": 8500,
//       "waypoints": [
//         "SEA",
//         "HAROB",
//         "BTG",
//         "PDX"
//       ],
//       "encoded_route": "SEA.HAROB4.BTG.PDX"
//     },
//     // "performance": {
//     //   "eet_hours": 1,
//     //   "eet_minutes": 0,
//     //   "fuel_hours": 3,
//     //   "fuel_minutes": 30
//     // },
//     // "emergency": {
//     //   "pax_count": 3,
//       // "radio_equipment": ["U", "V"],
//       // "survival_equipment": ["P"],
//       // "life_jacket_equipment": ["J"],
//       // "dinghies_capacity": "TBN"
//     },
//     "pilot": {
//       // "name": "J. DOE",
//       "contact_info": "+1-555-019-2834"
//     }
//   }
// };


export default function FlightPlanScreen() {
  const { user, userData } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  // Fallback to email username if names are not loaded
  const displayName =
    userData?.firstName && userData?.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : user?.email?.split("@")[0] || "Propietario";

  const userInitial = displayName.charAt(0).toUpperCase();

  // Mock list of flight plans for the Owner
  const flightPlans: FlightPlanSample[] = [
    {
      id: "FP-2026-004",
      route: "Asunción ➔ Punta del Este",
      depIcao: "SGAS",
      arrIcao: "SULS",
      aircraft: "ZP-XYZ (King Air 250)",
      date: "18 Jul, 2026",
      time: "09:30 AM",
      status: "Approved",
    },
    {
      id: "FP-2026-005",
      route: "Asunción ➔ São Paulo",
      depIcao: "SGAS",
      arrIcao: "SBGR",
      aircraft: "ZP-XYZ (King Air 250)",
      date: "22 Jul, 2026",
      time: "14:00 PM",
      status: "Pending",
    },
    {
      id: "FP-2026-003",
      route: "Montevideo ➔ Asunción",
      depIcao: "SUMU",
      arrIcao: "SGAS",
      aircraft: "ZP-XYZ (King Air 250)",
      date: "12 Jul, 2026",
      time: "16:15 PM",
      status: "Completed",
    },
  ];

  const getStatusStyle = (status: FlightPlanSample["status"]) => {
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

  const translateStatus = (status: FlightPlanSample["status"]) => {
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

  const handleCreateNew = () => {
    router.push("/create-flight-plan");
  };

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Cabecera con Saludo y Avatar */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <ThemedText
            type="caption"
            className="uppercase font-bold text-brand-gold tracking-widest text-xs"
          >
            Panel de Propietario
          </ThemedText>
          <ThemedText type="title" className="text-2xl font-bold mt-0.5">
            Hola, {displayName.split(" ")[0]}
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="w-11 h-11 rounded-full bg-brand-blue items-center justify-center shadow-sm"
        >
          <ThemedText className="text-white font-semibold text-base">
            {userInitial}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Tarjeta de Resumen / Acción Rápida */}
        <View className="bg-brand-blue rounded-2xl p-5 mb-6 shadow-md relative overflow-hidden">
          {/* Fondo decorativo sutil */}
          <View className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <Ionicons name="airplane" size={150} color="#FFFFFF" />
          </View>

          <ThemedText className="text-brand-gold uppercase font-semibold text-xs tracking-wider mb-1">
            Próximo Vuelo Planificado
          </ThemedText>
          <ThemedText className="text-white font-bold text-lg mb-4">
            {flightPlans[0].route}
          </ThemedText>

          <View className="flex-row justify-between items-center">
            <View>
              <ThemedText className="text-slate-300 text-xs">Fecha y Hora</ThemedText>
              <ThemedText className="text-white text-sm font-semibold">
                {flightPlans[0].date} - {flightPlans[0].time}
              </ThemedText>
            </View>

            <TouchableOpacity
              onPress={handleCreateNew}
              className="bg-brand-gold px-4 py-2 rounded-xl flex-row items-center gap-1 shadow-sm"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <ThemedText className="text-white font-semibold text-sm">
                Crear Plan
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sección de Historial de Planes de Vuelo */}
        <View className="mb-4 flex-row justify-between items-center">
          <ThemedText type="subtitle" className="text-lg">
            Planes de Vuelo
          </ThemedText>
          <TouchableOpacity onPress={handleCreateNew}>
            <ThemedText type="accent" className="text-xs">
              Ver Todos
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Listado de Planes de Vuelo */}
        <View className="space-y-4 mb-8">
          {flightPlans.map((plan) => {
            const statusStyle = getStatusStyle(plan.status);
            return (
              <View
                key={plan.id}
                className="bg-brand-white border border-slate-100 rounded-xl p-4 shadow-sm"
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View>
                    <ThemedText className="font-bold text-base text-brand-blue">
                      {plan.route}
                    </ThemedText>
                    <ThemedText type="caption" className="text-xs mt-0.5">
                      {plan.aircraft}
                    </ThemedText>
                  </View>
                  <View
                    className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusStyle.bg}`}
                  >
                    <View className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />
                    <ThemedText className="text-xs font-semibold">
                      {translateStatus(plan.status)}
                    </ThemedText>
                  </View>
                </View>

                <View className="border-t border-slate-100 pt-3 flex-row justify-between items-center">
                  <View className="flex-row items-center gap-4">
                    <View>
                      <ThemedText type="caption" className="text-[10px] uppercase font-semibold">
                        Origen
                      </ThemedText>
                      <ThemedText className="text-xs font-bold text-slate-700">
                        {plan.depIcao}
                      </ThemedText>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color="#64748B" />
                    <View>
                      <ThemedText type="caption" className="text-[10px] uppercase font-semibold">
                        Destino
                      </ThemedText>
                      <ThemedText className="text-xs font-bold text-slate-700">
                        {plan.arrIcao}
                      </ThemedText>
                    </View>
                  </View>

                  <View className="items-end">
                    <ThemedText type="caption" className="text-[10px] uppercase font-semibold">
                      Salida
                    </ThemedText>
                    <ThemedText className="text-xs font-medium text-slate-700">
                      {plan.date}
                    </ThemedText>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de Perfil y Cierre de Sesión */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(15, 30, 61, 0.4)" }}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View className="flex-1 justify-end">
            <View className="bg-brand-white rounded-t-3xl p-6 shadow-xl border-t border-slate-100">
              <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6" />

              {/* Info de Perfil */}
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-full bg-brand-blue items-center justify-center mb-3">
                  <ThemedText className="text-white font-bold text-2xl">
                    {userInitial}
                  </ThemedText>
                </View>
                <ThemedText className="font-bold text-lg text-brand-blue">
                  {displayName}
                </ThemedText>
                <ThemedText type="caption" className="text-sm">
                  {user?.email}
                </ThemedText>
                <View className="mt-2 bg-brand-gold/15 px-3 py-1 rounded-full">
                  <ThemedText className="text-brand-gold text-xs font-semibold uppercase tracking-wider">
                    Propietario de Aeronave
                  </ThemedText>
                </View>
              </View>

              {/* Botón de Cierre de Sesión */}
              <View className="mb-4">
                <SignOutButton />
              </View>

              {/* Botón para Cerrar Modal */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-full bg-slate-100 py-3 rounded-xl items-center"
              >
                <ThemedText className="text-slate-700 font-semibold">
                  Cancelar
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}
