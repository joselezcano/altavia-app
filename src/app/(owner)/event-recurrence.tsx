import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";

const PERIOD_LABELS = [
  { value: "none", label: "No se repite" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
];

const DAYS_OF_WEEK = [
  { value: "Dom", label: "D" },
  { value: "Lun", label: "L" },
  { value: "Mar", label: "M" },
  { value: "Mie", label: "M" },
  { value: "Jue", label: "J" },
  { value: "Vie", label: "V" },
  { value: "Sab", label: "S" },
];

// Helper Time Spinner render component
const TimeSpinner = ({
  value,
  onInc,
  onDec,
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
}) => (
  <View className="items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 flex-row gap-1">
    <TouchableOpacity
      onPress={onDec}
      className="w-8 h-8 items-center justify-center bg-white border border-slate-100 rounded-lg"
    >
      <Ionicons name="remove" size={16} color="#0f1e3d" />
    </TouchableOpacity>
    <ThemedText className="text-brand-blue font-bold text-lg text-center w-8">
      {String(value).padStart(2, "0")}
    </ThemedText>
    <TouchableOpacity
      onPress={onInc}
      className="w-8 h-8 items-center justify-center bg-white border border-slate-100 rounded-lg"
    >
      <Ionicons name="add" size={16} color="#0f1e3d" />
    </TouchableOpacity>
  </View>
);

export default function EventRecurrenceScreen() {
  const router = useRouter();
  const { selectedDate, model, registration } = useLocalSearchParams<{
    selectedDate: string;
    model: string;
    registration: string;
  }>();

  // Time Range States
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);

  // Recurrence Period States
  const [period, setPeriod] = useState<string>("none");
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Ends Configuration States
  const [endsType, setEndsType] = useState<"never" | "date" | "occurrences">("never");
  const [endsDate, setEndsDate] = useState("");
  const [endsOccurrences, setEndsOccurrences] = useState(10);

  // Format the selected date nicely
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

  // Helper incrementers for Time
  const adjustStartHour = (inc: number) => {
    setStartHour((prev) => {
      let next = prev + inc;
      if (next > 23) return 0;
      if (next < 0) return 23;
      return next;
    });
  };

  const adjustStartMinute = (inc: number) => {
    setStartMinute((prev) => {
      let next = prev + inc;
      if (next > 59) return 0;
      if (next < 0) return 59;
      return next;
    });
  };

  const adjustEndHour = (inc: number) => {
    setEndHour((prev) => {
      let next = prev + inc;
      if (next > 23) return 0;
      if (next < 0) return 23;
      return next;
    });
  };

  const adjustEndMinute = (inc: number) => {
    setEndMinute((prev) => {
      let next = prev + inc;
      if (next > 59) return 0;
      if (next < 0) return 59;
      return next;
    });
  };

  // Days of week toggler
  const toggleDay = (dayValue: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  // Submit Handler
  const handleSave = () => {
    const formatTime = (h: number, m: number) => {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const recurrenceResultData = {
      selectedDate,
      startTime: formatTime(startHour, startMinute),
      endTime: formatTime(endHour, endMinute),
      recurrence: {
        period,
        interval,
        ...(period === "weekly" ? { daysOfWeek: selectedDays } : {}),
        ends: {
          type: endsType,
          ...(endsType === "date" ? { date: endsDate } : {}),
          ...(endsType === "occurrences" ? { occurrences: endsOccurrences } : {}),
        },
      },
    };

    // Print JSON output in console
    console.log("Saving recurrence schedule JSON:", JSON.stringify(recurrenceResultData, null, 2));

    // Navigate back to the calendar, sending results via router search params
    router.navigate({
      pathname: "/aircraft-calendar",
      params: {
        model,
        registration,
        recurrenceResult: JSON.stringify(recurrenceResultData),
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-brand-light"
    >
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
            Configurar Repetición
          </ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* Selected Date Information Card */}
          <View className="bg-brand-blue rounded-3xl p-5 mb-5">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-3">
                <ThemedText className="font-bold text-white text-base">
                  {model || "Aeronave"}
                </ThemedText>
                <ThemedText className="text-brand-gold text-[11px] font-bold mt-0.5 uppercase tracking-wide">
                  {registration || "Sin Matrícula"}
                </ThemedText>
              </View>
              <View className="bg-white/10 px-3 py-1 rounded-lg">
                <ThemedText className="text-white text-xs font-semibold">
                  Agenda Recurrente
                </ThemedText>
              </View>
            </View>
            <View className="mt-4 pt-3 border-t border-white/10">
              <ThemedText type="caption" className="text-slate-300 text-xs font-semibold uppercase">
                Fecha Seleccionada
              </ThemedText>
              <ThemedText className="text-white font-bold text-lg mt-0.5 capitalize">
                {getFormattedDate()}
              </ThemedText>
            </View>
          </View>

          {/* 1. Time Range Selector Card */}
          <ThemedView variant="card" className="p-5 mb-4 border border-slate-100">
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="time" size={20} color="#0f1e3d" />
              <ThemedText type="subtitle" className="font-bold text-brand-blue">
                Rango Horario
              </ThemedText>
            </View>

            {/* Start Time row */}
            <View className="flex-row justify-between items-center py-2.5 border-b border-slate-100">
              <ThemedText type="caption" className="text-slate-500 font-medium">
                Hora de Inicio
              </ThemedText>
              <View className="flex-row items-center gap-2">
                <TimeSpinner
                  value={startHour}
                  onInc={() => adjustStartHour(1)}
                  onDec={() => adjustStartHour(-1)}
                />
                <ThemedText className="font-bold text-brand-blue">:</ThemedText>
                <TimeSpinner
                  value={startMinute}
                  onInc={() => adjustStartMinute(5)}
                  onDec={() => adjustStartMinute(-5)}
                />
              </View>
            </View>

            {/* End Time row */}
            <View className="flex-row justify-between items-center py-2.5">
              <ThemedText type="caption" className="text-slate-500 font-medium">
                Hora de Fin
              </ThemedText>
              <View className="flex-row items-center gap-2">
                <TimeSpinner
                  value={endHour}
                  onInc={() => adjustEndHour(1)}
                  onDec={() => adjustEndHour(-1)}
                />
                <ThemedText className="font-bold text-brand-blue">:</ThemedText>
                <TimeSpinner
                  value={endMinute}
                  onInc={() => adjustEndMinute(5)}
                  onDec={() => adjustEndMinute(-5)}
                />
              </View>
            </View>
          </ThemedView>

          {/* 2. Repeat Period Selector Card */}
          <ThemedView variant="card" className="p-5 mb-4 border border-slate-100">
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="repeat" size={20} color="#0f1e3d" />
              <ThemedText type="subtitle" className="font-bold text-brand-blue">
                Frecuencia y Período
              </ThemedText>
            </View>

            {/* Chips period list */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              {PERIOD_LABELS.map((item) => {
                const isActive = period === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    onPress={() => setPeriod(item.value)}
                    className={`px-4 py-2 rounded-xl border ${
                      isActive
                        ? "bg-brand-blue border-brand-blue"
                        : "bg-slate-50 border-slate-200"
                    }`}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      className={`text-xs font-semibold ${
                        isActive ? "text-white font-bold" : "text-slate-600"
                      }`}
                    >
                      {item.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Interval input (Google Calendar style: Repeat every X weeks/months...) */}
            {period !== "none" && (
              <View className="flex-row justify-between items-center py-3 border-t border-slate-100">
                <ThemedText type="caption" className="text-slate-500 font-medium">
                  Repetir cada
                </ThemedText>
                <View className="flex-row items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                  <TouchableOpacity
                    onPress={() => setInterval((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 items-center justify-center bg-white border border-slate-100 rounded-lg"
                  >
                    <Ionicons name="remove" size={16} color="#0f1e3d" />
                  </TouchableOpacity>
                  <ThemedText className="text-brand-blue font-bold text-base text-center w-8">
                    {interval}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setInterval((prev) => prev + 1)}
                    className="w-8 h-8 items-center justify-center bg-white border border-slate-100 rounded-lg"
                  >
                    <Ionicons name="add" size={16} color="#0f1e3d" />
                  </TouchableOpacity>
                  <ThemedText className="text-xs text-brand-muted font-medium ml-1">
                    {period === "daily"
                      ? "días"
                      : period === "weekly"
                      ? "semanas"
                      : period === "monthly"
                      ? "meses"
                      : "años"}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Weekly repeats (Select specific days of the week) */}
            {period === "weekly" && (
              <View className="mt-3 pt-3 border-t border-slate-100">
                <ThemedText type="caption" className="text-slate-500 font-medium mb-3">
                  Repetir en los siguientes días
                </ThemedText>
                <View className="flex-row justify-between">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                      <TouchableOpacity
                        key={day.value}
                        onPress={() => toggleDay(day.value)}
                        className={`w-9 h-9 rounded-full items-center justify-center border ${
                          isSelected
                            ? "bg-brand-gold border-brand-gold"
                            : "bg-slate-50 border-slate-200"
                        }`}
                        activeOpacity={0.7}
                      >
                        <ThemedText
                          className={`text-xs font-bold ${
                            isSelected ? "text-brand-blue" : "text-slate-600"
                          }`}
                        >
                          {day.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ThemedView>

          {/* 3. Ends Selector Card (Google Calendar style: Ends condition) */}
          {period !== "none" && (
            <ThemedView variant="card" className="p-5 mb-6 border border-slate-100">
              <View className="flex-row items-center gap-2 mb-4">
                <Ionicons name="flag" size={20} color="#0f1e3d" />
                <ThemedText type="subtitle" className="font-bold text-brand-blue">
                  Finalización del Evento
                </ThemedText>
              </View>

              {/* Option 1: Never */}
              <TouchableOpacity
                onPress={() => setEndsType("never")}
                className="flex-row items-center justify-between py-2 border-b border-slate-100"
                activeOpacity={0.7}
              >
                <ThemedText type="caption" className="text-slate-600 font-medium">
                  Nunca termina
                </ThemedText>
                <Ionicons
                  name={endsType === "never" ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={endsType === "never" ? "#0f1e3d" : "#94A3B8"}
                />
              </TouchableOpacity>

              {/* Option 2: Date */}
              <View className="py-2.5 border-b border-slate-100">
                <TouchableOpacity
                  onPress={() => setEndsType("date")}
                  className="flex-row items-center justify-between mb-2"
                  activeOpacity={0.7}
                >
                  <ThemedText type="caption" className="text-slate-600 font-medium">
                    El (Fecha límite)
                  </ThemedText>
                  <Ionicons
                    name={endsType === "date" ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={endsType === "date" ? "#0f1e3d" : "#94A3B8"}
                  />
                </TouchableOpacity>
                {endsType === "date" && (
                  <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 mt-1">
                    <TextInput
                      value={endsDate}
                      onChangeText={setEndsDate}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor="#94A3B8"
                      className="text-slate-700 font-semibold p-0 text-sm"
                      maxLength={10}
                    />
                  </View>
                )}
              </View>

              {/* Option 3: Occurrences */}
              <View className="py-2.5 flex-row justify-between items-center">
                <TouchableOpacity
                  onPress={() => setEndsType("occurrences")}
                  className="flex-row items-center gap-2"
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={endsType === "occurrences" ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={endsType === "occurrences" ? "#0f1e3d" : "#94A3B8"}
                  />
                  <ThemedText type="caption" className="text-slate-600 font-medium">
                    Después de
                  </ThemedText>
                </TouchableOpacity>

                {endsType === "occurrences" && (
                  <View className="flex-row items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                    <TouchableOpacity
                      onPress={() => setEndsOccurrences((prev) => Math.max(1, prev - 1))}
                      className="w-8 h-8 items-center justify-center bg-white border border-slate-100 rounded-lg"
                    >
                      <Ionicons name="remove" size={16} color="#0f1e3d" />
                    </TouchableOpacity>
                    <ThemedText className="text-brand-blue font-bold text-base text-center w-8">
                      {endsOccurrences}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setEndsOccurrences((prev) => prev + 1)}
                      className="w-8 h-8 items-center justify-center bg-white border border-slate-100 rounded-lg"
                    >
                      <Ionicons name="add" size={16} color="#0f1e3d" />
                    </TouchableOpacity>
                    <ThemedText className="text-xs text-brand-muted font-medium ml-1">
                      ocurrencias
                    </ThemedText>
                  </View>
                )}
              </View>
            </ThemedView>
          )}

          {/* Action Confirmation Button */}
          <TouchableOpacity
            onPress={handleSave}
            className="bg-brand-blue py-3.5 rounded-xl items-center justify-center mb-8 flex-row gap-2"
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <ThemedText className="text-white font-bold text-base">
              Guardar Configuración
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
