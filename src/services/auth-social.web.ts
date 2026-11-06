import { auth } from "@/config/firebase";
import { SocialAuthResult } from "@/types/auth";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from "firebase/auth";

export function initSocialAuth(): void {
  // En Web no se requiere inicializar SDK nativo de Google Play Services ni iOS
}

export async function loginWithGoogle(): Promise<SocialAuthResult> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    await signInWithPopup(auth, provider);
    return { success: true };
  } catch (error: any) {
    if (
      error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request"
    ) {
      return { success: false, cancelled: true };
    }
    return { success: false, error };
  }
}

export async function loginWithApple(): Promise<SocialAuthResult> {
  try {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInWithPopup(auth, provider);
    return { success: true };
  } catch (error: any) {
    if (
      error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request"
    ) {
      return { success: false, cancelled: true };
    }
    return { success: false, error };
  }
}
