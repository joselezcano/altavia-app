import { CustomDatePickerProps } from '@/types/components';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from './themed-text';

export function CustomDatePicker({
  value,
  onChange,
  placeholder,
  minimumDate,
  includeTime = true,
}: CustomDatePickerProps) {
  // Android state
  const [pickerStage, setPickerStage] = useState<'idle' | 'date' | 'time'>('idle');
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // iOS state
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date>(new Date());
  const [iosTab, setIosTab] = useState<'date' | 'time'>('date');

  const handleOpen = () => {
    const initialDate = value || new Date();
    if (Platform.OS === 'android') {
      setTempDate(initialDate);
      setPickerStage('date');
    } else if (Platform.OS === 'ios') {
      setIosTempDate(initialDate);
      setIosTab('date');
      setShowIOSModal(true);
    }
  };

  const handleClear = () => {
    onChange(undefined);
  };

  const formatReadable = (date: Date) => {
    if (!includeTime) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
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
          <ThemedText className={value ? "text-brand-text font-medium text-sm" : "text-slate-400 font-medium text-xs"}>
            {value ? formatReadable(value) : (placeholder || (includeTime ? "Seleccionar fecha / hora" : "Seleccionar fecha"))}
          </ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {value !== undefined && value !== null && (
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
              if (includeTime) {
                setTempDate(newDate);
                setPickerStage('time');
              } else {
                onChange(newDate);
                setPickerStage('idle');
              }
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
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.titleText}>
                  {includeTime ? "Seleccionar Fecha y Hora" : "Seleccionar Fecha"}
                </Text>
                <TouchableOpacity onPress={handleIOSConfirm} style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>Listo</Text>
                </TouchableOpacity>
              </View>

              {/* Segmented Switch for Fecha / Hora on iOS */}
              {includeTime && (
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    onPress={() => setIosTab('date')}
                    style={[
                      styles.tabButton,
                      iosTab === 'date' ? styles.tabButtonActive : null,
                    ]}
                  >
                    <Ionicons
                      name="calendar"
                      size={16}
                      color={iosTab === 'date' ? '#030436' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        iosTab === 'date' ? styles.tabTextActive : null,
                      ]}
                    >
                      Fecha ({iosTempDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' })})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIosTab('time')}
                    style={[
                      styles.tabButton,
                      iosTab === 'time' ? styles.tabButtonActive : null,
                    ]}
                  >
                    <Ionicons
                      name="time"
                      size={16}
                      color={iosTab === 'time' ? '#030436' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        iosTab === 'time' ? styles.tabTextActive : null,
                      ]}
                    >
                      Hora ({iosTempDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.pickerContainer}>
                {(!includeTime || iosTab === 'date') ? (
                  <DateTimePicker
                    value={iosTempDate}
                    mode="date"
                    minimumDate={minimumDate === null ? undefined : minimumDate}
                    display="inline"
                    themeVariant="light"
                    accentColor="#030436"
                    style={styles.datePicker}
                    onValueChange={(event, date) => {
                      if (date) {
                        const updated = new Date(iosTempDate);
                        updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                        setIosTempDate(updated);
                      }
                    }}
                  />
                ) : (
                  <View style={styles.timePickerContainer}>
                    <DateTimePicker
                      value={iosTempDate}
                      mode="time"
                      display="spinner"
                      themeVariant="light"
                      accentColor="#030436"
                      style={styles.timePicker}
                      onValueChange={(event, date) => {
                        if (date) {
                          const updated = new Date(iosTempDate);
                          updated.setHours(date.getHours(), date.getMinutes(), 0, 0);
                          setIosTempDate(updated);
                        }
                      }}
                    />
                  </View>
                )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
  cancelButtonText: {
    color: '#64748B',
    fontFamily: "NotoSans_500Medium",
    fontSize: 14,
  },
  titleText: {
    fontFamily: "NotoSans_700Bold",
    color: '#030436',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#030436',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontFamily: "NotoSans_700Bold",
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "NotoSans_700Bold",
    color: '#64748B',
  },
  tabTextActive: {
    color: '#030436',
  },
  pickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  timePickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  datePicker: {
    width: 320,
    height: 330,
    alignSelf: 'center',
  },
  timePicker: {
    width: '100%',
    height: 200,
    alignSelf: 'center',
  },
});
