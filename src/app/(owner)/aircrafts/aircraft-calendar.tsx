import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftAvailability } from "@/hooks/useAircraftAvailability";
import { AircraftAvailability } from "@/types/all-roles";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from "react-native";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Check if a given aircraft availability record applies to a target date YYYY-MM-DD
 */
function isAvailabilityOnDate(avail: AircraftAvailability, targetDateStr: string): boolean {
  if (targetDateStr < avail.selected_date) return false;

  const start = parseLocalDate(avail.selected_date);
  const target = parseLocalDate(targetDateStr);
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
      const occurrenceIndex = Math.floor(diffDays / interval);
      if (occurrenceIndex >= endsOccurrences) return false;
    }
    return true;
  }

  if (period === "weekly") {
    const weekdaysEng = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayName = weekdaysEng[target.getDay()];

    const daysOfWeek = avail.recurrence?.days_of_week || [];
    if (!daysOfWeek.includes(targetDayName as any)) return false;

    const startSun = new Date(start);
    startSun.setDate(start.getDate() - start.getDay());
    const targetSun = new Date(target);
    targetSun.setDate(target.getDate() - target.getDay());
    const diffWeeksTime = targetSun.getTime() - startSun.getTime();
    const diffWeeks = Math.round(diffWeeksTime / (1000 * 60 * 60 * 24 * 7));
    if (diffWeeks % interval !== 0) return false;

    let occurrencesCount = 0;
    let matchFound = false;
    let current = new Date(start);
    while (current <= target) {
      const currentStr = formatLocalDate(current);
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
      const occurrenceIndex = Math.floor(diffMonths / interval);
      if (occurrenceIndex >= endsOccurrences) return false;
    }
    return true;
  }

  if (period === "yearly") {
    const diffYears = target.getFullYear() - start.getFullYear();
    if (diffYears % interval !== 0) return false;
    if (target.getMonth() !== start.getMonth() || target.getDate() !== start.getDate()) return false;

    if (endsType === "occurrences") {
      const occurrenceIndex = Math.floor(diffYears / interval);
      if (occurrenceIndex >= endsOccurrences) return false;
    }
    return true;
  }

  return false;
}

interface Interval {
  start: number;
  end: number;
}

/**
 * Given all matching availability records for a single day, compute merged unavailable intervals
 * in minutes (0 to 1440).
 */
function getUnavailableIntervals(matchingAvailabilities: AircraftAvailability[]): Interval[] {
  if (!matchingAvailabilities || matchingAvailabilities.length === 0) {
    return [];
  }

  const rawIntervals: Interval[] = [];

  for (const avail of matchingAvailabilities) {
    if (avail.all_day) {
      rawIntervals.push({ start: 0, end: 1440 });
      continue;
    }

    const [sH, sM] = avail.start_time.split(":").map(Number);
    const [eH, eM] = avail.end_time.split(":").map(Number);

    let startMin = (sH || 0) * 60 + (sM || 0);
    let endMin = (eH || 0) * 60 + (eM || 0);

    if (endMin <= startMin && endMin === 0) {
      endMin = 1440;
    }

    startMin = Math.max(0, Math.min(1440, startMin));
    endMin = Math.max(startMin, Math.min(1440, endMin));

    if (endMin > startMin) {
      rawIntervals.push({ start: startMin, end: endMin });
    }
  }

  if (rawIntervals.length === 0) return [];

  rawIntervals.sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const item of rawIntervals) {
    if (merged.length === 0) {
      merged.push({ ...item });
    } else {
      const last = merged[merged.length - 1];
      if (item.start <= last.end) {
        last.end = Math.max(last.end, item.end);
      } else {
        merged.push({ ...item });
      }
    }
  }

  return merged;
}

export default function AircraftCalendarScreen() {
  const router = useRouter();
  const { id, model, registration, recurrenceResult } = useLocalSearchParams<{
    id: string;
    model: string;
    registration: string;
    recurrenceResult?: string;
  }>();

  // Fetch all availability records for this aircraft
  const { data: availabilities = [], isLoading } = useAircraftAvailability(id);

  // Get current date
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  // Listen to returned recurrence result from the next screen and print it
  useEffect(() => {
    if (recurrenceResult) {
      try {
        const parsed = JSON.parse(recurrenceResult);
        console.log("Recurrence Data Received:", parsed);
      } catch (e) {
        console.error("Error parsing recurrence result:", e);
      }
    }
  }, [recurrenceResult]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
    setSelectedDay(null);
  };

  // Calendar math
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getStartDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
  };

  const generateCalendarCells = (year: number, month: number) => {
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getStartDayOfMonth(year, month);

    const cells: (number | null)[] = [];

    for (let i = 0; i < startDay; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }

    return rows;
  };

  const calendarRows = generateCalendarCells(currentYear, currentMonth);

  // Helper to check if a cell is today
  const isToday = (day: number | null) => {
    if (day === null) return false;
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

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
          Calendario
        </ThemedText>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Title Section Card */}
        <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center shadow-sm">
          <View className="flex-1 mr-4">
            <ThemedText className="font-bold text-xl text-white">
              {model || "Aeronave"}
            </ThemedText>
            <ThemedText type="caption" className="text-slate-300 text-md mt-1 font-semibold">
              Agenda mensual
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

        {/* Calendar Card container */}
        <ThemedView
          variant="card"
          className="p-5 mb-5 border border-slate-100 bg-white"
        >
          {/* Controls to choose a month */}
          <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-slate-100">
            <TouchableOpacity
              onPress={handlePrevMonth}
              className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#0f1e3d" />
            </TouchableOpacity>

            <View className="flex-row items-center justify-center flex-1 gap-2">
              <ThemedText className="text-brand-blue text-lg font-bold text-center">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </ThemedText>
              {isLoading && <ActivityIndicator size="small" color="#0f1e3d" />}
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={20} color="#0f1e3d" />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View className="flex-col gap-2">
            {/* Weekdays Row */}
            <View className="flex-row justify-between mb-2">
              {WEEKDAYS.map((day, idx) => (
                <View key={idx} className="flex-1 items-center py-1">
                  <ThemedText
                    type="caption"
                    className="font-bold text-xs text-brand-muted uppercase"
                  >
                    {day}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* Weeks rows */}
            {calendarRows.map((row, rowIdx) => (
              <View key={rowIdx} className="flex-row justify-between h-14">
                {row.map((cell, cellIdx) => {
                  const isCurrentDay = isToday(cell);
                  const isSelected = cell !== null && cell === selectedDay;

                  let unavailableIntervals: Interval[] = [];

                  if (cell !== null) {
                    const monthStr = String(currentMonth + 1).padStart(2, "0");
                    const dayStr = String(cell).padStart(2, "0");
                    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

                    const matching = availabilities.filter((a) =>
                      isAvailabilityOnDate(a, dateStr)
                    );
                    unavailableIntervals = getUnavailableIntervals(matching);
                  }

                  return (
                    <View
                      key={cellIdx}
                      className="flex-1 items-center justify-start py-0.5"
                    >
                      {cell !== null ? (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedDay(cell);
                            const monthStr = String(currentMonth + 1).padStart(2, "0");
                            const dayStr = String(cell).padStart(2, "0");
                            const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
                            router.push({
                              pathname: "/aircrafts/day-schedule",
                              params: {
                                id,
                                selectedDate: dateStr,
                                model,
                                registration,
                              },
                            });
                          }}
                          className={`w-9 h-9 rounded-full items-center justify-center ${isSelected
                            ? "bg-brand-blue"
                            : isCurrentDay
                              ? "border border-brand-gold bg-slate-50"
                              : "bg-transparent"
                            }`}
                          activeOpacity={0.7}
                        >
                          <ThemedText
                            className={`text-sm font-semibold ${isSelected
                              ? "text-white font-bold"
                              : isCurrentDay
                                ? "text-brand-gold font-bold"
                                : "text-slate-700"
                              }`}
                          >
                            {cell}
                          </ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <View className="w-9 h-9" />
                      )}

                      {/* Unavailability 24h segment indicator */}
                      {cell !== null && (
                        <View className="w-7 h-1 rounded-full overflow-hidden relative mt-1 bg-emerald-400">
                          {unavailableIntervals.map((interval, iIdx) => {
                            const leftPct = (interval.start / 1440) * 100;
                            const widthPct = ((interval.end - interval.start) / 1440) * 100;
                            return (
                              <View
                                key={iIdx}
                                style={{
                                  position: "absolute",
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  top: 0,
                                  bottom: 0,
                                }}
                                className="bg-rose-400"
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Calendar Legend */}
          <View className="flex-row items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
            <View className="flex-row items-center gap-1.5">
              <View className="w-4 h-1.5 bg-emerald-400 rounded-full" />
              <ThemedText type="caption" className="text-slate-500 text-xs font-medium">
                Disponible (24h)
              </ThemedText>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-4 h-1.5 bg-rose-400 rounded-full" />
              <ThemedText type="caption" className="text-slate-500 text-xs font-medium">
                Indisponible
              </ThemedText>
            </View>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
