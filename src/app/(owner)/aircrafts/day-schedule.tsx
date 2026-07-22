import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftAvailability } from "@/hooks/useAircraftAvailability";
import { AircraftAvailability } from "@/types/all-roles";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

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

  // Reason color and icon themes map
  const REASON_THEMES: Record<
    string,
    {
      label: string;
      bg: string;
      border: string;
      accent: string;
      text: string;
      badgeBg: string;
      iconName: keyof typeof Ionicons.glyphMap;
    }
  > = {
    maintenance: {
      label: "Mantenimiento",
      bg: "#FFFBEB",
      border: "#FDE68A",
      accent: "#D97706",
      text: "#78350F",
      badgeBg: "#FEF3C7",
      iconName: "build",
    },
    owner_use: {
      label: "Uso del Propietario",
      bg: "#EEF2FF",
      border: "#C7D2FE",
      accent: "#4F46E5",
      text: "#312E81",
      badgeBg: "#E0E7FF",
      iconName: "ribbon",
    },
    holidays: {
      label: "Vacaciones",
      bg: "#ECFDF5",
      border: "#A7F3D0",
      accent: "#059669",
      text: "#064E3B",
      badgeBg: "#D1FAE5",
      iconName: "sunny",
    },
    not_in_base: {
      label: "Fuera de Base",
      bg: "#F0F9FF",
      border: "#BAE6FD",
      accent: "#0284C7",
      text: "#0C4A6E",
      badgeBg: "#E0F2FE",
      iconName: "location",
    },
    no_pilot: {
      label: "Sin Piloto",
      bg: "#FFF1F2",
      border: "#FECDD3",
      accent: "#E11D48",
      text: "#881337",
      badgeBg: "#FFE4E6",
      iconName: "person-remove",
    },
    rental: {
      label: "Alquiler",
      bg: "#F5F3FF",
      border: "#DDD6FE",
      accent: "#7C3AED",
      text: "#4C1D95",
      badgeBg: "#EDE9FE",
      iconName: "key",
    },
    legal_restriction: {
      label: "Restricción Legal",
      bg: "#F8FAFC",
      border: "#CBD5E1",
      accent: "#475569",
      text: "#0F172A",
      badgeBg: "#E2E8F0",
      iconName: "document-text",
    },
    other: {
      label: "Otro",
      bg: "#f7fee7",
      border: "#bef264",
      accent: "#4d7c0f",
      text: "#3f6212",
      badgeBg: "#d9f99d",
      iconName: "bookmark",
    },
  };

  // Helper to translate frequency into concise indicator next to time
  const getShortRecurrenceLabel = (avail: AircraftAvailability) => {
    const period = avail.recurrence?.period;
    const interval = avail.recurrence?.interval || 1;
    if (!period || period === "none") return null;

    if (period === "daily") {
      return interval === 1 ? "Diario" : `c/${interval}d`;
    }
    if (period === "weekly") {
      const days = avail.recurrence?.days_of_week || [];
      const spanDays = days
        .map((d) => {
          switch (d) {
            case "Sunday": return "D";
            case "Monday": return "L";
            case "Tuesday": return "M";
            case "Wednesday": return "X";
            case "Thursday": return "J";
            case "Friday": return "V";
            case "Saturday": return "S";
            default: return "";
          }
        })
        .filter(Boolean)
        .join("");

      const prefix = interval === 1 ? "Sem" : `c/${interval}sem`;
      return spanDays ? `${prefix} (${spanDays})` : prefix;
    }
    if (period === "monthly") {
      return interval === 1 ? "Mensual" : `c/${interval}m`;
    }
    if (period === "yearly") {
      return interval === 1 ? "Anual" : `c/${interval}a`;
    }
    return null;
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
          Agenda diaria
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
          <Ionicons name="add" size={24} color="#C5A059" />
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center shadow-md">
        <View className="flex-1 mr-4">
          <ThemedText className="font-bold text-xl text-white">
            {model || "Aeronave"}
          </ThemedText>
          <ThemedText className="text-slate-300 text-sm mt-1 font-semibold">
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
              const heightPosition = Math.max(44, calculatedHeight);

              const theme = REASON_THEMES[avail.reason] || REASON_THEMES.other;
              const shortRecurrence = getShortRecurrenceLabel(avail);

              return (
                <View
                  key={avail.id}
                  style={{
                    position: "absolute",
                    top: topPosition,
                    height: heightPosition,
                    left: 4,
                    right: 4,
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    borderLeftColor: theme.accent,
                    borderLeftWidth: 4,
                    borderWidth: 1,
                    borderRadius: 16,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                  className="flex-row justify-between items-start shadow-sm"
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      router.push({
                        pathname: "/aircrafts/edit-event-recurrence",
                        params: {
                          eventId: avail.id,
                          aircraftId: id,
                          selectedDate,
                          model,
                          registration,
                        },
                      });
                    }}
                    className="flex-1 justify-center mr-1"
                  >
                    {/* Top Row: Time Range + Short Repetition Indicator next to it */}
                    <View className="flex-row items-center flex-wrap gap-1.5">
                      <Ionicons name="time-outline" size={13} color={theme.accent} />
                      <ThemedText style={{ color: theme.text }} className="font-bold text-xs">
                        {avail.start_time} - {avail.end_time}
                      </ThemedText>

                      {shortRecurrence && (
                        <View
                          style={{ backgroundColor: theme.badgeBg }}
                          className="ml-1 flex-row items-center px-1.5 py-0.5 rounded-md gap-0.5"
                        >
                          <Ionicons name="repeat-sharp" size={12} color={theme.accent} />
                          <ThemedText style={{ color: theme.text }} className="text-xs font-bold">
                            {shortRecurrence}
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    {/* Reason Row */}
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name={theme.iconName} size={12} color={theme.accent} />
                      <ThemedText style={{ color: theme.text }} className="font-semibold text-xs">
                        {theme.label}
                      </ThemedText>
                    </View>

                    {/* Notes (if present and card height permits) */}
                    {avail.notes && heightPosition > 60 && (
                      <ThemedText
                        style={{ color: theme.text }}
                        numberOfLines={1}
                        className="text-xs opacity-80 mt-0.5 font-medium"
                      >
                        {avail.notes}
                      </ThemedText>
                    )}
                  </TouchableOpacity>

                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                      onPress={() => {
                        router.push({
                          pathname: "/aircrafts/edit-event-recurrence",
                          params: {
                            eventId: avail.id,
                            aircraftId: id,
                            selectedDate,
                            model,
                            registration,
                          },
                        });
                      }}
                      className="p-1 rounded-lg bg-white/80 border border-slate-200/60"
                    >
                      <Ionicons name="pencil" size={13} color="#0f1e3d" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
