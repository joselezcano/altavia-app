import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { AircraftAvailability, AircraftAvailabilitySchema } from "@/types/all-roles";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

const PERIOD_LABELS = [
  { value: "none", label: "No se repite" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
];

const DAYS_OF_WEEK = [
  { value: "Dom", label: "D", eng: "Sunday" },
  { value: "Lun", label: "L", eng: "Monday" },
  { value: "Mar", label: "M", eng: "Tuesday" },
  { value: "Mie", label: "M", eng: "Wednesday" },
  { value: "Jue", label: "J", eng: "Thursday" },
  { value: "Vie", label: "V", eng: "Friday" },
  { value: "Sab", label: "S", eng: "Saturday" },
];

const REASON_OPTIONS: { value: AircraftAvailability["reason"]; label: string; icon: string }[] = [
  { value: "maintenance", label: "Mantenimiento", icon: "build-outline" },
  { value: "owner_use", label: "Uso del Propietario", icon: "ribbon-outline" },
  { value: "holidays", label: "Vacaciones", icon: "sunny-outline" },
  { value: "not_in_base", label: "Fuera de Base", icon: "location-outline" },
  { value: "no_pilot", label: "Sin Piloto", icon: "person-remove-outline" },
  { value: "rental", label: "Alquiler", icon: "key-outline" },
  { value: "legal_restriction", label: "Restricción Legal", icon: "document-text-outline" },
  { value: "other", label: "Otro", icon: "bookmark-outline" },
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
  const queryClient = useQueryClient();

  const {
    aircraftId,
    selectedDate,
    model,
    registration,
    startHour: prefilledStartHour,
    endHour: prefilledEndHour,
  } = useLocalSearchParams<{
    aircraftId: string;
    selectedDate: string;
    model: string;
    registration: string;
    startHour?: string;
    endHour?: string;
  }>();

  // Form selected date input state (Shown First)
  const [selectedDateInput, setSelectedDateInput] = useState(selectedDate || "");

  // Time Range States
  const [startHour, setStartHour] = useState(prefilledStartHour ? Number(prefilledStartHour) : 9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(prefilledEndHour ? Number(prefilledEndHour) : 10);
  const [endMinute, setEndMinute] = useState(0);

  // Recurrence Period States
  const [period, setPeriod] = useState<string>("none");
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Ends Configuration States
  const [endsType, setEndsType] = useState<"never" | "date" | "occurrences">("never");
  const [endsDate, setEndsDate] = useState("");
  const [endsOccurrences, setEndsOccurrences] = useState(10);

  // Reason and Notes States
  const [reason, setReason] = useState<AircraftAvailability["reason"]>("maintenance");
  const [notes, setNotes] = useState("");

  // Submitting loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const handleSave = async () => {
    if (!aircraftId) {
      Alert.alert("Error", "Identificador de aeronave ausente.");
      return;
    }

    // Format selected times as HH:MM
    const formatTimeStr = (h: number, m: number) => {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const startTimeStr = formatTimeStr(startHour, startMinute);
    const endTimeStr = formatTimeStr(endHour, endMinute);

    // Validate selected_date format
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const dateMatch = selectedDateInput.match(dateRegex);
    if (!dateMatch) {
      Alert.alert("Error de validación", "La fecha de disponibilidad debe tener el formato AAAA-MM-DD");
      return;
    }

    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const day = parseInt(dateMatch[3], 10);

    // Parse start and end timestamps in local time
    const startTimestamp = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const endTimestamp = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

    // Enforce end timestamp is after start timestamp
    if (endTimestamp <= startTimestamp) {
      Alert.alert("Error de validación", "La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    // Map selected UI day abbreviations to schema English weekday names
    const mapToEnglish = (day: string) => {
      switch (day) {
        case "Dom": return "Sunday";
        case "Lun": return "Monday";
        case "Mar": return "Tuesday";
        case "Mie": return "Wednesday";
        case "Jue": return "Thursday";
        case "Vie": return "Friday";
        case "Sab": return "Saturday";
        default: return "Monday";
      }
    };
    const mappedDaysOfWeek = selectedDays.map(mapToEnglish) as (
      | "Sunday"
      | "Monday"
      | "Tuesday"
      | "Wednesday"
      | "Thursday"
      | "Friday"
      | "Saturday"
    )[];

    if (period === "weekly" && mappedDaysOfWeek.length === 0) {
      Alert.alert("Error de validación", "Debe seleccionar al menos un día para la repetición semanal.");
      return;
    }

    // Validate endsDate format if endsType is date
    if (endsType === "date") {
      if (!endsDate.match(dateRegex)) {
        Alert.alert("Error de validación", "La fecha de finalización debe tener el formato AAAA-MM-DD");
        return;
      }
    }

    // Prepare availability object
    const availabilityData = {
      aircraftId,
      selected_date: selectedDateInput,
      start_time: startTimeStr,
      end_time: endTimeStr,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      recurrence: {
        period: period as "none" | "daily" | "weekly" | "monthly" | "yearly",
        interval: Number(interval),
        days_of_week: mappedDaysOfWeek,
        ends: {
          type: endsType as "never" | "date" | "occurrences",
          date: endsType === "date" ? endsDate : null,
          occurrences: endsType === "occurrences" ? Number(endsOccurrences) : 0,
        },
      },
      reason,
      notes: notes.trim(),
    };

    // Validate with AircraftAvailabilitySchema
    const parseResult = AircraftAvailabilitySchema.safeParse(availabilityData);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || "Datos del formulario inválidos.";
      Alert.alert("Error de validación", `${parseResult.error.issues[0]?.path.join(".")}: ${errorMsg}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Save data object to Firestore collection 'aircraft-availability'
      await addDoc(collection(db, "aircraft-availability"), parseResult.data);

      // Invalidate queries so daily timeline updates automatically
      queryClient.invalidateQueries({ queryKey: ["aircraft-availability", aircraftId] });

      Toast.show({
        type: "success",
        text1: "Disponibilidad registrada",
        text2: period === "none" ? "Se guardó la disponibilidad del día." : "Se guardó el evento recurrente.",
      });

      // Navigate back to the day schedule timeline screen
      router.back();
    } catch (error: any) {
      console.error("Error creating aircraft availability:", error);
      Alert.alert("Error", error.message || "No se pudo registrar la disponibilidad.");
    } finally {
      setIsSubmitting(false);
    }
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
            Añadir Indisponibilidad
          </ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* 1. Selected Date Form Input Card (Shown First) */}
          <ThemedView variant="card" className="p-5 mb-4 border border-slate-100 bg-white">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1 mr-3">
                <ThemedText className="font-bold text-brand-blue text-base">
                  {model || "Aeronave"}
                </ThemedText>
                <ThemedText className="text-brand-gold text-[10px] font-bold mt-0.5 uppercase tracking-wide">
                  {registration || "Sin Matrícula"}
                </ThemedText>
              </View>
              <View className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <ThemedText className="text-brand-blue text-xs font-bold">
                  Configurar Fecha
                </ThemedText>
              </View>
            </View>
            <View className="border-t border-slate-100 pt-3">
              <ThemedText type="caption" className="text-slate-500 font-medium mb-2">
                Fecha de Indisponibilidad (AAAA-MM-DD)
              </ThemedText>
              <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={18} color="#0f1e3d" />
                <TextInput
                  value={selectedDateInput}
                  onChangeText={setSelectedDateInput}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#94A3B8"
                  className="text-brand-blue font-semibold p-0 text-sm flex-1"
                  maxLength={10}
                />
              </View>
            </View>
          </ThemedView>

          {/* 2. Time Range Selector Card */}
          <ThemedView variant="card" className="p-5 mb-4 border border-slate-100 bg-white">
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

          {/* 3. Repeat Period Selector Card */}
          <ThemedView variant="card" className="p-5 mb-4 border border-slate-100 bg-white">
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
                    className={`px-4 py-2 rounded-xl border ${isActive
                      ? "bg-brand-blue border-brand-blue"
                      : "bg-slate-50 border-slate-200"
                      }`}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      className={`text-xs font-semibold ${isActive ? "text-white font-bold" : "text-slate-600"
                        }`}
                    >
                      {item.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Interval input */}
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

            {/* Weekly repeats */}
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
                        className={`w-9 h-9 rounded-full items-center justify-center border ${isSelected
                          ? "bg-brand-gold border-brand-gold"
                          : "bg-slate-50 border-slate-200"
                          }`}
                        activeOpacity={0.7}
                      >
                        <ThemedText
                          className={`text-xs font-bold ${isSelected ? "text-brand-blue" : "text-slate-600"
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

          {/* 4. Ends Selector Card */}
          {period !== "none" && (
            <ThemedView variant="card" className="p-5 mb-6 border border-slate-100 bg-white">
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

          {/* 5. Unavailability Reason & Notes Card */}
          <ThemedView variant="card" className="p-5 mb-6 border border-slate-100 bg-white">
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="alert-circle" size={20} color="#0f1e3d" />
              <ThemedText type="subtitle" className="font-bold text-brand-blue">
                Motivo de Indisponibilidad
              </ThemedText>
            </View>

            {/* Radio Buttons Options */}
            <View className="gap-2 mb-4">
              {REASON_OPTIONS.map((option) => {
                const isSelected = reason === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setReason(option.value)}
                    className={`flex-row items-center justify-between p-3 rounded-xl border ${isSelected
                      ? "bg-slate-50 border-brand-blue"
                      : "bg-white border-slate-200"
                      }`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={isSelected ? "#0f1e3d" : "#64748B"}
                      />
                      <ThemedText
                        className={`text-sm ${isSelected ? "font-bold text-brand-blue" : "font-medium text-slate-700"
                          }`}
                      >
                        {option.label}
                      </ThemedText>
                    </View>
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={isSelected ? "#0f1e3d" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes Input Area */}
            <View className="border-t border-slate-100 pt-3">
              <ThemedText type="caption" className="text-slate-500 font-medium mb-2">
                Notas adicionales (Opcional)
              </ThemedText>
              <View className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ej. Detalle del mantenimiento o nota de uso..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  className="text-brand-blue text-sm min-h-[70px]"
                />
              </View>
            </View>
          </ThemedView>

          {/* Action Confirmation Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting}
            className={`py-3.5 rounded-xl items-center justify-center mb-8 flex-row gap-2 ${isSubmitting ? "bg-slate-300" : "bg-brand-blue"
              }`}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <ThemedText className="text-white font-bold text-base">
                  Guardar Indisponibilidad
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
