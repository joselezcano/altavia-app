/**
 * Tipografía de marca (Noto Sans, manual AltaGo pág. 11).
 * En React Native una familia personalizada no sintetiza pesos de forma confiable
 * (sobre todo en Android), así que se usa una familia por peso.
 * Las fuentes se cargan en src/app/_layout.tsx; hasta entonces (o si fallan)
 * se devuelve undefined y se usa la fuente del sistema.
 */
export const BRAND_FONT_FILES = {
    NotoSans_300Light: require("@expo-google-fonts/noto-sans/300Light/NotoSans_300Light.ttf"),
    NotoSans_400Regular: require("@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf"),
    NotoSans_500Medium: require("@expo-google-fonts/noto-sans/500Medium/NotoSans_500Medium.ttf"),
    NotoSans_600SemiBold: require("@expo-google-fonts/noto-sans/600SemiBold/NotoSans_600SemiBold.ttf"),
    NotoSans_700Bold: require("@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf"),
    NotoSans_800ExtraBold: require("@expo-google-fonts/noto-sans/800ExtraBold/NotoSans_800ExtraBold.ttf"),
};

let fontsReady = false;

export function setBrandFontsReady(ready: boolean) {
    fontsReady = ready;
}

/** Familia Noto Sans para un peso (300–800). */
export function brandFontFamily(weight: number): string | undefined {
    if (!fontsReady) return undefined;
    if (weight >= 800) return "NotoSans_800ExtraBold";
    if (weight >= 700) return "NotoSans_700Bold";
    if (weight >= 600) return "NotoSans_600SemiBold";
    if (weight >= 500) return "NotoSans_500Medium";
    if (weight <= 300) return "NotoSans_300Light";
    return "NotoSans_400Regular";
}

/**
 * Estilo de fuente para <Text> nativo con StyleSheet (pantallas sin NativeWind o dentro de <Modal>):
 * Noto Sans del peso pedido o, si todavía no cargó, fontWeight del sistema.
 */
export function brandFont(
    weight: number
): { fontFamily: string } | { fontWeight: "300" | "400" | "500" | "600" | "700" | "800" } {
    const family = brandFontFamily(weight);
    if (family) return { fontFamily: family };
    if (weight >= 800) return { fontWeight: "800" };
    if (weight >= 700) return { fontWeight: "700" };
    if (weight >= 600) return { fontWeight: "600" };
    if (weight >= 500) return { fontWeight: "500" };
    if (weight <= 300) return { fontWeight: "300" };
    return { fontWeight: "400" };
}

/** Peso a partir de las clases de Tailwind (font-bold, font-semibold…). */
export function weightFromClassName(className: string): number {
    if (/\bfont-(black|extrabold)\b/.test(className)) return 800;
    if (/\bfont-bold\b/.test(className)) return 700;
    if (/\bfont-semibold\b/.test(className)) return 600;
    if (/\bfont-medium\b/.test(className)) return 500;
    if (/\bfont-(light|extralight|thin)\b/.test(className)) return 300;
    return 400;
}
