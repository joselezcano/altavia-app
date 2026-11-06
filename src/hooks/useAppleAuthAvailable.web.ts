export function useAppleAuthAvailable(): boolean {
  // En Web se desactiva por defecto a menos que se configure Apple Service ID para web
  return false;
}
