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
