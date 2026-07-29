import React, { useState } from "react";
import { View, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "./themed-text";
import SignOutButton from "./sign-out-button";

interface UserAvatarProps {
  size?: number;
  showDetails?: boolean;
}

export default function UserAvatar({ size = 44, showDetails = false }: UserAvatarProps) {
  const { user, userData, role, roles, selectRole } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  const displayName =
    userData?.firstName && userData?.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : user?.email?.split("@")[0] || "Usuario";

  const userInitial = displayName.charAt(0).toUpperCase();

  const getRoleLabel = () => {
    switch (role) {
      case "ADMIN":
        return "Administrador";
      case "PILOT":
        return "Piloto";
      case "OWNER":
        return "Propietario";
      case "CLIENT":
        return "Cliente";
      default:
        return "Usuario";
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className="flex-row items-center gap-3 active:opacity-80"
      >
        <View
          style={{ width: size, height: size }}
          className="rounded-full bg-brand-blue items-center justify-center shadow-sm"
        >
          <ThemedText className="text-white font-semibold text-base">
            {userInitial}
          </ThemedText>
        </View>
        {showDetails && (
          <View className="flex-1">
            <ThemedText className="font-bold text-slate-800 text-sm" numberOfLines={1}>
              {displayName}
            </ThemedText>
            <ThemedText className="text-xs text-slate-500" numberOfLines={1}>
              {user?.email}
            </ThemedText>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(15, 30, 61, 0.4)" }}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View className="flex-1 justify-end">
            <View
              className="bg-white rounded-t-3xl p-6 shadow-xl border-t border-slate-100"
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6" />

              {/* Info de Perfil */}
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-full bg-brand-blue items-center justify-center mb-3">
                  <ThemedText className="text-white font-bold text-2xl">
                    {userInitial}
                  </ThemedText>
                </View>
                <ThemedText className="font-bold text-lg text-brand-blue">
                  {displayName}
                </ThemedText>
                <ThemedText className="text-sm text-slate-500">
                  {user?.email}
                </ThemedText>
                <View className="mt-2 bg-brand-gold/15 px-3 py-1 rounded-full">
                  <ThemedText className="text-brand-gold text-xs font-semibold uppercase tracking-wider">
                    {getRoleLabel()}
                  </ThemedText>
                </View>
              </View>

              {/* Selector de Rol (si posee múltiples roles) */}
              {roles && roles.length > 1 && (
                <View className="w-full border-t border-slate-100 pt-4 mb-6">
                  <ThemedText className="text-xs font-bold text-slate-400 mb-3 text-center uppercase tracking-wider">
                    Cambiar Perfil
                  </ThemedText>
                  <View className="flex-row flex-wrap justify-center gap-2">
                    {roles.map((r) => {
                      const isActive = r === role;
                      return (
                        <TouchableOpacity
                          key={r}
                          onPress={async () => {
                            if (!isActive) {
                              setModalVisible(false);
                              await selectRole(r);
                            }
                          }}
                          className={`px-4 py-2 rounded-full border ${
                            isActive
                              ? "bg-brand-gold border-brand-gold"
                              : "bg-slate-50 border-slate-200 active:bg-slate-100"
                          }`}
                        >
                          <ThemedText
                            className={`text-xs font-bold uppercase tracking-wider ${
                              isActive ? "text-white" : "text-slate-600"
                            }`}
                          >
                            {r === "ADMIN"
                              ? "Admin"
                              : r === "PILOT"
                              ? "Piloto"
                              : r === "OWNER"
                              ? "Propietario"
                              : "Cliente"}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Botón de Cierre de Sesión */}
              <View className="mb-4">
                <SignOutButton />
              </View>

              {/* Botón para Cerrar Modal */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-full bg-slate-100 py-3 rounded-xl items-center"
              >
                <ThemedText className="text-slate-700 font-semibold">
                  Cancelar
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
