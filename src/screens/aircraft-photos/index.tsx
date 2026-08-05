import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAircraftDetails } from "@/hooks/useAircraftDetails";
import {
  useDeleteAircraftPhoto,
  useSetAircraftProfilePhoto,
  useUploadAircraftPhoto,
} from "@/hooks/useAircraftPhotos";
import { AircraftDetailsHeader } from "@/screens/aircraft-details/components/header";
import { AircraftDetailsTitleCard } from "@/screens/aircraft-details/components/title-card";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 48) / 2; // 2 columns grid with padding

export default function AircraftPhotosScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: aircraft, isLoading, error } = useAircraftDetails(id);
  const uploadPhotoMutation = useUploadAircraftPhoto(id);
  const setProfilePhotoMutation = useSetAircraftProfilePhoto(id);
  const deletePhotoMutation = useDeleteAircraftPhoto(id);

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleUploadPhoto = async () => {
    try {
      const url = await uploadPhotoMutation.mutateAsync();
      if (url) {
        Toast.show({
          type: "success",
          text1: "Fotografía subida",
          text2: "La imagen se ha guardado correctamente.",
        });
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message || "No se pudo subir la fotografía seleccionada."
      );
    }
  };

  const handleSetProfilePhoto = async (photoUrl: string) => {
    try {
      await setProfilePhotoMutation.mutateAsync(photoUrl);
      Toast.show({
        type: "success",
        text1: "Foto de perfil actualizada",
        text2: "Se ha asignado la imagen como foto principal de la aeronave.",
      });
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message || "No se pudo establecer la foto de perfil."
      );
    }
  };

  const handleDeletePhoto = (photoUrl: string) => {
    Alert.alert(
      "Eliminar foto",
      "¿Estás seguro de que deseas eliminar esta fotografía de la aeronave?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePhotoMutation.mutateAsync(photoUrl);
              if (selectedPhoto === photoUrl) {
                setSelectedPhoto(null);
              }
              Toast.show({
                type: "success",
                text1: "Fotografía eliminada",
                text2: "La imagen ha sido eliminada con éxito.",
              });
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.message || "No se pudo eliminar la fotografía."
              );
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0f1e3d" />
        <ThemedText className="text-slate-500 mt-2">
          Cargando fotografías...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !aircraft) {
    return (
      <ThemedView className="flex-1 px-4 justify-center items-center">
        <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={36} color="#EF4444" />
        </View>
        <ThemedText type="subtitle" className="text-center text-slate-800 mb-2">
          Aeronave no encontrada
        </ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-brand-blue px-6 py-2.5 rounded-xl flex-row items-center gap-2"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <ThemedText className="text-white font-semibold">Regresar</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const { basic_specs, photos = [], profile_photo } = aircraft;
  const { uploadStage, isPending: isUploading } = uploadPhotoMutation;

  return (
    <ThemedView className="flex-1 px-4 pt-2">
      {/* Header */}
      <AircraftDetailsHeader header="Fotografías" />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Title Section Card */}
        <AircraftDetailsTitleCard
          title="Galería de Fotos"
          model={basic_specs.model}
          registration={basic_specs.registration}
        />

        {/* Upload Action Card */}
        <TouchableOpacity
          onPress={handleUploadPhoto}
          disabled={isUploading}
          className="bg-brand-blue/5 border border-dashed border-brand-blue/30 rounded-2xl p-5 mb-6 items-center justify-center flex-row gap-3"
          activeOpacity={0.7}
        >
          {isUploading ? (
            <>
              <ActivityIndicator size="small" color="#0f1e3d" />
              <ThemedText className="font-semibold text-brand-blue">
                {uploadStage === "selecting"
                  ? "Abriendo galería..."
                  : "Subiendo fotografía..."}
              </ThemedText>
            </>
          ) : (
            <>
              <View className="w-10 h-10 rounded-full bg-brand-blue/10 items-center justify-center">
                <Ionicons name="cloud-upload" size={22} color="#0f1e3d" />
              </View>
              <View>
                <ThemedText className="font-bold text-brand-blue text-base">
                  Subir Foto
                </ThemedText>
                <ThemedText type="caption" className="text-slate-500 text-xs">
                  Formatos JPG, PNG
                </ThemedText>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Photos Grid or Empty State */}
        {photos.length === 0 ? (
          <ThemedView
            variant="card"
            className="p-8 items-center justify-center my-6 border border-slate-100 rounded-3xl"
          >
            <View className="w-20 h-20 bg-slate-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="images-outline" size={40} color="#94A3B8" />
            </View>
            <ThemedText type="subtitle" className="text-slate-700 text-center mb-1 font-bold">
              Sin fotografías aún
            </ThemedText>
            <ThemedText className="text-slate-500 text-xs text-center mb-6 max-w-[240px]">
              Agrega imágenes de la aeronave.
            </ThemedText>
            <TouchableOpacity
              onPress={handleUploadPhoto}
              disabled={isUploading}
              className="bg-brand-blue px-6 py-3 rounded-xl flex-row items-center gap-2"
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <ThemedText className="text-white font-bold text-sm">
                Seleccionar Foto
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-3 px-1">
              <ThemedText className="font-bold text-slate-800 text-base">
                Fotos Subidas ({photos.length})
              </ThemedText>
              <ThemedText type="caption" className="text-slate-500 text-xs">
                Toca para ampliar
              </ThemedText>
            </View>

            <View className="flex-row flex-wrap gap-3">
              {photos.map((photoUrl, index) => {
                const isProfile = profile_photo === photoUrl;

                return (
                  <View
                    key={`${photoUrl}-${index}`}
                    style={{ width: TILE_SIZE, height: TILE_SIZE }}
                    className={`rounded-2xl overflow-hidden bg-slate-100 border relative ${isProfile ? "border-amber-500 border-2" : "border-slate-200/80"
                      }`}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setSelectedPhoto(photoUrl)}
                      className="w-full h-full"
                    >
                      <Image
                        source={{ uri: photoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>

                    {/* Star / Profile Picture Action Badge */}
                    <TouchableOpacity
                      onPress={() => handleSetProfilePhoto(photoUrl)}
                      disabled={setProfilePhotoMutation.isPending}
                      className={`absolute top-2 left-2 flex-row items-center gap-1 px-2.5 py-1 rounded-full ${isProfile
                        ? "bg-amber-500"
                        : "bg-black/60"
                        }`}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isProfile ? "star" : "star-outline"}
                        size={14}
                        color="#FFFFFF"
                      />
                      {isProfile && (
                        <ThemedText className="text-white text-xs font-bold">
                          Principal
                        </ThemedText>
                      )}
                    </TouchableOpacity>

                    {/* Delete Badge Button */}
                    <TouchableOpacity
                      onPress={() => handleDeletePhoto(photoUrl)}
                      disabled={deletePhotoMutation.isPending}
                      className="absolute top-2 right-2 bg-black/60 p-2 rounded-full"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Photo Lightbox Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <Pressable
          className="flex-1 bg-black/95 justify-center items-center relative"
          onPress={() => setSelectedPhoto(null)}
        >
          {/* Close Button */}
          <TouchableOpacity
            onPress={() => setSelectedPhoto(null)}
            className="absolute top-12 right-6 z-10 bg-white/20 p-3 rounded-full"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Delete & Profile Picture Header Actions inside Lightbox */}
          {selectedPhoto && (
            <View className="absolute top-12 left-6 z-10 flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => handleDeletePhoto(selectedPhoto)}
                className="bg-red-600/80 p-3 rounded-full flex-row items-center gap-1 px-4"
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <ThemedText className="text-white text-xs font-bold">Eliminar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSetProfilePhoto(selectedPhoto)}
                className={`p-3 rounded-full flex-row items-center gap-1 px-4 ${profile_photo === selectedPhoto
                  ? "bg-amber-500"
                  : "bg-white/20"
                  }`}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={profile_photo === selectedPhoto ? "star" : "star-outline"}
                  size={18}
                  color="#FFFFFF"
                />
                <ThemedText className="text-white text-xs font-bold">
                  {profile_photo === selectedPhoto
                    ? "Foto Principal"
                    : "Usar como Principal"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              style={{ width: width * 0.95, height: width * 0.95 }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </ThemedView>
  );
}
