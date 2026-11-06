import { ResponsiveInfo } from "@/types/responsive";
import { Platform, useWindowDimensions } from "react-native";

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isTablet =
    (Platform.OS === "ios" && Platform.isPad) ||
    (width >= 600 && width <= 1024);
  const isDesktop = width > 1024;
  const isWideScreen = width >= 768;

  // Ancho máximo ergonómico para formularios centrados en pantallas anchas
  const contentMaxWidth = isWideScreen ? 520 : width;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isDesktop,
    isWideScreen,
    contentMaxWidth,
  };
}
