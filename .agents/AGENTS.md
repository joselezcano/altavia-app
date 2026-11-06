# Reglas del Proyecto - ALTAVIA

## 1. Tipados y Estructuras
- Todos los tipos e interfaces de TypeScript deben ubicarse estrictamente en la carpeta `src/types/`.

## 2. Modelo de Datos de Usuarios Multirrol
- La colección `users` almacena únicamente los datos comunes (uid, email, firstName, lastName, etc.) y un array de roles (`roles: string[]`).
- La información específica de cada rol se guarda en colecciones dedicadas por rol:
  - `admin-users` (para el rol `ADMIN`)
  - `pilots` (para el rol `PILOT`)
  - `owners` (para el rol `OWNER`)
  - `clients` (para el rol `CLIENT`)
- Al iniciar sesión, se recupera el documento del usuario en la colección `users`:
  - Si el usuario tiene asignado un solo rol, se obtienen automáticamente sus datos detallados de la colección correspondiente y se redirige a la app de ese rol.
  - Si el usuario cuenta con múltiples roles (ej. es piloto y propietario), la interfaz debe presentar un selector para que el usuario elija con qué rol desea ingresar en esa sesión.

## 3. Consultas y Estado (TanStack Query)
- Debemos encapsular todas las consultas a Firestore mediante hooks personalizados utilizando `@tanstack/react-query` (`useQuery`).
- Se debe evitar el uso de `useEffect` para cargar datos iniciales.
- No se debe abusar de `onSnapshot` (suscripción en tiempo real) a menos que sea estrictamente necesario para la funcionalidad (ej. seguimiento de vuelos en tiempo real). Para datos estáticos o de lectura única, preferir peticiones normales (`getDoc` / `getDocs`) dentro de `useQuery`.

## 4. Manejo de Errores y Consultas Firebase (Índices)
- En todas las consultas de lectura o escritura de Firebase (como `getDoc`, `getDocs`, `setDoc`, `updateDoc`, `deleteDoc`) que no sean suscripciones reactivas (`onSnapshot`), se debe implementar obligatoriamente un bloque `try-catch`.
- Esto asegura la captura de errores específicos de Firebase, especialmente aquellos que indican la necesidad de crear un índice compuesto (que proveen el enlace directo para su generación automática en la consola de Firebase).

## 5. Prevención de Error de Navegación por NativeWind v4 (`Couldn't find a navigation context`)
- **Causa Raíz:** En NativeWind v4 junto con React 19 y Expo 52, el motor `react-native-css-interop` genera un error falso-positivo de navegación (`Couldn't find a navigation context. Have you wrapped your app with 'NavigationContainer'?`) debido a un fallo en la resolución de estilos reactivos durante re-renders o transiciones de pantalla bajo las siguientes condiciones:
  1. Interpolaciones de template string dinámicas en `className` (ej. `className={`... ${cond ? 'bg-white' : ''}`}`).
  2. Modificadores de opacidad en utilidades de color (ej. `bg-brand-blue/90`, `bg-white/10`, `bg-black/60`).
  3. Utilidades de sombra de Tailwind (`shadow-sm`, `shadow-md`, `shadow-2xl`).
  4. Utilidades de espaciado `gap-*` en contenedores `<View>` de NativeWind.
  5. Uso de `ThemedText` o `ThemedView` dentro de componentes `<Modal>` nativos de React Native.
- **Regla Obligatoria:**
  - **Para estilos condicionales y dinámicos:** NUNCA usar plantillas de texto en `className`. Usar `style={[styles.base, isActive ? styles.active : styles.inactive]}` o estilos inline con `StyleSheet.create`.
  - **Dentro de Modales (`<Modal>`):** Usar `<Text>` y `<View>` nativos de React Native con estilos basados en `StyleSheet` o inline, evitando `ThemedText` y clases `className` complejas dentro de modales.
  - **Para gaps y sombras:** Usar la propiedad de estilo nativa `style={{ gap: 16 }}` y propiedades de sombra nativas (`elevation`, `shadowColor`, etc.) en lugar de las clases Tailwind `gap-*` y `shadow-*`.
