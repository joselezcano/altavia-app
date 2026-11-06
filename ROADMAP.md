# Hoja de Ruta - ALTAVIA App

## FASE 1 — Setup, Seguridad Legal y KYC
- [x] Setup de entorno (React Native, TS, Tailwind, TanStack Query).
- [x] Modelado de base de datos en Firebase y reglas de seguridad.
- [x] Auth con Firebase (2FA) y enrutamiento protegido por RBAC (Admin, Cliente, Piloto, Propietario, Encargado).
- [x] Flujo legal: pantallas de aceptación de términos y condiciones, con scroll obligatorio y checkbox de descarga como intermediario tecnológico.
- [x] Registro inmutable en BD de aceptación legal (Timestamp, IP, version de contrato).
- [x] Selector Multicuenta en Login (para usuarios con múltiples roles).
- [x] Integración de API KYC con Didit.me (Biometría y verificación de identidad/Pasaporte completada vía Cloud Functions `startKycSession` y webhook seguro `diditWebhook`).
- [ ] **Pendiente:** KYC obligatorio. El cliente no puede cotizar ni reservar por su cuenta sin `kycVerified` (en la UI de búsqueda y reserva y en la regla de create de `aircraft-reservation`). La verificación ya está implementada; falta exigirla.
- [ ] Autenticación social exclusiva con Google y Apple (utilizando librerías oficiales de Expo).
- [ ] Flujo de Onboarding en 2 pasos:
  - Paso 1: Aceptación de Términos y Condiciones y selección de referencia (origen/recomendación) previo a la creación de cuenta.
  - Paso 2: Formulario dinámico post-login social para completar perfil (Persona Física: CI paraguaya o Pasaporte/DNI extranjero vs Persona Jurídica / Empresa: Razón Social y RUC).
- [ ] Flujo de eliminación de cuenta de usuario (anonimización/soft-delete legal sin borrar historial de vuelos ni reservas para compliance DINAC).
- [ ] Carga y auditoría de contratos (Dry Lease) asociados a propietarios y aeronaves.
- [ ] CRUD de Usuarios, Pilotos y Propietarios.
- [ ] Asignación de rol Encargado a perfiles específicos desde el Admin.
- [~] CRUD de Pistas y Aeronaves (asociadas a propietarios). *(Se completó el módulo de Plantillas y Carga de Aeronaves reales. La carga de Aeródromos cuenta con un JSON base airports_sa.json listo, pero está pendiente definir el CRUD en la UI del Admin).*
- [ ] Dashboard Administrativo CRM inicial: gestión de clientes, historial de reservas y documentación.
- [ ] Setup de reportes de inteligencia de negocios.

**Insumos requeridos:**
- [x] Logotipo y manual de marca ALTAVIA.
- [x] Acceso y configuración de Didit.me (KYC).
- [x] Textos legales definitivos (T&C ya redactados).
- [ ] Credenciales de OAuth para Google y Apple Developer.

## FASE 2 — Arquitectura de Datos y Backoffice
- [x] Motor de búsqueda: filtros por distancia, parámetros de pista (longitud/superficie) y disponibilidad de aeronaves.
- [x] Lógica de bloqueo de fechas por parte del Encargado/Propietario.
- [ ] Ampliación del buscador: soporte por ciudad y ocultación temporal de helipuertos.
- [ ] Integración de API de Clima (ej. OpenWeather/AviationWeather) para hook de visualización de pilotos.
- [ ] Generación de Manifiestos de Vuelo en PDF.
- [ ] Generación de Boarding Pass (QR) para el cliente.

**Insumos requeridos:**
- [x] Matriz de aeronaves con especificaciones técnicas y pistas. *(Soporte estructural creado con Zod Schemas).*
- [ ] Formulas exactas de cotización (tarifas base y comisiones).
- [ ] Diseño oficial del Manifiesto de Vuelo según DINAC.

## FASE 3 — Desarrollo de Portales Comerciales y de Servicio
*(Nota: Fase para agrupar el desarrollo de las interfaces faltantes)*
- [x] App Cliente: Formulario de Solicitud de Vuelo y Checkout (reserva funcional).
- [x] App Propietario: Registro de aeronaves reales (basadas en plantillas) y configuración de base.
- [x] App Piloto: Dashboard de operaciones y vuelos asignados.

## FASE 4 — Ecosistema Financiero y Tracking
- [ ] Pasarela de pagos: integración con Bancard (flujo de pago del 100% para confirmar reserva).
- [ ] Facturación electrónica: integración con SIFEN (e-Kuatia) para emisión y generación de KUDE/Formulario 120 para la SET (personas físicas y jurídicas).
- [ ] Flujo de App Piloto: escaner de QR para validar abordaje y actualización de estados del vuelo.
- [~] Integración de API de Tracking (FlightAware) y generación de enlace para compartir el vuelo en tiempo real. *(Falta poder generar el enlace para compartir el tracking).*
- [ ] Pruebas de estrés del cotizador y validación de cobro total del 100%.

**Insumos requeridos:**
- [ ] Credenciales de producción Bancard (trámite previo a iniciar fase).
- [ ] Certificado digital e-Kuatia / SIFEN.
- [x] API Key de Tracking (FlightAware o similar).

## FASE 5 — QA, Pruebas y Despliegue
- [ ] Auditoría de los logs legales y generación de facturas de prueba.
- [ ] Ajustes UI/UX finales y despliegue en producción.
- [ ] Publicación en App Store (iOS) y Google Play (Android).
- [ ] Entrega de código fuente completo, documentación técnica y credenciales de acceso.

**Insumos requeridos:**
- [ ] Cuentas de desarrollador Apple y Google (a cargo de EL COMITENTE).
- [ ] Acceso a DNS y servidor de producción.
- [ ] Tarjetas de prueba Bancard.

