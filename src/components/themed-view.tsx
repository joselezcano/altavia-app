import { View, ViewProps } from "react-native";

interface ThemedViewProps extends ViewProps {
  className?: string;
  variant?: "default" | "card" | "transparent";
}

export function ThemedView({
  className = "",
  variant = "default",
  ...props
}: ThemedViewProps) {
  let variantClasses = "";

  switch (variant) {
    case "card":
      // Fondo blanco puro para tarjetas, con borde suave y sombra ligera
      variantClasses =
        "bg-brand-white rounded-2xl border border-slate-200 p-4 shadow-sm";
      break;
    case "transparent":
      variantClasses = "bg-transparent";
      break;
    case "default":
    default:
      // Fondo principal de la app (Blanco ligeramente grisáceo para que las tarjetas resalten)
      variantClasses = "bg-brand-light";
      break;
  }

  return <View className={`${variantClasses} ${className}`} {...props} />;
}
