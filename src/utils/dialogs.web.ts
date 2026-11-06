import type { ConfirmOptions } from "@/types/components";

/**
 * Diálogos multiplataforma. Versión web: en react-native-web, Alert.alert con
 * botones no muestra nada, así que se usan los diálogos del navegador.
 */

/** Pide confirmación al usuario. Resuelve true si acepta. */
export function confirmAction({ title, message }: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return Promise.resolve(false);
  }
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

/** Muestra un aviso. Resuelve cuando el usuario lo cierra. */
export function showNotice(title: string, message: string): Promise<void> {
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(`${title}\n\n${message}`);
  }
  return Promise.resolve();
}
