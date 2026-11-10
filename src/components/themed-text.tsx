import { brandFontFamily, weightFromClassName } from "@/utils/brand-fonts";
import { StyleSheet, Text, TextProps } from "react-native";

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

  const classes = `${typeClasses} ${className}`;
  // Noto Sans con la familia del peso correspondiente (font-bold → NotoSans_700Bold, etc.).
  // Si el estilo trae fontWeight explícito, manda ese.
  const flat = StyleSheet.flatten(props.style) || {};
  const weight = flat.fontWeight ? Number(flat.fontWeight) || weightFromClassName(classes) : weightFromClassName(classes);
  const fontFamily = flat.fontFamily ? undefined : brandFontFamily(weight);
  const { style, ...rest } = props;

  // La familia ya trae el peso: fontWeight "normal" evita que Android le sume una negrita sintética.
  return (
    <Text
      className={classes}
      style={fontFamily ? [style, { fontFamily, fontWeight: "normal" }] : style}
      {...rest}
    />
  );
}
