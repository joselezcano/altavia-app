import { Text, TextProps } from "react-native";

interface ThemedTextProps extends TextProps {
  className?: string;
  type?: "default" | "title" | "subtitle" | "caption" | "accent";
}

export function ThemedText({
  className = "",
  type = "default",
  ...props
}: ThemedTextProps) {
  let typeClasses = "";

  switch (type) {
    case "title":
      // Títulos principales: Grandes, atrevidos y usando el azul marino corporativo
      typeClasses = "text-3xl font-bold text-brand-blue tracking-tight";
      break;
    case "subtitle":
      // Subtítulos para secciones: Azul marino más suave o pizarra oscuro
      typeClasses = "text-xl font-semibold text-brand-text";
      break;
    case "accent":
      // Textos destacados o botones de texto plano: Dorado de la marca
      typeClasses = "text-base font-medium text-brand-gold";
      break;
    case "caption":
      // Textos secundarios o notas legales: Gris neutro
      typeClasses = "text-sm text-brand-muted";
      break;
    case "default":
    default:
      // Texto de cuerpo normal: Pizarra oscuro para máxima legibilidad
      typeClasses = "text-base text-brand-text";
      break;
  }

  return <Text className={`${typeClasses} ${className}`} {...props} />;
}
