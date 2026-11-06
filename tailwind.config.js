/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")], // <- OBLIGATORIO EN NATIVEWIND V4
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0f1e3d",
          gold: "#C5A059",
          light: "#F8FAFC",
          white: "#FFFFFF",
          text: "#0F172A",
          muted: "#64748B",
        },
        // Paleta AltaGo (manual de identidad). Ver src/constants/brand.ts.
        altago: {
          azur: "#0165FF",
          "azur-pressed": "#0052D4",
          crystal: "#7AB4FF",
          navy: "#030436",
          tint: "#EAF3FF",
          muted: "#5B5D7A",
          border: "#D9DCE8",
          line: "#A7A9AC",
        },
      },
      fontFamily: {
        // Se activan cuando se carguen las fuentes Noto Sans (fase de rediseño).
        noto: ["NotoSans_400Regular"],
        "noto-medium": ["NotoSans_500Medium"],
        "noto-semibold": ["NotoSans_600SemiBold"],
        "noto-bold": ["NotoSans_700Bold"],
      },
    },
  }, // <- Faltaba esta llave de cierre
  plugins: [],
};
