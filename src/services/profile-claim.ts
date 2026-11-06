import { functions } from "@/config/firebase";
import { ClaimProfileResult } from "@/types/user";
import { httpsCallable } from "firebase/functions";

/**
 * Busca en el servidor un perfil precargado por la encargada con el mismo email
 * (verificado por Google / Apple) y lo une a la cuenta actual.
 * Nunca lanza: si falla, la app sigue al onboarding normal.
 */
export async function claimPreRegisteredProfile(): Promise<ClaimProfileResult> {
  try {
    const callable = httpsCallable<void, ClaimProfileResult>(functions, "claimPreRegisteredProfile");
    const res = await callable();
    return res.data;
  } catch (error) {
    console.error("Error al recuperar perfil precargado:", error);
    return { claimed: false, mergedProfiles: 0, movedReservations: 0 };
  }
}
