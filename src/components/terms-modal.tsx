import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export function TermsModal({ visible, onClose, onAccept }: TermsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100">
          <View>
            <ThemedText type="caption" className="uppercase font-bold text-brand-gold tracking-widest text-[11px]">
              Legal & Regulatorio
            </ThemedText>
            <ThemedText type="subtitle" className="font-extrabold text-brand-blue text-lg">
              Términos y Condiciones
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            accessibilityLabel="Cerrar términos"
          >
            <Ionicons name="close" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }}
          className="flex-1"
        >
          <ThemedText className="text-xs text-slate-500 mb-4 font-medium">
            Última actualización: Octubre 2026 • Versión 1.0 (Conforme a normativas DINAC)
          </ThemedText>

          <View className="" style={{ gap: 20 }}>
            <View>
              <ThemedText className="font-bold text-slate-900 text-sm mb-1">
                1. Naturaleza de la Plataforma y Servicio
              </ThemedText>
              <ThemedText className="text-xs text-slate-600 leading-relaxed">
                ALTA VÍA es una plataforma tecnológica que facilita la reserva, gestión y coordinación de servicios aéreos privados, arrendamientos de aeronaves (Dry Lease) y operaciones ejecutivas en la República del Paraguay y rutas internacionales habilitadas. ALTA VÍA opera en estricta conformidad con las disposiciones del Código Aeronáutico Paraguayo (Ley N° 1860/02) y los Reglamentos de la Dirección Nacional de Aeronáutica Civil (DINAC).
              </ThemedText>
            </View>

            <View>
              <ThemedText className="font-bold text-slate-900 text-sm mb-1">
                2. Capacidad Legal y Modalidades de Registro
              </ThemedText>
              <ThemedText className="text-xs text-slate-600 leading-relaxed">
                Pueden registrarse y contratar tanto personas físicas (nacionales o extranjeras) legalmente capacitadas, como personas jurídicas (empresas debidamente constituidas con RUC vigente y representante legal acreditado). Los datos proporcionados revisten carácter de declaración jurada a los efectos operacionales y fiscales.
              </ThemedText>
            </View>

            <View>
              <ThemedText className="font-bold text-slate-900 text-sm mb-1">
                3. Tarifas, Confirmación y Pago del 100%
              </ThemedText>
              <ThemedText className="text-xs text-slate-600 leading-relaxed">
                Para garantizar la reserva en firme y bloquear la disponibilidad de la aeronave seleccionada, el cliente deberá completar el pago del 100% del valor pactado del vuelo previo a la emisión definitiva del itinerario operacional.
              </ThemedText>
            </View>

            <View>
              <ThemedText className="font-bold text-slate-900 text-sm mb-1">
                4. Verificación de Identidad (KYC) y Requisitos de Abordaje
              </ThemedText>
              <ThemedText className="text-xs text-slate-600 leading-relaxed">
                Todo pasajero y titular de reserva debe completar el procedimiento de validación de identidad biométrica y documental (KYC) mediante el proveedor oficial homologado (Didit.me) o exhibiendo documento original hábil (Cédula de Identidad, DNI o Pasaporte) previo a ingresar a las áreas estériles o abordar la aeronave.
              </ThemedText>
            </View>

            <View>
              <ThemedText className="font-bold text-slate-900 text-sm mb-1">
                5. Retención Legal de Registros de Vuelo (DINAC) y Privacidad
              </ThemedText>
              <ThemedText className="text-xs text-slate-600 leading-relaxed">
                El usuario tiene derecho a solicitar la eliminación o anonimización de su cuenta de usuario en cualquier momento. Sin embargo, en cumplimiento de los estándares obligatorios de Seguridad Operacional (SMS), regulaciones de la DINAC y convenios de la OACI, los registros históricos de vuelos, bitácoras operacionales y manifiestos de pasajeros serán preservados con carácter inmutable, seguro y confidencial exclusivamente para fines de auditoría técnica y cumplimiento legal aeronáutico.
              </ThemedText>
            </View>

            <View>
              <ThemedText className="font-bold text-slate-900 text-sm mb-1">
                6. Seguridad y Condiciones Meteorológicas
              </ThemedText>
              <ThemedText className="text-xs text-slate-600 leading-relaxed">
                El Comandante de la aeronave tiene la máxima autoridad decisoria a bordo respecto a la seguridad del vuelo, incluyendo demoras o reprogramaciones derivadas de condiciones meteorológicas adversas o restricciones de control de tránsito aéreo (ATC).
              </ThemedText>
            </View>
          </View>

          <View className="h-6" />
        </ScrollView>

        {/* Footer Actions */}
        <View className="p-4 border-t border-slate-100 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={onClose}
            className="flex-1 py-3.5 rounded-xl border border-slate-300 items-center justify-center active:bg-slate-50"
          >
            <ThemedText className="font-semibold text-slate-700 text-sm">
              Cerrar
            </ThemedText>
          </TouchableOpacity>
          {onAccept && (
            <TouchableOpacity
              onPress={() => {
                onAccept();
                onClose();
              }}
              className="flex-1 py-3.5 rounded-xl bg-brand-blue items-center justify-center active:bg-brand-blue"
            >
              <ThemedText className="font-bold text-white text-sm">
                Aceptar Términos
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
