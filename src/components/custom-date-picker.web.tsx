import { CustomDatePickerProps } from "@/types/components";
import { Ionicons } from "@expo/vector-icons";
import React, { useId } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function CustomDatePicker({
  value,
  onChange,
  placeholder,
  minimumDate,
  includeTime = true,
}: CustomDatePickerProps) {
  const inputId = useId();

  // Formato para input HTML: YYYY-MM-DDTHH:mm o YYYY-MM-DD
  const toInputValue = (date: Date | null | undefined): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (!includeTime) {
      return `${year}-${month}-${day}`;
    }
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const toMinString = (date: Date | null | undefined): string | undefined => {
    if (!date) return undefined;
    return toInputValue(date);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(undefined);
      return;
    }
    // Parsear fecha respetando la zona horaria local
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      onChange(parsed);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <View style={styles.container}>
      <label htmlFor={inputId} style={styles.webLabelWrapper}>
        <View style={styles.inputCard}>
          <input
            id={inputId}
            type={includeTime ? "datetime-local" : "date"}
            value={toInputValue(value)}
            min={toMinString(minimumDate)}
            onChange={handleInputChange}
            style={styles.nativeHtmlInput}
          />
          <View style={styles.iconContainer} pointerEvents="none">
            <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
          </View>
        </View>
      </label>

      {value !== undefined && value !== null && (
        <TouchableOpacity
          onPress={handleClear as any}
          style={styles.clearButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  webLabelWrapper: {
    width: "100%",
    display: "flex",
    cursor: "pointer",
  },
  inputCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nativeHtmlInput: {
    width: "100%",
    border: "none",
    background: "transparent",
    outline: "none",
    fontSize: "14px",
    fontWeight: 500,
    color: "#0F172A",
    fontFamily: "inherit",
    cursor: "pointer",
  } as any,
  iconContainer: {
    marginLeft: 8,
  },
  clearButton: {
    position: "absolute",
    right: 38,
    padding: 4,
  },
});
