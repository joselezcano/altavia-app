import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export function useAppleAuthAvailable(): boolean {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setIsAvailable(false);
      return;
    }

    AppleAuthentication.isAvailableAsync()
      .then(setIsAvailable)
      .catch((err) => {
        console.warn("Error verificando disponibilidad de Apple Auth:", err);
        setIsAvailable(false);
      });
  }, []);

  return isAvailable;
}
