import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import UserAvatar from "@/components/user-avatar";
import { useAuth } from "@/hooks/useAuth";
import AltaviaLogo from "@/utils/altavia-logo";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ClientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isFocused = pathname === "/(client)" || pathname === "/(client)/";

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";
  const firstName = user?.email?.split("@")[0] || "Pasajero";

  return (
    <ThemedView className="flex-1 bg-brand-light">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
        {/* HERO SECTION / BANNER */}
        <View
          className="bg-brand-blue rounded-b-[40px] px-6 shadow-md overflow-hidden relative"
          style={{ paddingTop: insets.top + 16, paddingBottom: 48 }}
        >
          {/* Decoración de fondo */}
          <View className="absolute -right-20 top-0 opacity-10">
            <Ionicons name="airplane" size={240} color="#FFFFFF" />
          </View>

          <View className="flex-row justify-between items-center mb-8">
            <View className="flex-1">
              <View className="mb-6">
                <AltaviaLogo width={140} color="#FFFFFF" />
              </View>
              <ThemedText className="text-white text-4xl font-extrabold mb-1">
                Hola, {firstName} 👋
              </ThemedText>
              <ThemedText className="text-brand-gold text-lg font-medium">
                Bienvenido de nuevo
              </ThemedText>
            </View>
            <View className="mt-[-40px]">
              <UserAvatar size={56} />
            </View>
          </View>

          <View className="mt-2">
            <ThemedText className="text-slate-300 text-sm max-w-[80%] leading-relaxed mb-6">
              Experimente el estándar más alto en aviación privada. Su próximo destino lo espera.
            </ThemedText>

            <TouchableOpacity
              onPress={() => router.push("/(client)/book")}
              className="bg-brand-gold py-3 px-6 rounded-full self-start flex-row items-center"
            >
              <ThemedText className="text-brand-blue font-bold mr-2">
                Reservar un vuelo
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#0f1e3d" />
            </TouchableOpacity>
          </View>
        </View>

        {/* QUICK ACTIONS / CARDS */}
        <View className="px-6 -mt-6">
          <TouchableOpacity
            onPress={() => router.push("/(client)/flights")}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-row items-center justify-between mb-4"
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4">
                <Ionicons name="ticket" size={24} color="#0f1e3d" />
              </View>
              <View>
                <ThemedText className="font-bold text-brand-blue text-base">Mis Vuelos</ThemedText>
                <ThemedText className="text-slate-500 text-xs mt-0.5">Gestione sus reservas activas</ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <View className="flex-row justify-between gap-4 mb-6">
            <TouchableOpacity
              onPress={() => router.push("/(client)/profile")}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-1 items-center"
            >
              <View className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center mb-3">
                <Ionicons name="person" size={20} color="#0f1e3d" />
              </View>
              <ThemedText className="font-semibold text-brand-blue text-sm">Mi Perfil</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-1 items-center"
              onPress={() => { /* Proponer beneficios o soporte */ }}
            >
              <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mb-3">
                <Ionicons name="star" size={20} color="#D4AF37" />
              </View>
              <ThemedText className="font-semibold text-brand-blue text-sm">Beneficios</ThemedText>
            </TouchableOpacity>
          </View>

          {/* INSPIRATION / PROMO SECTION */}
          <ThemedText className="font-bold text-brand-blue text-lg mb-3 mt-2">
            Destinos Destacados
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
            <View className="w-64 bg-white rounded-2xl p-4 mr-4 shadow-sm border border-slate-100">
              <View className="w-full h-32 bg-slate-200 rounded-xl mb-3 overflow-hidden justify-center items-center">
                <Ionicons name="image-outline" size={32} color="#94A3B8" />
                <ThemedText className="text-slate-400 text-xs mt-2">Punta del Este</ThemedText>
              </View>
              <ThemedText className="font-bold text-brand-blue">Uruguay</ThemedText>
              <ThemedText className="text-xs text-slate-500 mt-1">Conexiones directas en <ThemedText className="text-brand-gold font-bold text-xs">90 min</ThemedText></ThemedText>
            </View>
            <View className="w-64 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <View className="w-full h-32 bg-slate-200 rounded-xl mb-3 overflow-hidden justify-center items-center">
                <Ionicons name="image-outline" size={32} color="#94A3B8" />
                <ThemedText className="text-slate-400 text-xs mt-2">Asunción</ThemedText>
              </View>
              <ThemedText className="font-bold text-brand-blue">Paraguay</ThemedText>
              <ThemedText className="text-xs text-slate-500 mt-1">Base de operaciones <ThemedText className="text-brand-gold font-bold text-xs">Premium</ThemedText></ThemedText>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
