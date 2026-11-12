# Guía de pruebas AltaGo (etapa 1)

Marcá cada ítem cambiando `[ ]` por `[x]`. Si algo falla, anotá debajo: pantalla, qué hiciste y qué pasó (mejor con captura).
Pagos: usá siempre **Bancard staging** (tarjeta de prueba: `5418 6301 1000 0014`, vence `08/30`, CVV `439`).

Roles que vas a usar:
- **Admin** (vos): crea y asigna roles.
- **Julio** (OWNER): vincula pilotos y asigna aviones.
- **Mary** (PILOT con "encargada"): hace el trabajo diario.
- **Cliente de prueba**: otra cuenta Google (ideal, un mail que la encargada ya cargó).

---

## 0. Antes de empezar

- [ ] Desplegado: `firebase deploy --only firestore:rules,storage,functions,hosting`
- [ ] Build nuevo instalado (dev build o TestFlight) con el login nuevo.
- [ ] Las páginas abren: `https://altavia-app.web.app/pagar/` y `.../presupuesto/` (muestran "link no válido", no un error 404).
- [ ] Tipo de cambio cargado (Contadores/cambioDelDia). Se ve en cualquier precio en Gs.
- [ ] Mary tiene una cuenta Google que pueda usar en el teléfono.

## 1. Dar de alta a Mary (Admin → Julio)

**1.1 Crear su perfil**
- [ ] Mary entra a la app con Google y completa el formulario inicial. Queda como CLIENTE.
- [ ] Admin: menú **Usuarios** → buscar a Mary (nombre, mail o documento) → aparece.
- [ ] Tocar **agregar PILOT** → confirmar. Chip "PILOT" en su ficha.
- [ ] (Si aparece "Crear perfil" junto al rol, tocarlo: significa que tenía el rol sin su documento.)

**1.2 Enlazarla con Julio**
- [ ] Julio → **Pilotos** → vincular por el **correo de Mary** → aparece en su lista (sin aceptación).
- [ ] Julio → Mary → activar **encargada**.
- [ ] Julio → Mary → **Aviones a su cargo** → marcar el Cessna 414 (ZP-BOC).

**1.3 Mary entra**
- [ ] Mary cierra sesión y vuelve a entrar. Si tiene varios roles, aparece el selector; elige **Piloto**.
- [ ] Ve 4 pestañas: **Mis Vuelos, Mis Planes, Mi Flota, Contable**.
- [ ] **Mi Flota** muestra el ZP-BOC.
- [ ] Desde el avatar: **Mis propietarios** muestra a Julio.

## 2. Tarifa del ZP-BOC (el problema detectado)

- [ ] Mary → **Contable** → elegir ZP-BOC (que sea el avión real y no uno "de ejemplo").
- [ ] **Ajustes de costos y tarifas**: tarifa por hora **900** (sin IVA), pernocte **100**, hangaraje por noche, factor de bloque **1.12**, piloto **100/h**, piloto pernocte **100**.
- [ ] Tocar **Guardar** (aunque no cambies nada).
- [ ] Esperar ~10 segundos. Como admin: **Control de Flota** → el ZP-BOC muestra "USD 900 / hora…" en lugar de "Sin tarifa por hora".
- [ ] Ficha técnica del ZP-BOC: **velocidad crucero** cargada (Cessna 414 ≈ 180 kt).
- [ ] **Aeropuerto base** del ZP-BOC cargado (ej. SGAS). De esto dependen el traslado y el regreso vacío.
- [ ] Si Control de Flota sigue sin tarifa: revisar que las functions estén desplegadas y que el avión tenga `ownerId` de Julio.

## 3. Mary: presupuesto completo

**3.1 Cliente**
- [ ] Nueva reserva → crear cliente con **alta rápida** (nombre, teléfono, CI/RUC).
- [ ] Repetir el alta con el **mismo documento** → avisa "Ya existe un cliente con ese documento" y no lo duplica.
- [ ] Crear otro cliente **sin correo** → se guarda igual.

**3.2 Vuelo**
- [ ] Origen SGAS, destino SGES, solo ida, fecha futura.
- [ ] Paso 3 "Presupuesto": se ven las líneas sugeridas.
  - [ ] **Servicio de vuelo** = horas × 900 (con factor de bloque).
  - [ ] Sin noches fuera: no aparecen pernocte ni hangaraje.
  - [ ] **Comisión de la pasarela** aparece **oculta** ("incluida en el servicio de vuelo").
  - [ ] **Copiloto**: con el interruptor apagado no aparece; encendido aparece en **USD 0** por hora.
- [ ] Ida y vuelta con regreso a otro día → aparecen **pernocte** y **hangaraje** de 1 noche.
- [ ] Editar un monto a mano → aparece el sugerido con "usar sugerido".
- [ ] Apagar/encender **Mostrar en el presupuesto** de una línea.
- [ ] **Agregar ítem** (concepto, detalle, monto) y borrarlo.
- [ ] **Escribir total a mano** → el IVA y el total se recalculan; "volver al sugerido" lo revierte.
- [ ] Los totales dicen **sin IVA**, luego **IVA 10 %**, luego **Total a pagar**.
- [ ] Bloque **Costos estimados (interno)**: combustible, piloto, plan de vuelo, etc., con **margen** en USD y % (verde/rojo).
- [ ] Cambiar fecha o pasajeros en el paso 2 → los montos que editaste **se mantienen**.

**3.3 Guardar y enviar**
- [ ] **Guardar presupuesto** → abre el detalle.
- [ ] Vista "como lo ve el cliente": sin costos internos; la comisión oculta está sumada al servicio de vuelo.
- [ ] **Compartir PDF** → se genera con la marca y la leyenda "Montos sin IVA…".
- [ ] **Enviar por WhatsApp** → abre WhatsApp con mensaje y link. (Probar con cliente con teléfono y con otro sin teléfono.)
- [ ] El estado pasa a **Enviado**.

**3.4 Hoja del cliente (abrir el link en el navegador del teléfono)**
- [ ] Se ve con la marca, ruta, fechas, líneas, subtotal sin IVA, IVA, total y aprox. en Gs.
- [ ] **No** aparece ningún costo interno ni margen.
- [ ] **Descargar / imprimir PDF** funciona.
- [ ] **Acepto el presupuesto** → mensaje de aceptado. En la app de Mary llega una **notificación** y el estado pasa a **Aceptado**.
- [ ] Abrir el link de nuevo → sigue mostrando "aceptado" y sin botón.

**3.5 Otras vías**
- [ ] Otro presupuesto: **Marcar aceptado (WhatsApp)** a mano.
- [ ] **Marcar rechazado** y **Eliminar** un borrador.
- [ ] **Editar** un presupuesto enviado → sube la versión (v2) y vuelve a Enviado.
- [ ] Un presupuesto con validez vencida aparece como **Vencido** en la lista.
- [ ] La lista **Presupuestos** filtra por estado (chips con contador).

## 4. De presupuesto a vuelo confirmado

- [ ] Presupuesto aceptado → **Crear reserva** → se crea y el presupuesto queda **Convertido** (con "Ver reserva").
- [ ] La reserva queda **Por Aprobar** y bloquea el calendario del avión (revisar en el calendario del ZP-BOC, ida y vuelta).
- [ ] Reservar otro vuelo en el **mismo horario** → avisa "Horario no disponible".
- [ ] **Asignar tripulación y aprobar**: elegir piloto, revisar que el precio se muestre **sin IVA + IVA** y el total a cobrar.
- [ ] Estado **Listo para Pago**. El cliente recibe la notificación (si tiene cuenta).
- [ ] **Enviar link de pago por WhatsApp** → abre `/pagar/` con el resumen y el **total con IVA**.
- [ ] Pagar con la tarjeta de prueba. Al volver, la hoja dice pagado.
- [ ] La reserva pasa **sola** a **Confirmado** (revisar en la app de Mary tras unos segundos).
- [ ] Reintentar abrir el mismo link → dice que ya está pagado (no cobra dos veces).
- [ ] **Cambiar el precio** de una reserva aprobada y no pagada → avisa que conviene reenviar el link; el link nuevo cobra el precio nuevo.

**Reserva directa**
- [ ] **Reservar sin presupuesto** sigue funcionando (el precio incluye la comisión de la pasarela oculta; confirmalo con Julio).

## 5. Editar, reprogramar y eliminar

- [ ] Reserva **sin pagar** → **Editar**: cambiar ruta, fechas, pasajeros → recotiza → precio mantener/sugerido/manual → calendario actualizado.
- [ ] Reserva **pagada** → **Reprogramar**: solo fechas y horas; ruta y precio quedan bloqueados.
- [ ] Reprogramar una pagada a otro día con regreso → cambian las **noches** (revisar luego en GIO).
- [ ] **Eliminar** una reserva sin pagar → desaparece con sus bloqueos del calendario.
- [ ] En una **pagada** no aparece "Eliminar" (solo cancelar con el cambio de estado).

## 6. El día del vuelo

- [ ] En la lista, la card se **despliega al tocarla** (una sola abierta a la vez) y conserva todas sus acciones.
- [ ] Vuelo confirmado dentro de 7 días: aparece el **clima** (origen/destino, viento en km/h y nudos, lluvia).
- [ ] Cambiar el **estado**: confirmado → demorado → en vuelo → completado.
- [ ] **Manifiesto de pasajeros**: cargar, editar y guardar.
- [ ] **Crear FPL** (plan de vuelo) y **adjuntar foto** del plan por tramo (cámara y galería). Se ve luego en "Ver plan de vuelo".
- [ ] **ID de FlightAware**: cargar y editar.
- [ ] **Piloto común asignado** (otra cuenta): ve el vuelo, carga manifiesto y cambia estados operativos, pero **no** puede cambiar precio ni aprobar.

## 7. Boarding pass y escáner

- [ ] Cliente con vuelo pagado: **Ver boarding pass** → una tarjeta por pasajero con QR.
- [ ] Con el manifiesto vacío invita a cargarlo; al cargarlo aparecen los pases.
- [ ] Perfil del cliente: **Mis boarding pass**.
- [ ] Mary/piloto: **Escanear pasajeros** → pide permiso de cámara → leer el QR → ✓ verde, nombre y contador "1/N embarcados".
- [ ] Escanear el mismo QR otra vez → "ya estaba embarcado".
- [ ] Escanear un QR cualquiera o de otra reserva → ✗.
- [ ] Vuelo de otro día → pide confirmación antes de embarcar.
- [ ] Cambiar el documento de un pasajero → su QR cambia (el viejo da ✗).

## 8. Módulo Contable (GIO)

**8.1 Datos automáticos**
- [ ] El vuelo pagado aparece solo en **Vuelos del mes** con fecha, cliente, ruta, pasajeros y precio **sin IVA**.
- [ ] Esos campos están **bloqueados** (aviso "viene de una reserva").
- [ ] Horas marcadas como **estimadas**: cargar las **Hobbs reales** y guardar.
- [ ] Si venía de un presupuesto: combustible, piloto y hangaraje **precargados** como estimación.
- [ ] Si había noches fuera: aparece "Pernocte y hangaraje".

**8.2 Gastos y combustible**
- [ ] Cargar un **gasto suelto al contado** (mantenimiento y otro).
- [ ] Cargar un gasto **a crédito** (proveedor, RUC, factura, foto, vencimiento = factura + 30 días).
- [ ] Vuelo con **combustible a crédito** (proveedor, factura, foto).
- [ ] Pestaña **Por pagar**: lista ordenada por vencimiento, vencidos en rojo, totales en USD y Gs.
- [ ] **Registrar pago**: fecha, medio, **foto del recibo**. El ítem pasa a "Pagado en el mes".
- [ ] **Deshacer pago** (con confirmación).
- [ ] El **resultado del mes no cambia** al pagar (es por devengado); sí cambia "Pendiente de pago".
- [ ] Gastos cargados antes de esta versión aparecen como contado/pagado (sin deudas falsas).

**8.3 Ajustes y resumen**
- [ ] Cambiar la tarifa en Ajustes → "Control de Flota" y el buscador la reflejan en ~10 s.
- [ ] Cambiar el **factor de bloque** → el presupuesto nuevo suma más/menos horas.
- [ ] Exportar **PDF** del mes.

## 9. Cliente de prueba y unión de perfiles

- [ ] Mary crea un cliente con el **correo Gmail** de la cuenta de prueba y le hace una reserva.
- [ ] El cliente entra por primera vez con **Google** con ese mismo correo.
- [ ] **No** pasa por el formulario inicial como si fuera nuevo: ya tiene sus datos.
- [ ] Ve **su reserva** (y la pagada, si la hay) en Mis Vuelos.
- [ ] Una cuenta con otro correo no ve nada ajeno.
- [ ] Como cliente: paga una reserva "Lista para pago" desde la app con **Bancard**.
- [ ] El cliente **no** puede ver precios internos ni costos.

## 10. Julio (OWNER)

- [ ] Ve **Vuelos**, **Mis Aviones**, **Mis Pilotos**, **Módulo Contable**.
- [ ] **+ Nueva Reserva** y **Presupuestos** disponibles.
- [ ] Contable: ve lo que cargó Mary (mismo ZP-BOC).
- [ ] **Editar especificaciones** de la aeronave (botón en la ficha).
- [ ] **Borrar aeronave**: bloqueado si tiene reservas.
- [ ] **Desvincular** a Mary → Mary pierde el avión y deja de ser encargada.
- [ ] Mary se **desvincula sola** desde "Mis propietarios".

## 11. Admin

- [ ] **Usuarios**: buscar, agregar/quitar PILOT y OWNER.
- [ ] **Facturación**: elegir mes/aeronave → vuelos, facturado con y sin IVA, ticket promedio, horas, ingreso por hora y margen.
- [ ] **Plan de negocio**: 5 pestañas (Situación actual, Escenarios, Simulador, Terceros, ROI real). Probar el simulador cambiando horas, tarifa y CESA.
- [ ] **Editar parámetros** del plan (habilitaciones **8.000/año**, tarifas con CESA **sin IVA**).
- [ ] **Control de Flota**: tarifa, pernocte, hangaraje y factor de bloque.
- [ ] **Presupuestos**: ve los de todas las aeronaves.

## 12. Seguridad (deben fallar o estar ocultos)

- [ ] Un cliente **no** ve reservas de otros clientes.
- [ ] Un piloto común **no** ve Contable ni cambia precios.
- [ ] Mary **no** ve aviones que no tiene a cargo.
- [ ] Alguien sin sesión abre `/presupuesto/?t=xxxxxxxxxxxxxxxxxxxx` → "link no válido".
- [ ] Un link de pago vencido (>48 h) → mensaje de vencido.

## 13. Diseño (mirada rápida)

- [ ] Login: foto con el logo blanco y los botones (Google, Apple si iOS, correo desplegable).
- [ ] Splash e ícono con la marca.
- [ ] Tipografía Noto Sans en las pantallas (sin textos "raros" en negrita).
- [ ] Modales y fondos oscuros semitransparentes no quedaron sólidos.
- [ ] Menús del admin y del owner con el logo nuevo.
- [ ] Sin pantallas rotas por el rediseño (anotar cuáles).

---

## Notas de las pruebas

| # | Pantalla | Qué pasó | Captura |
|---|----------|----------|---------|
|   |          |          |         |
