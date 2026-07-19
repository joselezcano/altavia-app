import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from './themed-text';

interface CustomDatePickerProps {
  value: Date | null;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  minimumDate?: Date | null;
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder,
  minimumDate,
}: CustomDatePickerProps) {
  // Android state
  const [pickerStage, setPickerStage] = useState<'idle' | 'date' | 'time'>('idle');
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // iOS state
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date>(new Date());

  const handleOpen = () => {
    const initialDate = value || new Date();
    if (Platform.OS === 'android') {
      setTempDate(initialDate);
      setPickerStage('date');
    } else if (Platform.OS === 'ios') {
      setIosTempDate(initialDate);
      setShowIOSModal(true);
    }
  };

  const handleClear = () => {
    onChange(undefined);
  };

  const formatReadable = (date: Date) => {
    return date.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleIOSConfirm = () => {
    onChange(iosTempDate);
    setShowIOSModal(false);
  };

  return (
    <View className="w-full">
      <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <TouchableOpacity onPress={handleOpen} className="flex-1 flex-row items-center justify-between">
          <ThemedText className={value ? "text-brand-text font-medium text-xs" : "text-slate-400 font-medium text-xs"}>
            {value ? formatReadable(value) : (placeholder || "Seleccionar fecha / hora")}
          </ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {value !== undefined && (
          <TouchableOpacity onPress={handleClear} className="ml-2 pl-2 border-l border-slate-200">
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Android Picker Dialog Sequence */}
      {Platform.OS === 'android' && pickerStage === 'date' && (
        <DateTimePicker
          value={tempDate || new Date()}
          mode="date"
          minimumDate={minimumDate === null ? undefined : minimumDate}
          presentation="dialog"
          onValueChange={(event, date) => {
            if (date) {
              const newDate = new Date(tempDate || new Date());
              newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              setTempDate(newDate);
              setPickerStage('time');
            } else {
              setPickerStage('idle');
            }
          }}
          onDismiss={() => setPickerStage('idle')}
        />
      )}

      {Platform.OS === 'android' && pickerStage === 'time' && (
        <DateTimePicker
          value={tempDate || new Date()}
          mode="time"
          is24Hour={true}
          presentation="dialog"
          onValueChange={(event, time) => {
            if (time) {
              const finalDate = new Date(tempDate || new Date());
              finalDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(finalDate);
            }
            setPickerStage('idle');
          }}
          onDismiss={() => setPickerStage('idle')}
        />
      )}

      {/* iOS Bottom Sheet Modal */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showIOSModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowIOSModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowIOSModal(false)}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowIOSModal(false)}>
                  <ThemedText className="text-slate-500 font-medium">Cancelar</ThemedText>
                </TouchableOpacity>
                <ThemedText className="font-bold text-slate-900 text-sm">Seleccionar Fecha / Hora</ThemedText>
                <TouchableOpacity onPress={handleIOSConfirm}>
                  <ThemedText className="text-brand-blue font-bold">Listo</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={iosTempDate}
                  mode="datetime"
                  minimumDate={minimumDate === null ? undefined : minimumDate}
                  display="inline"
                  style={styles.picker}
                  onValueChange={(event, date) => {
                    if (date) setIosTempDate(date);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  picker: {
    width: 320,
    height: 320,
    alignSelf: 'center',
  },
});
