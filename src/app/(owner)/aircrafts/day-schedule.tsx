import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAircraftAvailability } from "@/hooks/useAircraftAvailability";
import { AircraftAvailability } from "@/types/all-roles";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteDoc, doc } from "firebase/firestore";
import { useMemo } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

const ROW_HEIGHT = 64; // Height in pixels of each hour row in the timeline

export default function DayScheduleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { id, selectedDate, model, registration } = useLocalSearchParams<{
    id: string;
    selectedDate: string;
    model: string;
    registration: string;
  }>();

  // Fetch all availabilities for this aircraft
  const { data: availabilities = [], isLoading } = useAircraftAvailability(id);

  // Helper to format date in Spanish
  const getFormattedDate = () => {
    if (!selectedDate) return "";
    try {
      const dateObj = new Date(selectedDate + "T00:00:00");
      return dateObj.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return selectedDate;
    }
  };

  // Recurrence evaluation logic
  const isAvailabilityOnDate = (avail: AircraftAvailability, targetDateStr: string): boolean => {
    if (targetDateStr < avail.selected_date) return false;

    const start = new Date(avail.selected_date + "T00:00:00");
    const target = new Date(targetDateStr + "T00:00:00");
    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const period = avail.recurrence?.period || "none";
    const interval = avail.recurrence?.interval || 1;
    const endsType = avail.recurrence?.ends?.type || "never";
    const endsDate = avail.recurrence?.ends?.date || null;
    const endsOccurrences = avail.recurrence?.ends?.occurrences || 0;

    // 1. Evaluate end date limit
    if (endsType === "date" && endsDate && targetDateStr > endsDate) {
      return false;
    }

    // 2. Evaluate period recurrence
    if (period === "none") {
      return targetDateStr === avail.selected_date;
    }

    if (period === "daily") {
      if (diffDays % interval !== 0) return false;
      if (endsType === "occurrences") {
        const occurrenceIndex = diffDays / interval;
        if (occurrenceIndex >= endsOccurrences) return false;
      }
      return true;
    }

    if (period === "weekly") {
      const weekdaysEng = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const targetDayName = weekdaysEng[target.getDay()];

      // Check if weekday is matched
      const daysOfWeek = avail.recurrence?.days_of_week || [];
      if (!daysOfWeek.includes(targetDayName as any)) return false;

      // Check week interval from start week Sunday to target week Sunday
      const startSun = new Date(start);
      startSun.setDate(start.getDate() - start.getDay());
      const targetSun = new Date(target);
      targetSun.setDate(target.getDate() - target.getDay());
      const diffWeeksTime = targetSun.getTime() - startSun.getTime();
      const diffWeeks = Math.round(diffWeeksTime / (1000 * 60 * 60 * 24 * 7));
      if (diffWeeks % interval !== 0) return false;

      // Iterate day-by-day to count occurrences
      let occurrencesCount = 0;
      let matchFound = false;
      let current = new Date(start);
      while (current <= target) {
        const currentStr = current.toISOString().split("T")[0];
        const currentDayName = weekdaysEng[current.getDay()];

        const currentSun = new Date(current);
        currentSun.setDate(current.getDate() - current.getDay());
        const dWTime = currentSun.getTime() - startSun.getTime();
        const dW = Math.round(dWTime / (1000 * 60 * 60 * 24 * 7));

        if (dW % interval === 0 && daysOfWeek.includes(currentDayName as any)) {
          if (currentStr === targetDateStr) {
            matchFound = true;
          }
          occurrencesCount++;
        }
        current.setDate(current.getDate() + 1);
      }

      if (!matchFound) return false;
      if (endsType === "occurrences" && occurrencesCount > endsOccurrences) {
        return false;
      }
      return true;
    }

    if (period === "monthly") {
      const diffMonths = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
      if (diffMonths % interval !== 0) return false;
      if (target.getDate() !== start.getDate()) return false;

      if (endsType === "occurrences") {
        const occurrenceIndex = diffMonths / interval;
        if (occurrenceIndex >= endsOccurrences) return false;
      }
      return true;
    }

    if (period === "yearly") {
      const diffYears = target.getFullYear() - start.getFullYear();
      if (diffYears % interval !== 0) return false;
      if (target.getMonth() !== start.getMonth() || target.getDate() !== start.getDate()) return false;

      if (endsType === "occurrences") {
        const occurrenceIndex = diffYears / interval;
        if (occurrenceIndex >= endsOccurrences) return false;
      }
      return true;
    }

    return false;
  };

  // Filter and sort availabilities that occur on the selected day
  const matchingAvailabilities = useMemo(() => {
    if (!selectedDate) return [];
    return availabilities.filter((avail) => isAvailabilityOnDate(avail, selectedDate));
  }, [availabilities, selectedDate]);

  // Handler to delete an availability
  const handleDeleteAvailability = (availId: string) => {
    Alert.alert(
      "Eliminar disponibilidad",
      "¿Estás seguro de que deseas eliminar esta disponibilidad? Esto la quitará del calendario y de la base de datos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "aircraft-availability", availId));
              queryClient.invalidateQueries({ queryKey: ["aircraft-availability", id] });
              Toast.show({
                type: "success",
                text1: "Disponibilidad eliminada",
              });
            } catch (err: any) {
              Alert.alert("Error", "No se pudo eliminar la disponibilidad: " + err.message);
            }
          },
        },
      ]
    );
  };

  // Helper to translate frequency into Spanish
  const getRecurrenceLabel = (avail: AircraftAvailability) => {
    const period = avail.recurrence?.period;
    const interval = avail.recurrence?.interval || 1;
    if (period === "none" || !period) return "No se repite";

    let label = "Repite: ";
    if (period === "daily") {
      label += interval === 1 ? "Todos los días" : `Cada ${interval} días`;
    } else if (period === "weekly") {
      label += interval === 1 ? "Todas las semanas" : `Cada ${interval} semanas`;
      const days = avail.recurrence?.days_of_week || [];
      if (days.length > 0) {
        const spanDays = days.map((d) => {
          switch (d) {
            case "Sunday": return "Dom";
            case "Monday": return "Lun";
            case "Tuesday": return "Mar";
            case "Wednesday": return "Mié";
            case "Thursday": return "Jue";
            case "Friday": return "Vie";
            case "Saturday": return "Sáb";
            default: return d;
          }
        });
        label += ` (${spanDays.join(", ")})`;
      }
    } else if (period === "monthly") {
      label += interval === 1 ? "Todos los meses" : `Cada ${interval} meses`;
    } else if (period === "yearly") {
      label += interval === 1 ? "Todos los años" : `Cada ${interval} años`;
    }
    return label;
  };

  return (
    <ThemedView className="flex-1 bg-brand-light px-4 pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center p-1"
        >
          <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
          <ThemedText className="font-semibold text-brand-blue ml-1">
            Calendario
          </ThemedText>
        </TouchableOpacity>
        <ThemedText className="font-bold text-brand-blue text-lg">
          Agenda del Día
        </ThemedText>
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: "/aircrafts/event-recurrence",
              params: {
                aircraftId: id,
                selectedDate,
                model,
                registration,
              },
            });
          }}
          className="flex-row items-center p-1 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5"
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color="#C5A059" />
          <ThemedText className="font-bold text-brand-gold ml-1 text-xs">
            Añadir
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center shadow-md">
        <View className="flex-1 mr-4">
          <ThemedText className="font-bold text-xl text-white">
            {model || "Aeronave"}
          </ThemedText>
          <ThemedText className="text-slate-300 text-xs mt-1 capitalize font-semibold">
            {getFormattedDate()}
          </ThemedText>
        </View>
        {registration && (
          <View className="bg-brand-gold px-4 py-1.5 rounded-full">
            <ThemedText className="text-brand-blue text-xs font-bold uppercase tracking-wider">
              {registration}
            </ThemedText>
          </View>
        )}
      </View>

      {/* 24 Hours Timeline */}
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mb-2 bg-white rounded-3xl border border-slate-100 p-4 shadow-sm">
        <View className="flex-row relative">
          {/* Left Side: Hour Labels */}
          <View className="w-12 pr-2">
            {Array.from({ length: 24 }).map((_, hour) => (
              <View key={hour} style={{ height: ROW_HEIGHT }} className="justify-start pt-1">
                <ThemedText className="text-slate-400 text-xs font-bold text-right">
                  {String(hour).padStart(2, "0")}:00
                </ThemedText>
              </View>
            ))}
            {/* 24:00 label at the bottom */}
            <View style={{ height: 20 }} className="justify-start">
              <ThemedText className="text-slate-400 text-xs font-bold text-right">
                24:00
              </ThemedText>
            </View>
          </View>

          {/* Right Side: Timeline Grid Lines */}
          <View className="flex-1 relative">
            {Array.from({ length: 24 }).map((_, hour) => (
              <TouchableOpacity
                key={hour}
                onLongPress={() => {
                  router.push({
                    pathname: "/aircrafts/event-recurrence",
                    params: {
                      aircraftId: id,
                      selectedDate,
                      model,
                      registration,
                      startHour: String(hour),
                      endHour: String((hour + 1) % 24),
                    },
                  });
                }}
                style={{ height: ROW_HEIGHT }}
                className="border-t border-slate-100/80 w-full justify-center"
                activeOpacity={0.5}
              />
            ))}
            {/* Last bottom boundary line */}
            <View className="border-t border-slate-100/80 w-full" />

            {/* Overlaid Availability Blocks */}
            {matchingAvailabilities.map((avail) => {
              const getMinutes = (timeStr: string) => {
                const [h, m] = timeStr.split(":").map(Number);
                return h * 60 + m;
              };

              const startMins = getMinutes(avail.start_time);
              const endMins = getMinutes(avail.end_time);

              const topPosition = (startMins / 60) * ROW_HEIGHT;
              const durationMins = endMins - startMins;
              const calculatedHeight = (durationMins / 60) * ROW_HEIGHT;
              const heightPosition = Math.max(36, calculatedHeight); // Enforce min height for visual styling

              return (
                <View
                  key={avail.id}
                  style={{
                    position: "absolute",
                    top: topPosition,
                    height: heightPosition,
                    left: 4,
                    right: 4,
                  }}
                  className="bg-brand-blue/5 border border-brand-blue/20 border-l-4 border-l-brand-blue rounded-2xl p-3 flex-row justify-between items-start shadow-sm"
                >
                  <View className="flex-1 justify-center">
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="time-outline" size={14} color="#0f1e3d" />
                      <ThemedText className="font-bold text-brand-blue text-sm">
                        {avail.start_time} - {avail.end_time}
                      </ThemedText>
                    </View>
                    {heightPosition > 50 && (
                      <ThemedText className="text-[10px] text-brand-muted font-medium mt-1">
                        {getRecurrenceLabel(avail)}
                      </ThemedText>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteAvailability(avail.id)}
                    className="p-1 rounded-lg bg-red-50"
                  >
                    <Ionicons name="trash" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
