# Registro Acumulativo de Desarrollo (Walkthroughs)

Este documento mantiene un registro histórico de las funcionalidades implementadas, estructurado por roles y componentes comunes, para no perder contexto entre sesiones de desarrollo.

## 1. Componentes Comunes / Base
- **Enrutamiento (Expo Router):** Se estableció la estructura de carpetas protegidas `/(admin)`, `/(client)`, `/(owner)`, `/(pilot)`.
- **Zod Schemas (`src/types`):** 
  - `templates.ts`: Definición de `AircraftTemplateSchema`.
  - `owner.ts`: Definición de `AircraftSpecsSchema` (ahora incluye campos `photos` y `profile_photo` para fotos del avión), `DinghiesCapacitySchema`, y el tipo `UploadStage`.
  - Regla aplicada: Todos los tipos deben residir estrictamente en `src/types/`.
- **Headers Personalizados (`owner-header.tsx`, `pilot-header.tsx`):** Componentes visuales reutilizables para estandarizar la barra superior en los paneles de propietario y piloto.
- **Componentes de Formulario Reutilizables:** Se modularizaron campos y botones (`custom-input.tsx`, `select-one-option.tsx`, `form-navigation-buttons.tsx`) para ser compartidos entre formularios de alta complejidad.
- **Autenticación, Registro y Selector de Roles (`login.tsx`, `register.tsx`, `src/app/_layout.tsx`, `src/components/role-selection.tsx`):** UI para inicio de sesión, registro de usuarios y redirección por roles. Si un usuario posee múltiples roles en Firestore, la app intercepta el enrutamiento en el `_layout` raíz mediante `isRoleSelectorRequired` y le muestra el componente de selección de rol (`role-selection.tsx`) antes de permitir el ingreso a las carpetas protegidas.
- **Botón de Cierre de Sesión Estilizado (`sign-out-button.tsx`):** Rediseñado para verse secundario y estilizado. Tiene un diseño de fila centrado con un borde sutil rojo e incorpora el icono `log-out-outline` de Ionicons.
- **Avatar Reutilizable y Selector Multirrol de Perfil (`user-avatar.tsx`):** Componente que unifica el círculo del perfil y el modal inferior. En caso de que el usuario tenga múltiples roles asignados, el modal muestra chips interactivos para cambiar de rol al instante a través del método `selectRole` de `useAuth`.
- **Flujo Legal (Aceptación de TyC - `src/app/(client)/terms.tsx`):** Implementación del flujo de aceptación de Términos y Condiciones obligatorios con scroll forzado. Al ser aceptados, se genera un registro inmutable en la colección `legal_logs` que incluye: IP del usuario (vía `api.ipify.org`), datos detallados del dispositivo (marca, modelo, versión de SO usando `expo-device`), marca de tiempo de Firestore, y versión del contrato. Asimismo, actualiza la propiedad `acceptedTermsVersion` en el perfil del usuario.
- **Utilidades y Base de Datos de Aeropuertos:**
  - Archivos matemáticos para cálculo de distancias (Haversine) y búsqueda de aeropuertos implementados.
  - **Dataset de Aeropuertos:** Se mapeó un archivo estático con aeropuertos de Sudamérica en **[airports_sa.json](file:///c:/proyectos/altavia-app/src/assets/data/airports_sa.json)**. En modo de desarrollo, se implementó un script de carga por lotes (chunks) a Firestore en **[index.tsx](file:///c:/proyectos/altavia-app/src/app/(owner)/index.tsx)** para nutrir la colección `airports`, la cual alimenta al selector `airport-picker.tsx` en el buscador de vuelos del cliente.

- **Seguridad de Pagos Bancard (Backend):** `single_buy`, el token MD5 y el monto se calculan en Cloud Functions (`functions/src/bancard.ts`: `bancardSingleBuy`, `bancardConfirm`, `bancardGetConfirmation`). La app ya no tiene claves (`src/services/bancard.ts` solo llama a las callables). El pago se da por aprobado únicamente cuando el servidor lo confirma con Bancard. Las transacciones quedan registradas en `bancard-transactions/{shop_process_id}`.
- **Reglas de seguridad de Firestore (`firestore.rules`):** reemplazan el modo prueba. Hay 34 tests con el emulador en `tests/firestore-rules`. El buscador y el chequeo de colisiones del cliente usan solo `aircraft-availability` (ya no leen reservas ajenas). Las pantallas de pago ya no escriben estados de pago: leen la reserva confirmada por el servidor (`src/utils/paid-reservation.ts`). La factura (por ahora de demo, `invoice_is_demo: true`) y la notificación de pago las genera el servidor.
- **Reglas de Storage (`storage.rules`):** `public/` tiene lectura libre. En `aircrafts/`, las fotos las sube el dueño de la aeronave (según `AircraftSpecs.ownerId`), la encargada o el admin. `operational_flight_plans/{ownerUid}/` es solo del propietario o del admin. Solo se aceptan imágenes de menos de 10 MB; todo lo demás se deniega.
- **Permisos por aeronave (`firestore.rules`, 46 tests):** las reservas, el calendario y las aeronaves solo los gestiona el admin, el dueño de ESA aeronave (`AircraftSpecs.ownerId`) o la encargada que la tiene en `managed_aircrafts`. El piloto asignado (`pilot_ids`) solo carga el manifiesto y mueve estados operativos de un vuelo ya pagado (`confirmed`, `delayed`, `in_flight`, `completed`, `no_show`; ver `PILOT_OPERATIONAL_STATUSES`). Las reservas solo se eliminan si no están pagadas. En `pilots`, el owner solo se vincula o desvincula a sí mismo y gestiona a sus pilotos vinculados; la encargada solo asigna pilotos a sus aeronaves; el piloto puede renunciar a vínculos, nunca darse permisos. `bancard.ts` ya no deja cobrar a una encargada sin aeronaves asignadas.
- **Unión de perfiles precargados (`functions/src/profile-claim.ts`):** `claimPreRegisteredProfile` (onCall) se llama desde `useAuth` cuando un usuario de Google o Apple entra por primera vez. Si la encargada ya lo había dado de alta con el mismo email (verificado en el token), migra `users`, los perfiles por rol, las reservas (`clientId` y `pilot_ids`), las notificaciones y los vínculos de propietario a su uid real, borra el perfil viejo y deja rastro en `merged-profiles/{idViejo}`.
- **Sincronización reserva → GIO (`functions/src/gio-sync.ts`):** `syncReservationToGio` (trigger de Firestore) crea `owner_operational_flights/res_{reservationId}` cuando la reserva queda pagada, con fecha, cliente, ruta, pasajeros, precio y horas estimadas (distancia / velocidad crucero). En el formulario de GIO esos campos quedan bloqueados; las horas reales y los gastos los completan el owner o la encargada.
- **Precio por hora de vuelo (reemplaza la tarifa por milla):** `src/utils/flight-pricing.ts` (`computeFlightQuote`). Se cobran todas las horas que vuela el avión: el reposicionamiento desde su base, los tramos con pasajeros y el regreso vacío. Las horas se estiman con haversine / velocidad crucero × factor de bloque (ajustable por aeronave en Ajustes y en Control de Flota; 1.12 por defecto, para acercarse al Hobbs real). Precio = horas × tarifa por hora (IVA incluido, sin mínimos) + noches fuera × (pernocte + hangaraje). La tarifa sale de los Ajustes de GIO (`tarifaHora`, `pernocteUsd`, `hangarNocheUsd`, `pilotoPernocteUsd`), que editan el admin (Control de Flota), el owner y la encargada. El trigger `syncAircraftPricing` la publica en `AircraftSpecs.pricing` para el buscador; las reglas impiden escribir `pricing` desde la app. La reserva guarda `billable_hours`, `price_per_hour_usd`, `overnight_nights`, `overnight_fee_usd` y `hangar_per_night_usd`. GIO suma el pernocte del piloto y el hangaraje del vuelo. `new-booking` usa el tipo de cambio del día en vez de 7850.
- **Tokens de marca:** `src/constants/brand.ts` (colores, radios, logos y relación de aspecto) y la paleta `altago-*` en `tailwind.config.js`. Los logos recortados y optimizados están en `assets/images/brand/`. Todavía no reemplazan a `brand.blue`/`brand.gold`: el rediseño de pantallas es la fase 3.
- **Link de pago por WhatsApp:** `createPaymentLink` genera `https://altavia-app.web.app/pagar/?t=<token>` (un solo uso, 48 h). La página pública en `hosting/public/pagar/` muestra el resumen del vuelo, carga el iframe oficial de Bancard y verifica el pago al volver.
- **Webhook KYC Didit con firma verificada:** `functions/src/didit.ts` valida `X-Signature-V2`/`X-Signature` con un timestamp de ±300 s y rechaza con 401. `kycVerified` solo cambia con `Approved` (true) o `Declined`/`Kyc Expired` (false).

- **Clientes sin duplicar (`useClients.ts`):** el alta rápida busca primero por documento (`documentNumber` y, para empresas, `taxId`; también sin puntos ni espacios) y después por email. Si encuentra al cliente, lo reutiliza y avisa "Ya existe un cliente con ese documento". El email es opcional.
- **Borrar aeronave (owner):** se hace desde la toolbar del detalle, con doble confirmación, y se bloquea si la aeronave tiene reservas (`useDeleteAircraft`).
- **Diálogos multiplataforma (`src/utils/dialogs.ts` / `.web.ts`):** `confirmAction` y `showNotice`. En web usan los diálogos del navegador, porque `Alert.alert` con botones no se muestra.

- **Editar y eliminar reservas (`src/screens/edit-reservation`, `useReservationEditing.ts`):** el owner y la encargada editan desde el detalle o la lista.
  - **Sin pagar:** se cambian ruta, fechas, ida/vuelta y pasajeros. Recotiza por hora y el precio se puede mantener, tomar el sugerido o escribir a mano.
  - **Pagada:** solo se reprograma, y el precio queda fijo. Se actualizan las noches fuera (`overnight_nights`), que GIO usa para el pernocte y el hangaraje.
  - **Precio editado con el link ya enviado:** se avisa que el link cobra el precio nuevo y que conviene reenviarlo.
  - **Calendario:** se recrean los bloqueos de `aircraft-availability` y se valida que no choquen con otras reservas.
  - **Eliminar:** solo reservas sin ningún cobro. Primero se borran los bloqueos y después la reserva.
- **Navegación por rol (`src/utils/role-routes.ts`):** las pantallas compartidas (reservas, nueva reserva) navegan al grupo del rol activo. Antes llevaban a rutas protegidas de otro rol.
- **Foto del plan de vuelo por tramo:** se adjunta en `create-flight-plan`, se guarda en `flight_plan_photos/{reservationId}/` (Storage) y en `flight-plans.photoUrl`, y se ve en `view-flight-plan`.
- **ID de FlightAware (`flight-aware-card.tsx`):** el owner, la encargada o el piloto asignado cargan `fa_flight_id` en vuelos confirmados. La regla del piloto asignado ahora incluye ese campo.

- **Rediseño con la marca AltaGo (fase 3, en curso):**
  - **Colores:** `brand.blue` pasó a Dark Navy #030436 y `brand.gold` a Azur #0165FF, en tailwind y en los colores escritos a mano.
  - **Tipografía:** Noto Sans (`@expo-google-fonts/noto-sans`) se carga en el layout raíz; la splash espera a la fuente. `ThemedText` aplica la familia según el peso (`src/utils/brand-fonts.ts`).
  - **Ícono, ícono adaptativo, favicon y splash** con el isotipo y el logo AltaGo.
  - **Drawers de admin y owner** con el logo horizontal local.
- **Login (`login.tsx`), según el manual (pág. 15):**
  - foto CC0 de un Gulfstream (MarcusWoeckel / Pixabay, vía Wikimedia Commons) en `assets/images/brand/login-background.jpg`, con degradado navy en SVG;
  - logo blanco y la frase "Vuelos privados a tu medida.";
  - Google como acción principal, Apple, y correo/contraseña desplegable;
  - la lógica de acceso no cambió.
- **Dependencias nativas de la fase 3:** `expo-camera` (escáner de boarding pass, con el permiso en `app.json`) y `expo-linear-gradient`. Requieren un build de desarrollo nuevo.

- **Cards de vuelos colapsables (`src/components/flight-summary-card.tsx`):** las listas de cliente, piloto/encargada, owner y reservas usan una card compacta (ruta, fecha, estado, matrícula, pasajeros y precio) que se despliega con `LayoutAnimation` y muestra el resto de los datos y todas las acciones. Hay una sola abierta por lista. En el cliente se abre sola la primera reserva que espera pago.
- **Pronóstico del tiempo (`useFlightWeather.ts`, `flight-weather.tsx`):** Open-Meteo (gratis, sin clave), para vuelos `confirmed`/`delayed` de los próximos 7 días.
  - **Qué muestra:** origen a la hora de salida y destino a la de llegada; temperatura, condición, viento en km/h y nudos con dirección, ráfagas y probabilidad de lluvia.
  - **Por rol:** versión completa para el staff (en la card y en el detalle) y resumida para el cliente.
  - **Aviso en pantalla:** es una referencia, no reemplaza METAR/TAF.
- **Tipo de cambio:** la lista de reservas y el modal de Bancard usan `useExchangeRate()` en vez de la tasa fija.

## 2. Rol: ADMIN
- **Dashboard e Index (`index.tsx`, `_layout.tsx`):** Navegación por Drawer configurada con iconos (`Ionicons`), logotipo superior y safe areas. El dashboard cuenta con:
  - Consumo en tiempo real de la base de datos para la cantidad de Modelos Base, Flota Activa y **Vuelos Reservados** (consultando la colección `aircraft-reservation` en Firestore mediante TanStack Query).
  - Ajustes de diseño para evitar el desbordamiento de textos en las tarjetas de acceso rápido (usando `flex-shrink` y `numberOfLines`).
  - Mejora en el contraste del banner principal usando la paleta corporativa y color oro visible (`text-amber-300`).
- **Gestión de Plantillas de Aeronaves (`templates`):**
  - Pantalla `index.tsx`: Listado de plantillas con `FlatList` obtenidas desde Firestore mediante TanStack Query (`useAircraftTemplates`). Capacidad de eliminar con confirmación de seguridad. Botón flotante (FAB) para agregar nueva plantilla.
  - Pantalla `add.tsx`: Formulario de alta complejidad protegido con React Hook Form + Zod. Se consolidó el manejo de arrays y objetos anidados (ej. `dinghies_capacity` consolidado en un solo Controller con campos dinámicos). Se implementó validación estricta y se añadió `returnKeyType="done"` en todos los campos para facilitar la ocultación del teclado, además de un `keyboardVerticalOffset` ajustado en el `KeyboardAvoidingView` para iOS.
  - Configuración de la navegación para que `templates/add` no aparezca en el menú del Drawer, y la sección de plantillas se denomine unificadamente "Aeronaves".
- **Control de Flota y Tarifas (`fleet-pricing.tsx`):** tarifa **por hora** de cada aeronave (IVA incluido), pernocte, hangaraje por noche y factor de bloque. Se guardan en los Ajustes de GIO de la aeronave. La tarifa por milla (`pricePerMileOverride`, `model-pricing`) quedó obsoleta.
- **Gestión de usuarios (`users.tsx`, `useAdminUsers.ts`):** busca por nombre, email o documento y filtra por rol. Agrega o quita los roles OWNER y PILOT: al agregar, crea `owners/{uid}` o `pilots/{uid}` si no existen; al quitar, solo saca el rol y conserva los documentos. Si un usuario tiene el rol pero le falta el documento, aparece el botón "Crear perfil".

- **Facturación (`billing.tsx`):** tablero mensual por aeronave.
  - **Totales:** vuelos, facturado con IVA y neto (USD y Gs), IVA, ticket promedio, horas (de GIO o `billable_hours`), ingreso por hora y margen sobre los costos directos de GIO.
  - **Lista:** solo datos reales. No usa `mapReservationToAccountingItem`, que inventa datos.
  - **Período:** el mes se toma por fecha de cobro o de vuelo.
- **Plan de negocio (`business-plan.tsx`, `src/utils/business-plan.ts`, colección `business-plans/{aircraftId}`, solo ADMIN):** integra la planilla de rentabilidad.
  - **Pestañas:** Situación actual (real de GIO contra el plan), Escenarios con y sin CESA, Simulador en vivo, Terceros (fee CESA + plataforma) y ROI real acumulado.
  - **Costos:** los operativos se leen de GIO; el plan solo guarda seguros, inspecciones, inversión, metas de horas, tarifas y parámetros de terceros.
  - **Correcciones a la planilla:** la reserva de overhaul es por hora, se trabaja con el ingreso neto de IVA y hay opciones para descontar Bancard (2,5 %) e IRE (10 %).
  - **IVA:** la tarifa de hoy (GIO) es con IVA incluido. Las tarifas con CESA se cargan **sin IVA** (`tarifasCesaIncluyenIva`, configurable). Las habilitaciones por defecto son USD 8.000 por año.
  - **Verificación:** `node tests/business-plan/verify-spreadsheet.mjs` reproduce la planilla (128 chequeos).
  - **IA:** el botón "Preguntale a la IA" queda para más adelante.

## 3. Rol: OWNER
- **Navegación por Drawer (`_layout.tsx`):** Se migró de un Bottom Tab a un Drawer idéntico al del administrador (ancho de `280px`, logo de Altavia en cabecera y `UserAvatar` con modal en el pie de página). Se configuró `headerShown: false` de forma global para respetar las cabeceras transparentes y personalizadas que ya existían en cada pantalla, y se configuró `<StatusBar style="dark" />` para un contraste óptimo.
- **Cabeceras Transparentes e Insets:** Se integró `useSafeAreaInsets` en las vistas principales (**Vuelos**, **Aeronaves** y **Pilotos**) aplicando `paddingTop: insets.top`. Esto corrige la colisión de los encabezados con la barra de estado.
- **Botón de Menú Integrado:** Se incorporó un botón de menú tipo hamburguesa (`menu`) en los encabezados transparentes de las tres pantallas principales (Vuelos, Mis Aviones y Mis Pilotos) permitiendo abrir el panel lateral del Drawer mediante gestos táctiles o el botón físico.
- **Historial y Operaciones de Vuelos (`index.tsx`):**
  - Se eliminaron los botones de carga para desarrollo y se añadió una cabecera de título transparente consistente con el resto de la aplicación.
  - Se consume la base de datos de manera reactiva: obtiene las aeronaves del propietario con `useOwnerAircrafts` y todas las reservas con `useQuery`, filtrándolas localmente para mostrar solo las asociadas a su flota.
  - Se implementaron filtros interactivos mediante chips horizontales para filtrar vuelos por **Aeronave/Matrícula** y por **Estado de Vuelo** (Pendiente, Aprobado, Completado, Cancelado).
- **Nueva reserva del owner (`(owner)/flights/new-booking.tsx`):** botón "+ Nueva Reserva" en Vuelos. `new-booking` filtra las aeronaves por rol: el admin ve todas, el owner las suyas y la encargada sus `managed_aircrafts`.
- **Plan de vuelo del owner (`(owner)/flights/create-flight-plan.tsx`):** ruta que faltaba; el botón ya existía.
- **Gestión de Disponibilidad (Calendario):** Se implementó la visualización de la agenda de aeronaves (`day-schedule.tsx`) y el editor de eventos/bloqueos recurrentes (`edit-event-recurrence.tsx`).
- **Base de Operaciones:** Funcionalidad para establecer la base (aeropuerto/pista) de la aeronave mediante un selector de aeropuertos (`base-airport.tsx`).
- **Registro de Aeronaves Reales (`add-aircraft.tsx`):** Refactorizado y mejorado con un flujo de autocompletado/sugerencias más fluido (`suggestions.tsx`) y dividido en subcomponentes (`form-step-1` a `form-step-4` en `src/screens/aircraft-add/`).
- **Unificación y Reorganización de Vistas de Flota (`aircrafts/`):** Se unificó la pantalla de visualización y detalle de aviones (`aircraft-details` e `aircraft-specs`) compartiendo vistas comunes entre el propietario y el piloto. La navegación interna se organizó en rutas dedicadas `/details/...` (especificaciones, base de operaciones, calendario, pilotos).
- **Carga de Fotos de Aviones (`photos.tsx`):** Se habilitó el hook `useAircraftPhotos` y la pantalla de carga de imágenes para asociar fotos del avión e indicar cuál es la foto de perfil principal.
- **Plan de Vuelo en Reservas:** Ahora los propietarios pueden visualizar los detalles del plan de vuelo de la aeronave directamente desde las reservas (`view-flight-plan.tsx`).
- **Cargador Dev Oculto (`dev-loader.tsx`):** Se migró y preservó toda la lógica previa de carga masiva de aeropuertos y plantillas de prueba del otro desarrollador en este archivo, configurándolo con `drawerItemStyle: { display: "none" }` en la navegación del Drawer para que no afecte la UI del cliente pero permanezca accesible en el enrutamiento de desarrollo.

## 4. Rol: PILOT
- **Panel de Control (Dashboard de Vuelos):** Implementación de la vista principal `flights/index.tsx` que muestra cronológicamente los vuelos y piernas de vuelo asignadas al piloto (ida/vuelta), conectada a Firestore mediante `usePilotReservations`.
- **Creación y Simplificación del Plan de Vuelo (`create-flight-plan`):** Formulario modular en 4 pasos para que el piloto cree planes de vuelo que quedan registrados en el sistema y se listan de forma cronológica por fecha en `plans/index.tsx`.
- **Navegación Unificada de Flota ("Mi Flota"):** Se habilitaron las pantallas de visualización de la flota técnica asignada para Pilotos y Encargados, compartiendo la misma lógica que el Propietario.
- **Seguimiento de Vuelos (Fase 4 - Parcial):** Se encuentra disponible la API Key de Tracking (FlightAware), pero queda pendiente la implementación de la lógica/interfaz para generar y compartir el enlace de rastreo del vuelo en tiempo real.

- **Módulo Contable para la encargada (`(pilot)/finances`):** pestaña "Contable", visible solo si `isEncargado`. Reutiliza `OwnerOperationalControlView` sobre sus `managed_aircrafts`; los registros quedan a nombre del dueño de cada aeronave. `useOperationalFlights` y `useOperationalExpenses` filtran por `aircraftId` en Firestore para cumplir las reglas.
- **Cambio de estado por el piloto asignado:** en el detalle del vuelo, el piloto asignado puede mover solo los estados operativos de un vuelo confirmado (`FlightStatusModal` acepta `allowedStatuses`).
- **Mis propietarios (`(pilot)/my-owners.tsx`, oculta, se abre desde el avatar):** el piloto ve con qué propietarios está vinculado y puede desvincularse (`useUnlinkFromOwner`). Al hacerlo pierde las aeronaves de ese propietario y, si no le queda ninguno, deja de ser encargado.
- **Alta de aeronaves por la encargada (`(pilot)/aircrafts/add-aircraft.tsx`):** la aeronave se registra a nombre de su propietario (`owner_ids`, con selector si tiene varios), con `createdBy`. El trigger `assignAircraftToCreator` (`functions/src/pilot-sync.ts`) la agrega sola a su `managed_aircrafts`. Las reglas exigen que `createdBy` sea quien crea.
- **Desvinculación y reservas:** `removeUnlinkedPilotFromReservations` saca de `pilot_ids` al piloto que deja de estar vinculado a un propietario, en las reservas futuras y abiertas de sus aeronaves.
- **Editar especificaciones (`src/screens/aircraft-edit`, ruta `aircrafts/details/edit-specs`):** botón "Editar especificaciones" para el admin, el dueño o la encargada que la gestiona. Reutiliza los pasos del alta y solo actualiza `basic_specs`, `technical_specs`, `operating_specs`, `emergency` y `notes`.
- **Asignar pilotos (encargada):** `screens/assign-pilots` usa el `ownerId` de la aeronave. Antes la lista salía vacía. `useOwnerPilots` ahora tiene try-catch, tolera perfiles incompletos y consulta en tandas de 30.

## 5. Rol: CLIENT
- **Motor de Búsqueda:** Formulario de búsqueda avanzado (`index.tsx`) y visualización detallada de resultados (`search-results.tsx`).
- **Reserva de Vuelos:** Flujo para ver detalles de la aeronave seleccionada (`aircraft-details.tsx`) y realizar una reserva en estado inicial (sin pago). La reserva aparece en "Mis Vuelos" (`flights.tsx`) y sincroniza un evento en la agenda del propietario de la aeronave.
- *(Pendiente)*: Recepción y visualización del enlace de tracking en tiempo real (FlightAware).
