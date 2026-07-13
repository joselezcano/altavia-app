const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Asegúrate de que la ruta apunte correctamente a tu archivo global.css
module.exports = withNativeWind(config, { input: "./global.css" });
