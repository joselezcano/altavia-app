# Contexto heredado de las sesiones con Gemini (Antigravity)

Síntesis de las 13 conversaciones de Antigravity sobre `altavia-app` (25/07/2026 → 05/11/2026), extraídas de `~/.gemini/antigravity/conversations/`. Complementa a [WALKTHROUGH.md](../WALKTHROUGH.md) (bitácora por rol) y a [ROADMAP.md](../ROADMAP.md). Aquí está el **por qué** de las decisiones, el estado real y los pendientes.

> Nota: las primeras ~44 consultas de la conversación más larga ("Altavia App Development Planning", oct 2026) ya no estaban en el almacenamiento de Antigravity. Lo que se recuperó empieza en la Etapa 1 del flujo de tarifas y aprobación.

---

## 1. Visión de negocio y etapa actual

- **ALTAVIA S.A.** opera con su CESA. **AltaGo** es la marca y la app. El dueño es **Julio Lezcano**.
- **Etapa 1 (actual):** la app funciona como **herramienta administrativa de una sola aeronave**, el **ZP-BOC (Cessna 414)**. La primera usuaria real es la **administradora**, registrada como **PILOT con `isEncargado: true`** (campo en `pilots/{uid}`, que `useAuth` carga en `profileData`). Los clientes contratan por teléfono o WhatsApp y ella los carga.
- Antes de la app, la administradora llevaba números y vuelos en un **artefacto de Claude** ("Taxi Aéreo ZP-BOC"). El objetivo es que Julio deje ese artefacto y se mude a la app. Ver §4.5.

### Flujo objetivo de la Etapa 1 (acordado)
1. La encargada da de alta al cliente (alta rápida, **sin crear usuario en Firebase Auth**: solo `users` + `clients` con `roles: ["CLIENT"]`). Así no se cierra su sesión. Si el cliente se registra más adelante con el mismo email o teléfono, ve su historial.
2. Crea una reserva telefónica (*concierge booking*): ruta, fechas, pax, aeronave preseleccionada, precio sugerido **editable**.
3. Asigna piloto (se autoasigna) y puede ajustar el precio → `awaiting_payment`.
4. Envía el link de pago Bancard por WhatsApp → el cliente paga → `confirmed`.
5. Ve y envía la factura (PDF) por WhatsApp.
6. Post-pago: manifiesto de pasajeros → plan de vuelo FPL (DINAC) → despacho → `in_flight` (tracking) → `completed` → bitácora con horas Hobbs/motor → liquidación al propietario.

---

## 2. Cronología de las sesiones

| Fecha | Conversación | Qué se hizo |
|---|---|---|
| 25/07 | Templates/Navegación (`3fa764e5`) | Formulario de plantillas de aeronave (admin), `returnKeyType="done"`, Drawer admin con iconos, logo y `UserAvatar` reutilizable (bottom sheet con chips de cambio de rol). Se crearon ROADMAP.md y WALKTHROUGH.md. Drawer de owner igual al de admin, pero con headers transparentes y StatusBar `dark`. Se creó `dev-loader.tsx` para preservar la carga de aeropuertos y plantillas del otro programador. |
| 25/07 | Tipos owner (`f1e239d6`) | Hook `useOwnerReservations` + tipo `OwnerReservationItem`. Home del cliente estilo aerolínea (tabs Inicio / Reservar(`book.tsx`) / Mis Vuelos). |
| 25/07 | Logo SVG (`605d3501`, `1ef9f282`, `bfb71e73`) | `altavia-logo.tsx` con react-native-svg (sin `xmlns` ni `<SvgText>`, medidas numéricas). "Unimplemented component" = faltaba un nuevo dev build. Se corrigió el ícono de iOS en `app.json`. |
| 25/07 | Router (`4024f490`) | Las rutas tipadas fallan si el archivo no existe: se creó el placeholder `(client)/profile.tsx`. |
| 06/08 | NavContext (`56d55f20`) | `tsconfig` con `"jsx": "react-jsx"`. **Root layout con `<Stack>` siempre montado**, con el selector de rol y el loader como overlays. |
| 06/08 | KYC Didit (`837e30e3`) | Fotos en cards de resultados, destinos destacados con `expo-image` (webp/avif), perfil del cliente completo, **KYC Didit.me** con Cloud Functions y registro de cliente en `register.tsx`. |
| 30/09 | EAS (`c920536c`) | `eas.json`: Android `buildType: "apk"` en preview y production. |
| oct | Planning (`e580727d`) | Tarifas y aprobación (`pending_approval` → `awaiting_payment`), aeropuertos de PY primero en el buscador, **Regla 5 NativeWind** en AGENTS.md, Bancard (primero simulado, después vPOS 2.0 real con iframe), factura PDF simulada, **Módulo Contable del owner** (`(owner)/finances`). |
| 21/10 | Flujo taxi (`88d416fc`) | Reserva telefónica (`new-booking`), panel de reservas y cobros, precio editable, link de pago por WhatsApp, **manifiesto de pasajeros** y FPL precargado desde la reserva. |
| 31/10 | Tablet/Web (`4c4f1f63`) | iPhone solo portrait, iPad solo landscape (`app.json`). Versión web: `firebase.web.ts`, `auth-social(.web).ts`, `apple-auth-button(.web).tsx`, `custom-date-picker.web.tsx`, Drawer `permanent` en pantallas anchas, tabs como dock flotante, `use-responsive` + `ScreenContainer`. |
| 04-05/11 | Artefacto ZP-BOC (`c709693f`) | Análisis del artefacto, **módulo de Control Operativo y Rentabilidad (solo OWNER)**, Cloud Function `cambioDelDia` (Cambios Chaco), runtime de functions a Node 22. |

---

## 3. Modelo de datos (Firestore)

| Colección / doc | Uso |
|---|---|
| `users/{uid}` | Datos comunes, `roles[]`, `kycVerified`, `kycData`, `acceptedTermsVersion` |
| `admin-users`, `pilots`, `owners`, `clients` | Datos por rol. En `pilots`: `isEncargado`, `managed_aircrafts`, `owner_ids` |
| `AircraftSpecs/{id}` | Aeronaves reales (`ownerId`, `pricePerMileOverride`, `photos`, `profile_photo`) |
| `aircraft-templates` | Plantillas de modelos (admin) |
| `model-pricing` | Tarifa por milla por tipo OACI. Si está vacía y la aeronave no tiene override, **el precio sale `null`** |
| `aircraft-reservation/{id}` | Reserva: `client_status`, `internal_status`, `price`, `estimated_price`, `currency`, `pilot_ids`, `passengers[]` (manifiesto), `paid_at`, `payment_*`, `invoice_number/timbrado/cdc/url`, `clientId` |
| `aircraft-availability` | Bloqueos de calendario (incluye reason `flight`) |
| `flight-plans` | Planes de vuelo FPL |
| `airports` | Aeropuertos con `search_tags` (n-gramas). Se cargaron desde `src/assets/data/airports_sa.json` |
| `notifications` | Notificaciones al cliente (aprobación y pago) |
| `legal_logs` | Aceptación inmutable de los TyC (IP, dispositivo, versión) |
| `owner_aircraft_operations_config/{ownerUid}_{aircraftId}` | Parámetros de costos (tc, consumo, AVGAS, pilotaje, plan DINAC, reserva overhaul, tarifa/h, `fijos[]`) |
| `owner_operational_flights` | Vuelos con costos reales (combustible contado/crédito, foto del plan, `linkedReservationId?`) |
| `owner_operational_expenses` | Gastos sueltos: `mantenimiento` (descuenta del fondo de overhaul) u `otro` (descuenta del mes) |
| `Contadores/cambioDelDia` | `dolar`/`venta`/`compra` de Cambios Chaco, actualizado cada 8 h |
| Storage `operational_flight_plans/{ownerUid}/…` | Fotos del plan de vuelo sellado |

### Estados de reserva (`src/types/all-roles.ts`)
- `client_status`: `unpaid` · `reserved` · `confirmed` · `canceled` · `refunded`
- `internal_status`: `pending` (legacy) · `pending_approval` · `awaiting_payment` · `confirmed` · `canceled` · `delayed` · `in_flight` · `completed` · `no_show`
- El negocio cobra el **100% al reservar**. El 50/50 que aparecía en documentos viejos quedó descartado.

---

## 4. Módulos clave y decisiones

### 4.1 KYC con Didit.me
- La app llama a `startKycSession` (onCall). Esa función hace `POST https://verification.didit.me/v3/session/` con el header **`x-api-key`** (no usa OAuth `/auth/token/`), `workflow_id` (UUID de la consola) y `vendor_data = uid`. La app abre la URL con `expo-web-browser`.
- `diditWebhook` (onRequest) recibe `status.updated` y `data.updated` y actualiza `users/{uid}.kycVerified/kycData`. El perfil reacciona solo, vía `useUserProfile`.
- Secretos en `functions/.env` (gitignored): `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_WORKFLOW_ID`.
- El botón "Verificar" tiene protección contra doble toque (`isVerifying` + cooldown de 3 s).

### 4.2 Pagos con Bancard vPOS 2.0 (Single Buy v1.24, comercio ALTAGO)
- Manual: `eCommerce_bancard_compra_simple_version_1.24.pdf` (en la raíz). Staging: `https://vpos.infonet.com.py:8888`. Producción: `https://vpos.infonet.com.py`.
- Token: `md5(private_key + shop_process_id + amount + currency)`, con el monto a 2 decimales (`src/utils/md5.ts`).
- `single_buy` devuelve un `process_id`. La WebView carga **el iframe oficial** (`bancard-checkout-4.0.0.js`, `Bancard.Checkout.createForm`) con `baseUrl` del vPOS. Por PCI-DSS, **nunca un formulario propio**. El retorno se detecta por `return_url`/`cancel_url`.
- **Desde el 05/11/2026 todo pasa por Cloud Functions** (`functions/src/bancard.ts`):
  - `bancardSingleBuy` (onCall `{reservationId}`): verifica permisos (cliente de la reserva, ADMIN, OWNER de la aeronave o PILOT encargado), exige `awaiting_payment`, calcula Gs = `price` × `Contadores/cambioDelDia`, guarda `bancard-transactions/{shop_process_id}` y deja en la reserva `bancard_shop_process_id`/`bancard_process_id`.
  - `bancardConfirm` (onRequest): **es la URL de confirmación que hay que cargar en el portal de Bancard**. Valida `md5(private_key + shop_process_id + "confirm" + amount + currency)` y que el monto coincida, y si `response_code == "00"` marca la reserva como `confirmed`/pagada.
  - `bancardGetConfirmation` (onCall): consulta `single_buy/confirmations`. La app la llama al volver del checkout y solo continúa si el resultado es `approved`. "Simular aprobación" quedó disponible solo en `__DEV__`.
- **No enviar el bloque `billing`**: activa la validación de TAXIT y falla ("TAXIT: falló la validación del emisor"). La factura se genera por separado.
- Tarjetas de staging con autocompletado inyectado en el iframe (solo para pruebas).
- Para certificar en el portal de comercios faltan: URL de confirmación (`single_buy_confirm` que responda 200 `{"status":"success"}`), probar rollback y `get_single_buy_confirmation`, y subir el logo (173×55 px). No enviar `test_client`.

### 4.3 Factura electrónica
- `src/utils/electronic-invoice.ts` genera un PDF con formato KUDE/e-Kuatia usando `expo-print` y `expo-sharing`. **Los datos fiscales son de ejemplo** (RUC, timbrado, CDC). La integración real con SIFEN está pendiente: hace falta el certificado digital.

### 4.4 Módulo Contable (`(owner)/finances`)
- Pestaña de facturación de la app: reservas reales + **switch de datos demo** (generador de historial mayo-oct 2026), KPIs, rendimiento por aeronave, canales de cobro y exportación del reporte a PDF.

### 4.5 Control Operativo y Rentabilidad (réplica del artefacto ZP-BOC), **solo OWNER**
- Lógica en `src/utils/aircraft-operations-calc.ts`, hooks en `useAircraftOperations.ts` y UI en `src/components/owner-operations/`. El acceso está protegido con `role === OWNER`. **El piloto encargado no lo ve** (decisión explícita del usuario).
- Valores por defecto del ZP-BOC: consumo 160 L/h, AVGAS 14.200 Gs/L, pilotaje USD 100/h, plan DINAC 180.000 Gs + 15.000 Gs/pax, reserva overhaul USD 119/h, tarifa USD 900/h, gastos fijos (hangar, seguro, Starlink, Jeppesen, salario piloto…).
- Fórmulas: costo directo = combustible + piloto + tasas. Resultado = margen − reserva overhaul. Punto de equilibrio = fijos / contribución por hora. Fondo overhaul = Σ horas × reserva − Σ mantenimiento. Agenda de combustible a crédito (vencido / esta semana / próximo).

### 4.6 Tipo de cambio global
- `cambioDelDia` (onSchedule, cada 8 h, `America/Asuncion`) lee `https://www.cambioschaco.com.py/api/branch_office/1/exchange` (USD sale/purchase) y escribe `Contadores/cambioDelDia`.
- La app usa `useExchangeRate()` (staleTime de 30 min). El fallback es `DEFAULT_USD_TO_PYG_RATE = 7850` en `src/types/exchange-rate.ts`. Ya se usa en Bancard, assign-pilots, accounting y operaciones.

### 4.7 Buscador de aeropuertos
- `airport-picker.tsx` precarga los ~122 aeropuertos de Paraguay y los ordena **siempre primero**. Firestore usa `array-contains-any` sobre `search_tags`. Ojo: si un doc no tiene un n-grama (ej. "ciudad" en AGT), no aparece arriba.

### 4.8 Precio
- `useAvailableAircrafts` calcula `tarifa/milla × distancia (×2 si es ida y vuelta)`. Tarifa: primero `pricePerMileOverride` de la aeronave y, si no hay, `model-pricing[basic_specs.type]`.

---

## 5. Pendientes (según las sesiones)

- **Sincronizar `aircraft-reservation` → `owner_operational_flights`** (borrador automático con `linkedReservationId` al confirmar o completar). Gemini lo propuso y quedó sin implementar.
- Página web pública para el **link de pago** (hoy el link de WhatsApp necesita una URL real, por ejemplo en Firebase Hosting) y el endpoint de confirmación de Bancard en el backend.
- Estados operativos: botones "Iniciar vuelo" (`in_flight`) y "Aterrizaje y cierre" (`completed`), con modal de horas Hobbs/motor y combustible que actualice `total_flight_hours`.
- Integración real con SIFEN/e-Kuatia. Manifiesto en PDF con formato DINAC. Boarding pass QR + escáner en la app del piloto.
- Compartir el enlace de tracking (FlightAware). Clima METAR/TAF.
- Login social Google/Apple: el código ya existe (`auth-social`). Faltan credenciales OAuth y el onboarding de 2 pasos (persona física / jurídica).
- CRUD de usuarios, pilotos y propietarios en admin. Asignar el rol Encargado. CRUD de aeródromos (no está decidido si va por UI o por BD). Contratos dry lease. Eliminación de cuenta con soft-delete.
- Cargar `model-pricing` o el `pricePerMileOverride` del ZP-BOC para que el precio sugerido no salga vacío.

---

## 6. Deuda técnica y riesgos detectados (revisar)

1. ~~Clave privada de Bancard en el cliente.~~ **Resuelto (05/11/2026):** `single_buy`, el token MD5 y el cálculo del monto se movieron a Cloud Functions (`functions/src/bancard.ts`, claves en `functions/.env`). Hay que rotar las claves de staging antes de producción, porque quedaron en el historial de chats.
2. ~~El webhook de Didit aceptaba firmas inválidas.~~ **Resuelto (05/11/2026):** `functions/src/didit.ts` verifica `X-Signature-V2` (JSON canónico) y `X-Signature` (raw), con sus variantes `-Previous` y una tolerancia de ±300 s, y devuelve 401 si no coinciden.
2b. ~~Firestore en modo prueba (todo abierto, vence el 12/12/2026).~~ **Escrito (05/11/2026):** `firestore.rules`, con 34 tests en `tests/firestore-rules` (emulador). Hay que desplegarlo **después** de distribuir el build nuevo de la app (el build viejo escribe pagos desde el cliente y lee reservas ajenas, y las reglas nuevas lo bloquean) y **antes del 12/12/2026**.
2c. **Storage**: sus reglas no están versionadas. Probablemente también está en modo prueba: revisarlo.
2d. ~~El link de pago por WhatsApp apuntaba a una URL inventada.~~ **Resuelto:** `createPaymentLink` + página `hosting/public/pagar/` (Firebase Hosting, `altavia-app.web.app/pagar/?t=…`), con token de un solo uso de 48 h guardado como hash en `payment-links`.
3. Los datos fiscales de la factura son ficticios y conviven con datos reales. No mostrar al cliente final como "factura" hasta integrar SIFEN.
4. Datos demo del módulo contable y semilla `demo_vuelo_…` de operaciones: no confundirlos con datos reales en producción.
5. Las secret keys de Didit también aparecieron en texto plano en el chat. Conviene rotarlas.
