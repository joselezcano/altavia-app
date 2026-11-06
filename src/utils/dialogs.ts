import type { ConfirmOptions } from "@/types/components";
import { Alert } from "react-native";

/**
 * Diálogos multiplataforma. Versión nativa: Alert con botones.
 * (En web ver dialogs.web.ts: allí Alert.alert con botones no muestra nada.)
 */

/** Pide confirmación al usuario. Resuelve true si acepta. */
export function confirmAction({
  title,
  message,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/** Muestra un aviso con un botón "Entendido". Resuelve cuando el usuario lo cierra. */
export function showNotice(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: "Entendido", onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}
