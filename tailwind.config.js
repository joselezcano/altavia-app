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
      },
    },
  }, // <- Faltaba esta llave de cierre
  plugins: [],
};
