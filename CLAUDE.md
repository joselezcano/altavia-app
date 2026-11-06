# ALTAVIA / AltaGo — Guía para Claude

App móvil (iOS/Android, con versión tablet y web) de taxi aéreo privado en Paraguay. Marketplace que conecta clientes con propietarios y pilotos de aeronaves, operando bajo el CESA de ALTAVIA S.A. Cliente final: **Julio Lezcano** (dueño de Altavia y de la marca AltaGo). Idioma del proyecto y de la UI: **español (Paraguay)**.

## Reglas obligatorias del proyecto

@.agents/AGENTS.md

Resumen rápido (el detalle está en el archivo importado arriba):
1. Todos los tipos/interfaces y schemas Zod van en `src/types/`.
2. Usuarios multirrol: `users` (datos comunes + `roles: string[]`) + colección por rol (`admin-users`, `pilots`, `owners`, `clients`). Varios roles → selector de rol.
3. Lecturas de Firestore en hooks con `useQuery` (TanStack Query). Nada de `useEffect` para cargar datos. `onSnapshot` solo si es necesario en tiempo real.
4. Toda llamada a Firebase que no sea `onSnapshot` va en `try-catch` (sirve para capturar los errores de índice compuesto).
5. **NativeWind v4 → error falso `Couldn't find a navigation context`.** Nunca: template strings dinámicos en `className`, opacidad tipo `bg-x/90`, `shadow-*`, `gap-*` en `<View>`, ni `ThemedText`/`ThemedView` dentro de `<Modal>`. Usar `style`/`StyleSheet.create`, `style={{ gap }}` y sombras nativas.

## Stack

- Expo SDK 57, React Native 0.86, React 19, Expo Router 57 (rutas tipadas, `Stack.Protected` por rol), NativeWind v4, TanStack Query v5, React Hook Form + Zod v4.
- Firebase: Auth, Firestore, Storage y Cloud Functions v2 (en `functions/`, runtime **Node 22**: Node 20 fue dado de baja el 2026-10-30).
- Integraciones: Didit.me (KYC), Bancard vPOS 2.0 (pagos), SIFEN/e-Kuatia (factura; por ahora simulada), Cambios Chaco (tipo de cambio), FlightAware (tracking; parcial).
- Build: EAS (`development` = dev client; `preview`/`production` Android generan **APK**).

## Mapa del código

- `src/app/` rutas: `login`, `register`, `(admin)` Drawer, `(owner)` Drawer, `(pilot)` Bottom Tabs, `(client)` Bottom Tabs. El `_layout.tsx` raíz deja el `<Stack>` **siempre montado** y muestra el selector de rol y el loader como overlays. No volver a desmontarlo: eso causa el error de navigation context.
- `src/screens/` pantallas compartidas entre roles (flight-details, create-flight-plan, aircraft-details, aircraft-add…).
- `src/components/`, `src/hooks/` (un hook por consulta), `src/services/` (bancard, auth-social), `src/utils/`, `src/types/`, `src/config/firebase.ts` (+ `firebase.web.ts`).
- Archivos por plataforma: usar sufijo `.web.tsx` / `.web.ts` (ej. `custom-date-picker.web.tsx`, `apple-auth-button.web.tsx`, `auth-social.web.ts`). No mezclar código nativo y web en un mismo archivo.
- `functions/src/index.ts`: `startKycSession` (onCall), `diditWebhook` (onRequest, firma en `didit.ts`), `cambioDelDia` (onSchedule cada 8 h), y re-exporta Bancard desde `bancard.ts`: `bancardSingleBuy`, `bancardConfirm`, `bancardGetConfirmation`.
- `functions/src/profile-claim.ts`: `claimPreRegisteredProfile` (onCall, une el perfil precargado por la encargada con la cuenta Google/Apple del mismo email). `functions/src/gio-sync.ts`: `syncReservationToGio` (trigger, crea la fila de GIO al pagarse la reserva).
- Permisos por aeronave en las reglas: `canManageAircraft(aid)` = admin, dueño (`AircraftSpecs.ownerId`) o encargada con la aeronave en `managed_aircrafts`. GIO (`owner_*`) lo usan el owner y su encargada.
- Tokens de marca en `src/constants/brand.ts` y `altago-*` en tailwind; logos en `assets/images/brand/`.
- `functions/src/payment-links.ts`: `createPaymentLink` (onCall) y `paymentLinkApi` (onRequest, expuesto vía rewrite de Hosting en `/api/payment-link`) para la página pública `hosting/public/pagar/index.html`.
- Usar imports modulares del Admin SDK (`import { FieldValue, getFirestore } from "firebase-admin/firestore"`). `admin.firestore.FieldValue` llega `undefined` en el emulador.
- **Reglas de Firestore** en [firestore.rules](firestore.rules): roles leídos de `users/{uid}.roles`; los campos de pago de `aircraft-reservation` y `kycVerified/kycData` solo los escribe el servidor; el cliente solo ve sus propias reservas. Si una pantalla nueva escribe o consulta Firestore, agregar el caso en `tests/firestore-rules/rules.test.mjs` y correr `cd tests/firestore-rules && npm test`.
- **Secretos solo en `functions/.env`** (Didit, Bancard). Nunca claves privadas en `src/`. El monto a cobrar lo calcula el servidor desde la reserva; la app nunca envía montos.

## Documentación viva (mantener actualizada)

- [ROADMAP.md](ROADMAP.md): fases y checklist. El usuario a veces lo edita a mano; sincronizar con el código cuando lo pida.
- [WALKTHROUGH.md](WALKTHROUGH.md): bitácora acumulativa por rol + sección común. **Agregar lo que se implemente.**
- [contexto.md](contexto.md): PRD v2.0.
- [docs/contexto-gemini.md](docs/contexto-gemini.md): historial y decisiones de las sesiones anteriores con Gemini (Antigravity), estado actual, pendientes y deuda técnica.

## Forma de trabajo

- Hay **otro programador** que también hace commits. Antes de borrar lógica que no es nuestra, preservarla (ej. `(owner)/dev-loader.tsx`, oculto en el Drawer con `drawerItemStyle: { display: "none" }`). Tras un `git pull`, revisar sus cambios y reflejarlos en WALKTHROUGH/ROADMAP.
- Si un módulo nativo "no existe" en runtime (`RNCWebViewModule`, `ExpoPrint`, SVG "Unimplemented component"), la solución es **un nuevo EAS development build**. No agregar `try-require` ni fallbacks.
- Para ocultar pantallas del menú se usa `drawerItemStyle: { display: "none" }` o `href: null`. No borrarlas ni comentarlas.
- Verificar con `npx tsc --noEmit` (en Windows/PowerShell puede hacer falta `node node_modules/typescript/bin/tsc --noEmit` por la política de ejecución de scripts). Para functions: `cd functions && npm run build`.
- Deploy de functions: `firebase deploy --only functions` (o `functions:<nombre>`). El lint de functions es `tsc --noEmit`, no tslint.
- Insets: las pantallas con header propio usan `useSafeAreaInsets()` → `paddingTop: insets.top`.
- **Precio por hora** (no por milla): `computeFlightQuote` en `src/utils/flight-pricing.ts`. Tarifa por aeronave en los Ajustes de GIO → `AircraftSpecs.pricing` (la escribe `syncAircraftPricing`, en `functions/src/pricing-sync.ts`).
- Precios en USD con equivalente en Gs. El tipo de cambio se lee siempre de `Contadores/cambioDelDia` mediante `useExchangeRate()`. No hardcodear la tasa.
