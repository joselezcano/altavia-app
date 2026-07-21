import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

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

export default function AircraftCalendarScreen() {
  const router = useRouter();
  const { id, model, registration, recurrenceResult } = useLocalSearchParams<{
    id: string;
    model: string;
    registration: string;
    recurrenceResult?: string;
  }>();

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
    // Clear selected day when changing month to avoid out-of-bounds selection
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
    // Clear selected day when changing month to avoid out-of-bounds selection
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

    // Prepend nulls for empty slots before day 1
    for (let i = 0; i < startDay; i++) {
      cells.push(null);
    }

    // Add days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }

    // Append nulls to complete the last week row
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    // Split cells into rows of 7 days
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
        <View className="bg-brand-blue rounded-3xl p-5 mb-5 flex-row justify-between items-center">
          <View className="flex-1 mr-4">
            <ThemedText className="font-bold text-xl text-white">
              {model || "Aeronave"}
            </ThemedText>
            <ThemedText type="caption" className="text-slate-300 text-xs mt-0.5">
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
          {/* Controls to choose a month - must be on top of the calendar */}
          <View className="flex-row justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <TouchableOpacity
              onPress={handlePrevMonth}
              className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#0f1e3d" />
            </TouchableOpacity>

            <ThemedText className="text-brand-blue text-lg font-bold text-center flex-1">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </ThemedText>

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
              <View key={rowIdx} className="flex-row justify-between h-12">
                {row.map((cell, cellIdx) => {
                  const isCurrentDay = isToday(cell);
                  const isSelected = cell !== null && cell === selectedDay;
                  return (
                    <View
                      key={cellIdx}
                      className="flex-1 items-center justify-center"
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
                          className={`w-9 h-9 rounded-full items-center justify-center ${
                            isSelected
                              ? "bg-brand-blue"
                              : isCurrentDay
                              ? "border border-brand-gold bg-slate-50"
                              : "bg-transparent"
                          }`}
                          activeOpacity={0.7}
                        >
                          <ThemedText
                            className={`text-sm font-semibold ${
                              isSelected
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
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ThemedView>

        {/* Configure Recurrence Button below calendar */}
        <TouchableOpacity
          onPress={() => {
            if (selectedDay === null) return;
            const monthStr = String(currentMonth + 1).padStart(2, "0");
            const dayStr = String(selectedDay).padStart(2, "0");
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
          disabled={selectedDay === null}
          className={`py-3.5 rounded-xl items-center justify-center mb-8 flex-row gap-2 ${
            selectedDay === null ? "bg-slate-300" : "bg-brand-blue"
          }`}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
          <ThemedText className="text-white font-bold">
            Ver Agenda del Día
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}
