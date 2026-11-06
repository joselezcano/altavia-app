import { auth } from "@/config/firebase";
import { SocialAuthResult } from "@/types/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
} from "firebase/auth";
import { Platform } from "react-native";

export function initSocialAuth(): void {
  try {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

    if (Platform.OS === "ios" && !iosClientId) {
      console.warn(
        "[GoogleSignin] iosClientId no está definido en .env y GoogleService-Info.plist no fue encontrado. Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID para habilitar Google en iOS."
      );
      return;
    }

    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      ...(iosClientId ? { iosClientId } : {}),
    });
  } catch (err) {
    console.warn("[GoogleSignin] Error configurando GoogleSignin:", err);
  }
}

export async function loginWithGoogle(): Promise<SocialAuthResult> {
  if (Platform.OS === "ios" && !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim()) {
    throw new Error(
      "Para iniciar sesión con Google en iOS, debes configurar tu EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID en el archivo .env o descargar GoogleService-Info.plist desde Firebase Console."
    );
  }

  try {
    await GoogleSignin.hasPlayServices();
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignorar si no había sesión previa
    }

    const response = await GoogleSignin.signIn();
    const idToken = response?.data?.idToken || (response as any)?.idToken;
    if (!idToken) {
      throw new Error("No se pudo obtener el token de Google.");
    }

    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    return { success: true };
  } catch (error: any) {
    if (error?.code === statusCodes?.SIGN_IN_CANCELLED) {
      return { success: false, cancelled: true };
    }
    return { success: false, error };
  }
}

export async function loginWithApple(): Promise<SocialAuthResult> {
  try {
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken, fullName } = appleCredential;
    if (!identityToken) {
      throw new Error("No se recibió token de identidad de Apple.");
    }

    if (fullName) {
      const givenName = fullName.givenName || "";
      const familyName = fullName.familyName || "";
      if (givenName || familyName) {
        await AsyncStorage.setItem(
          "apple_fullName",
          JSON.stringify({ givenName, familyName })
        );
      }
    }

    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: identityToken,
    });

    const userCredential = await signInWithCredential(auth, credential);

    if (fullName && userCredential.user) {
      const givenName = fullName.givenName || "";
      const familyName = fullName.familyName || "";
      const displayName = [givenName, familyName].filter(Boolean).join(" ");
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
    }

    return { success: true };
  } catch (error: any) {
    if (error?.code === "ERR_REQUEST_CANCELED") {
      return { success: false, cancelled: true };
    }
    return { success: false, error };
  }
}
