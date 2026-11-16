import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";

type RoleKey = "ADMIN" | "CLIENT" | "PILOT" | "OWNER";

/** Nombre, descripción e ícono de cada rol: una sola fuente para todos los selectores. */
export const ROLE_INFO: Record<RoleKey, { title: string; description: string; icon: ComponentProps<typeof Ionicons>["name"] }> = {
  ADMIN: { title: "Administrador", description: "Panel de control de ALTAVIA", icon: "shield-checkmark-outline" },
  OWNER: { title: "Propietario", description: "Tu flota, reservas y finanzas", icon: "briefcase-outline" },
  PILOT: { title: "Piloto", description: "Tus vuelos y planes asignados", icon: "airplane-outline" },
  CLIENT: { title: "Pasajero", description: "Reservá y seguí tus vuelos", icon: "person-outline" },
};

export function roleLabel(role: string | null | undefined): string {
  return role && role in ROLE_INFO ? ROLE_INFO[role as RoleKey].title : "Usuario";
}
