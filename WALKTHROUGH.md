# Registro Acumulativo de Desarrollo (Walkthroughs)

Este documento mantiene un registro histórico de las funcionalidades implementadas, estructurado por roles y componentes comunes, para no perder contexto entre sesiones de desarrollo.

## 1. Componentes Comunes / Base
- **Enrutamiento (Expo Router):** Se estableció la estructura de carpetas protegidas `/(admin)`, `/(client)`, `/(owner)`, `/(pilot)`.
- **Zod Schemas (`src/types`):** 
  - `templates.ts`: Definición de `AircraftTemplateSchema`.
  - `owner.ts`: Definición de `AircraftSpecsSchema`, `DinghiesCapacitySchema`, etc.
  - Regla aplicada: Todos los tipos deben residir estrictamente en `src/types/`.
- **Autenticación, Registro y Selector de Roles (`login.tsx`, `register.tsx`, `src/app/_layout.tsx`, `src/components/role-selection.tsx`):** UI para inicio de sesión, registro de usuarios y redirección por roles. Si un usuario posee múltiples roles en Firestore, la app intercepta el enrutamiento en el `_layout` raíz mediante `isRoleSelectorRequired` y le muestra el componente de selección de rol (`role-selection.tsx`) antes de permitir el ingreso a las carpetas protegidas.
- **Botón de Cierre de Sesión Estilizado (`sign-out-button.tsx`):** Rediseñado para verse secundario y estilizado. Tiene un diseño de fila centrado con un borde sutil rojo e incorpora el icono `log-out-outline` de Ionicons.
- **Avatar Reutilizable y Selector Multirrol de Perfil (`user-avatar.tsx`):** Componente que unifica el círculo del perfil y el modal inferior. En caso de que el usuario tenga múltiples roles asignados, el modal muestra chips interactivos para cambiar de rol al instante a través del método `selectRole` de `useAuth`.
- **Flujo Legal (Aceptación de TyC - `src/app/(client)/terms.tsx`):** Implementación del flujo de aceptación de Términos y Condiciones obligatorios con scroll forzado. Al ser aceptados, se genera un registro inmutable en la colección `legal_logs` que incluye: IP del usuario (vía `api.ipify.org`), datos detallados del dispositivo (marca, modelo, versión de SO usando `expo-device`), marca de tiempo de Firestore, y versión del contrato. Asimismo, actualiza la propiedad `acceptedTermsVersion` en el perfil del usuario.
- **Utilidades y Base de Datos de Aeropuertos:**
  - Archivos matemáticos para cálculo de distancias (Haversine) y búsqueda de aeropuertos implementados.
  - **Dataset de Aeropuertos:** Se mapeó un archivo estático con aeropuertos de Sudamérica en **[airports_sa.json](file:///c:/proyectos/altavia-app/src/assets/data/airports_sa.json)**. En modo de desarrollo, se implementó un script de carga por lotes (chunks) a Firestore en **[index.tsx](file:///c:/proyectos/altavia-app/src/app/(owner)/index.tsx)** para nutrir la colección `airports`, la cual alimenta al selector `airport-picker.tsx` en el buscador de vuelos del cliente.

## 2. Rol: ADMIN
- **Dashboard e Index (`index.tsx`, `_layout.tsx`):** Navegación por Drawer configurada con iconos (`Ionicons`), logotipo superior y safe areas. El dashboard cuenta con:
  - Consumo en tiempo real de la base de datos para la cantidad de Modelos Base, Flota Activa y **Vuelos Reservados** (consultando la colección `aircraft-reservation` en Firestore mediante TanStack Query).
  - Ajustes de diseño para evitar el desbordamiento de textos en las tarjetas de acceso rápido (usando `flex-shrink` y `numberOfLines`).
  - Mejora en el contraste del banner principal usando la paleta corporativa y color oro visible (`text-amber-300`).
- **Gestión de Plantillas de Aeronaves (`templates`):**
  - Pantalla `index.tsx`: Listado de plantillas con `FlatList` obtenidas desde Firestore mediante TanStack Query (`useAircraftTemplates`). Capacidad de eliminar con confirmación de seguridad. Botón flotante (FAB) para agregar nueva plantilla.
  - Pantalla `add.tsx`: Formulario de alta complejidad protegido con React Hook Form + Zod. Se consolidó el manejo de arrays y objetos anidados (ej. `dinghies_capacity` consolidado en un solo Controller con campos dinámicos). Se implementó validación estricta y se añadió `returnKeyType="done"` en todos los campos para facilitar la ocultación del teclado, además de un `keyboardVerticalOffset` ajustado en el `KeyboardAvoidingView` para iOS.
  - Configuración de la navegación para que `templates/add` no aparezca en el menú del Drawer, y la sección de plantillas se denomine unificadamente "Aeronaves".
- **Control de Flota y Tarifas (`fleet-pricing.tsx`):**
  - Implementación inicial para leer aeronaves y sobreescribir tarifas individuales (`pricePerMileOverride`).
  - Configuración de tarifas base por modelo (`model-pricing`).

## 3. Rol: OWNER
- **Navegación por Drawer (`_layout.tsx`):** Se migró de un Bottom Tab a un Drawer idéntico al del administrador (ancho de `280px`, logo de Altavia en cabecera y `UserAvatar` con modal en el pie de página). Se configuró `headerShown: false` de forma global para respetar las cabeceras transparentes y personalizadas que ya existían en cada pantalla, y se configuró `<StatusBar style="dark" />` para un contraste óptimo.
- **Cabeceras Transparentes e Insets:** Se integró `useSafeAreaInsets` en las vistas principales (**Vuelos**, **Aeronaves** y **Pilotos**) aplicando `paddingTop: insets.top`. Esto corrige la colisión de los encabezados con la barra de estado.
- **Botón de Menú Integrado:** Se incorporó un botón de menú tipo hamburguesa (`menu`) en los encabezados transparentes de las tres pantallas principales (Vuelos, Mis Aviones y Mis Pilotos) permitiendo abrir el panel lateral del Drawer mediante gestos táctiles o el botón físico.
- **Historial y Operaciones de Vuelos (`index.tsx`):**
  - Se eliminaron los botones de carga para desarrollo y se añadió una cabecera de título transparente consistente con el resto de la aplicación.
  - Se consume la base de datos de manera reactiva: obtiene las aeronaves del propietario con `useOwnerAircrafts` y todas las reservas con `useQuery`, filtrándolas localmente para mostrar solo las asociadas a su flota.
  - Se implementaron filtros interactivos mediante chips horizontales para filtrar vuelos por **Aeronave/Matrícula** y por **Estado de Vuelo** (Pendiente, Aprobado, Completado, Cancelado).
- **Gestión de Disponibilidad (Calendario):** Se implementó la visualización de la agenda de aeronaves (`day-schedule.tsx`) y el editor de eventos/bloqueos recurrentes (`edit-event-recurrence.tsx`).
- **Base de Operaciones:** Funcionalidad para establecer la base (aeropuerto/pista) de la aeronave mediante un selector de aeropuertos (`base-airport.tsx`).
- **Registro de Aeronaves Reales (`add-aircraft.tsx`):** Se implementó un formulario por pasos (wizard de 4 pasos: Básicas, Técnicas, Operación, Seguridad) para que el propietario registre aeronaves reales. El formulario incluye autocompletado para buscar y aplicar una plantilla base creada por el Administrador, o cargar los datos manualmente, validado estrictamente con `AircraftSpecsSchema` y guardado en Firestore vinculando el `ownerId`.
- **Cargador Dev Oculto (`dev-loader.tsx`):** Se migró y preservó toda la lógica previa de carga masiva de aeropuertos y plantillas de prueba del otro desarrollador en este archivo, configurándolo con `drawerItemStyle: { display: "none" }` en la navegación del Drawer para que no afecte la UI del cliente pero permanezca accesible en el enrutamiento de desarrollo.

## 4. Rol: PILOT
- **Seguimiento de Vuelos (Fase 4 - Parcial):** Se encuentra disponible la API Key de Tracking (FlightAware), pero queda pendiente la implementación de la lógica/interfaz para generar y compartir el enlace de rastreo del vuelo en tiempo real.
- *(Pendiente de inicio)*: Dashboard de visualización de vuelos asignados.

## 5. Rol: CLIENT
- **Motor de Búsqueda:** Formulario de búsqueda avanzado (`index.tsx`) y visualización detallada de resultados (`search-results.tsx`).
- **Reserva de Vuelos:** Flujo para ver detalles de la aeronave seleccionada (`aircraft-details.tsx`) y realizar una reserva en estado inicial (sin pago). La reserva aparece en "Mis Vuelos" (`flights.tsx`) y sincroniza un evento en la agenda del propietario de la aeronave.
- *(Pendiente)*: Recepción y visualización del enlace de tracking en tiempo real (FlightAware).
