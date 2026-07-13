import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Inicializamos el QueryClient dentro del estado para asegurarnos de que
  // no se comparta entre diferentes usuarios/sesiones en caso de recargas rápidas.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutos de caché por defecto
            retry: 2, // Reintentar un par de veces si falla la red
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
