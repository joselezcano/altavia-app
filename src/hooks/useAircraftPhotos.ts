import { db, storage } from "@/config/firebase";
import { UploadStage } from "@/types/owner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useState } from "react";

// Carga perezosa (lazy load) de expo-image-picker para evitar cierres drásticos si el módulo nativo aún no está vinculado en el build local.
let ImagePickerModule: typeof import("expo-image-picker") | null = null;

function getImagePicker() {
  if (ImagePickerModule) return ImagePickerModule;
  try {
    ImagePickerModule = require("expo-image-picker");
    return ImagePickerModule;
  } catch (error) {
    console.warn("expo-image-picker no disponible:", error);
    return null;
  }
}

export function useUploadAircraftPhoto(aircraftId: string | undefined) {
  const queryClient = useQueryClient();
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!aircraftId) throw new Error("ID de aeronave no proporcionado.");

      setUploadStage("selecting");
      try {
        const ImagePicker = getImagePicker();
        if (!ImagePicker) {
          throw new Error(
            "El módulo de galería (expo-image-picker) no está disponible en este cliente nativo. Por favor vuelva a compilar el proyecto (npx expo run:ios / run:android) o reinicie Expo Go."
          );
        }

        // Solicitar permiso de la galería
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          throw new Error(
            "Se requieren permisos para acceder a la galería de fotos."
          );
        }

        // Abrir selector de imágenes (Etapa: Selección en la galería)
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return null;
        }

        // Transición a Etapa: Subida de la imagen a Firebase Storage & Firestore
        setUploadStage("uploading");

        const asset = result.assets[0];
        const imageUri = asset.uri;

        // Convertir URI local a Blob para Firebase Storage
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Generar nombre de archivo único en la carpeta /aircrafts
        const extension = imageUri.split(".").pop()?.split("?")[0] || "jpg";
        const fileName = `aircrafts/${aircraftId}_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}.${extension}`;

        const storageRef = ref(storage, fileName);

        // Subir archivo a Firebase Storage
        await uploadBytes(storageRef, blob);

        // Obtener la URL de descarga pública
        const downloadUrl = await getDownloadURL(storageRef);

        // Actualizar documento en Firestore
        const aircraftDocRef = doc(db, "AircraftSpecs", aircraftId);
        
        // Si la aeronave no tiene foto de perfil asignada, usar esta foto recién subida como foto de perfil por defecto
        const docSnap = await getDoc(aircraftDocRef);
        const currentProfilePhoto = docSnap.exists() ? docSnap.data().profile_photo : null;

        await updateDoc(aircraftDocRef, {
          photos: arrayUnion(downloadUrl),
          ...(!currentProfilePhoto && { profile_photo: downloadUrl }),
          updatedAt: serverTimestamp(),
        });

        return downloadUrl;
      } catch (error: any) {
        console.error("Error al subir foto de la aeronave:", error);
        throw new Error(
          error.message || "Ocurrió un error al subir la fotografía."
        );
      } finally {
        setUploadStage("idle");
      }
    },
    onSuccess: () => {
      if (aircraftId) {
        queryClient.invalidateQueries({
          queryKey: ["aircraft-details", aircraftId],
        });
        queryClient.invalidateQueries({
          queryKey: ["owner-aircrafts"],
        });
      }
    },
  });

  return {
    ...mutation,
    uploadStage,
  };
}

export function useSetAircraftProfilePhoto(aircraftId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoUrl: string) => {
      if (!aircraftId) throw new Error("ID de aeronave no proporcionado.");

      try {
        const aircraftDocRef = doc(db, "AircraftSpecs", aircraftId);
        await updateDoc(aircraftDocRef, {
          profile_photo: photoUrl,
          updatedAt: serverTimestamp(),
        });
        return photoUrl;
      } catch (error: any) {
        console.error("Error al establecer foto de perfil de la aeronave:", error);
        throw new Error(
          error.message || "No se pudo actualizar la foto principal."
        );
      }
    },
    onSuccess: () => {
      if (aircraftId) {
        queryClient.invalidateQueries({
          queryKey: ["aircraft-details", aircraftId],
        });
        queryClient.invalidateQueries({
          queryKey: ["owner-aircrafts"],
        });
      }
    },
  });
}

export function useDeleteAircraftPhoto(aircraftId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoUrl: string) => {
      if (!aircraftId) throw new Error("ID de aeronave no proporcionado.");

      try {
        // Intentar eliminar del Storage si es una URL de Firebase Storage
        try {
          const fileRef = ref(storage, photoUrl);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn("No se pudo eliminar el archivo en Storage:", storageErr);
        }

        // Remover URL de la lista en Firestore y limpiar profile_photo si coincide
        const aircraftDocRef = doc(db, "AircraftSpecs", aircraftId);
        const docSnap = await getDoc(aircraftDocRef);
        const isCurrentProfile = docSnap.exists() && docSnap.data().profile_photo === photoUrl;

        await updateDoc(aircraftDocRef, {
          photos: arrayRemove(photoUrl),
          ...(isCurrentProfile && { profile_photo: deleteField() }),
          updatedAt: serverTimestamp(),
        });

        return photoUrl;
      } catch (error: any) {
        console.error("Error al eliminar foto de la aeronave:", error);
        throw new Error(
          error.message || "Ocurrió un error al eliminar la fotografía."
        );
      }
    },
    onSuccess: () => {
      if (aircraftId) {
        queryClient.invalidateQueries({
          queryKey: ["aircraft-details", aircraftId],
        });
        queryClient.invalidateQueries({
          queryKey: ["owner-aircrafts"],
        });
      }
    },
  });
}
