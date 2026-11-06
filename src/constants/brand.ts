/**
 * Tokens de marca AltaGo (manual "Identidad AltaGo", págs. 3–12 y 15).
 * Fuente única para colores y logos en código (StyleSheet, navegación, gráficos).
 * En className usar las clases equivalentes de tailwind.config.js (altago-*).
 *
 * Todavía no reemplazan a brand.blue / brand.gold: el rediseño de pantallas
 * se hace en la fase 3 para no mezclarlo con cambios de lógica.
 */
export const BRAND_COLORS = {
  // Paleta del manual
  azur: "#0165FF", // primario de acción (CTA, "Go" del logo)
  crystal: "#7AB4FF", // secundario, fondos claros de marca
  navy: "#030436", // fondo oscuro principal, textos, logo en positivo
  white: "#FFFFFF",
  black: "#000000",
  lineGray: "#A7A9AC", // solo líneas decorativas / retículas

  // Derivados para UI (inferidos del manual)
  azurPressed: "#0052D4",
  surfaceTint: "#EAF3FF", // crystal muy claro
  text: "#030436",
  textMuted: "#5B5D7A",
  border: "#D9DCE8",
  background: "#FFFFFF",
  backgroundAlt: "#F5F8FD",
} as const;

/** Radios: botón ≈ 34 % del alto (manual pág. 12). */
export const BRAND_RADII = {
  button: 18, // botón de 52 px de alto
  card: 20,
  input: 14,
  pill: 999,
} as const;

export const BRAND_FONT_FAMILY = "Noto Sans";

/** Logos recortados y optimizados en assets/images/brand (ver IDENTIDAD-ALTAGO para los originales). */
export const BRAND_LOGOS = {
  /** Horizontal a color (navy + Go azur): headers y fondos claros. */
  horizontalColor: require("../../assets/images/brand/logo-horizontal-color.png"),
  /** Horizontal todo blanco: sobre foto (login) o navy. */
  horizontalWhite: require("../../assets/images/brand/logo-horizontal-white.png"),
  /** Horizontal negativo (blanco + Go azur): drawer y headers navy. */
  horizontalNegative: require("../../assets/images/brand/logo-horizontal-negative.png"),
  /** Vertical a color: empty states, cabeceras centradas. */
  verticalColor: require("../../assets/images/brand/logo-vertical-color.png"),
  /** Vertical blanco: splash sobre navy. */
  verticalWhite: require("../../assets/images/brand/logo-vertical-white.png"),
  /** Isotipo a color: avatar, loader, ícono en claro. */
  isotipoColor: require("../../assets/images/brand/isotipo-color.png"),
  /** Isotipo negativo (blanco + avión azur): sobre navy. */
  isotipoNegative: require("../../assets/images/brand/isotipo-negative.png"),
  /** Isotipo blanco. */
  isotipoWhite: require("../../assets/images/brand/isotipo-white.png"),
} as const;

/** Relación de aspecto (ancho / alto) de cada logo, para dimensionar sin deformar. */
export const BRAND_LOGO_ASPECT = {
  horizontal: 1200 / 351,
  vertical: 770 / 669,
  isotipo: 544 / 655,
} as const;
