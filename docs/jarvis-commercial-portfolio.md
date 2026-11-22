# Planes Jarvis al crear empresas

Fuente: `PORTAFOLIO INICIAL (1).xlsx`, hoja **Resumen**. Los planes se contratan anualmente; las recargas se manejan aparte y no se incluyen como opciones del selector de suscripción.

| Plan | Precio anual COP | Documentos | Nómina |
| --- | ---: | --- | --- |
| Inscripción inicial de facturación | 139.900 | 50 de obsequio en la primera inscripción | No incluye |
| Inscripción regular de facturación | 139.900 | 25 | No incluye |
| Nómina electrónica básica | 129.900 | No incluye facturación | 2 empleados |
| Combo cumplimiento inicial | 230.000 | 50 | 2 empleados |
| Combo cumplimiento ilimitado | 720.000 | Ilimitados | Ilimitada |

El selector consulta `GET /admin/plans`: presenta nombre, precio y capacidad y envía el `jarvisPlanId` persistido a `POST /admin/companies`. El servidor vincula ese plan con la integración y toma de él los módulos y los 12 meses, aunque el navegador envíe otra selección. Los precios se guardan en `plans.commercial_terms`; no se reciben del navegador. Los planes anteriores y las empresas que ya los utilizan se conservan.

La nota de precio de nómina que aparece en **Recargas** difiere de **Resumen**. Se usa el precio de Resumen, 129.900 COP, manteniendo las recargas separadas según la indicación del usuario.

## Selección y edición de recargas

El alta permite activar recargas opcionales y combinar varios paquetes de documentos o empleados, seleccionando cada código una vez por operación. Por ejemplo, 100 y 50 suman 150 documentos adicionales al cupo base. Se muestran sus precios de pago único separados del precio anual del plan, junto con el total. Solo aparecen recargas compatibles con los módulos y cupos del plan; los planes ilimitados no necesitan recargas.

| Documentos | Precio COP |
| ---: | ---: |
| 10 | 25.000 |
| 25 | 45.000 |
| 50 | 80.000 |
| 100 | 149.900 |
| 250 | 300.000 |
| 500 | 480.000 |

| Empleados adicionales | Precio COP |
| ---: | ---: |
| 1 | 20.000 |
| 2 | 38.000 |
| 3 | 55.000 |
| 4 | 72.000 |
| 5 | 88.000 |
| 6 | 104.000 |
| 7 | 119.000 |
| 8 | 134.000 |
| 9 | 148.000 |
| 10 | 162.000 |
| 11 | 175.000 |
| 15 | 225.000 |
| 20 | 290.000 |
| 30 | 405.000 |

`GET /admin/jarvis/top-ups` entrega el catálogo del servidor. El navegador envía únicamente los códigos (`jarvisTopUpCodes` al crear, `topUpCodes` al editar); el servidor valida la compatibilidad y guarda los nombres, unidades y precios en `integrations.commercial_top_ups`. No confía en importes enviados por el cliente.

El precio vigente de la recarga 100 se actualizó a 149.900 COP según `Modelo_costos_punto_equilibrio_JENIUS_actualizado.xlsx`, hoja Productos. Ese archivo también define las clases de comisión propias de cada recarga y las de los planes; ver [comisiones de asesores](advisor-commissions.md). Las compras ya guardadas conservan su precio original.

En la lista de empresas, **Editar plan** y **Recargar** son acciones separadas. El plan es una suscripción anual. Una recarga es una compra adicional: no sustituye otra compra ni reinicia el período. El saldo interno se calcula como cupo del plan + recargas de documentos confirmadas en el período menos documentos consumidos. Nunca se modifica el plan compartido entre empresas. Las recargas de empleados conservan su unidad y no se convierten en documentos.

**Recargar** envía los códigos y un identificador de operación a `POST /admin/companies/:id/jarvis/top-ups`. Los precios y cantidades se resuelven desde el catálogo del servidor. Cada compra queda registrada con su período y estados `PROCESSING`, `APPLIED`, `FAILED` o `UNCERTAIN`. Repetir un identificador devuelve su resultado sin volver a asignar documentos. Una respuesta ambigua bloquea nuevas asignaciones para esa empresa hasta comprobar la operación; no se reenvía automáticamente. No se mantiene una transacción de base de datos abierta durante la llamada a NextPyme.

Para documentos se reutiliza `assignNextPymePackage`, con el NIT de la empresa y el token de JARVIS COLOMBIA. Se envían únicamente los documentos adicionales; no se vuelve a sumar el cupo inicial ni el documento de reserva. La compra solo incrementa el cupo interno cuando NextPyme confirma. En un alta con token se asigna cupo base + recarga inicial + una reserva; sin token la recarga de documentos queda pendiente y no se acredita. Se registra el paquete inicial pendiente y, al aplicar la primera recarga después de vincular NextPyme, se envían base + reserva + recarga una sola vez. Las recargas siguientes envían únicamente su cantidad adicional. No se deducen automáticamente saldos iniciales de empresas anteriores a la migración: se conserva su asignación manual existente. Las selecciones comerciales anteriores a esta implementación no se convierten automáticamente en créditos, pues no prueban una compra ni una asignación en NextPyme.

Las suscripciones comerciales anuales vencidas no permiten nuevas recargas ni envíos. Las recargas conservan el vencimiento y no trasladan documentos al período siguiente. El historial se conserva. La herramienta manual **Documentos NextPyme** sigue disponible para tareas de administración y no registra una compra de catálogo. No se ejecuta ningún cobro con esta selección.

## Vigencia de la suscripción Jarvis

Al asignar un plan Jarvis, tanto al crear una empresa como al editarla, se consulta `POST /certificates-listing/{nit}` con cuerpo vacío, siguiendo el curl suministrado. Se usa el token propio de la empresa cuando está configurado; en el alta sin token propio se usa el de JARVIS COLOMBIA. No se usa un token fijo del ejemplo.

La respuesta contiene `success: true` y `certificates[].expiration_date`. Se usa el vencimiento más reciente de la lista. Sus fechas sin zona horaria se interpretan en Colombia. Por indicación del usuario, el inicio es un año calendario antes del vencimiento, conservando la hora y ajustando el 29 de febrero al 28 cuando corresponde.

Solo se guardan `startsAt`, `endsAt` y `checkedAt` en `integrations.jarvis_certificate_term`, además del inicio de suscripción. La contraseña del P12 y la respuesta completa no se guardan ni se registran en logs. La consulta ocurre fuera de las transacciones de asignación. Si falla o no trae fechas válidas, el plan y las fechas anteriores permanecen guardados.

Las recargas, las consultas de saldo y la edición del seguimiento sin registrar un pago usan exclusivamente la vigencia guardada; no consultan el certificado. Volver a asignar un plan, incluso el mismo, consulta otra vez y reemplaza esa vigencia. Registrar «ya pagó» reasigna el plan actual y consulta su certificado; si sigue vencido, conserva el estado anterior y pide renovarlo. Las recargas y los envíos se bloquean antes del inicio y desde el vencimiento exacto. El consumo y las compras se calculan dentro del período certificado, independientemente de las fechas generales de cobro de la empresa.

La migración deja sin consultar las integraciones existentes; conservan su cálculo anterior hasta la próxima asignación de plan Jarvis. No hay consultas periódicas ni consultas automáticas por recargar.

## Vencimiento, renovación y acceso de consulta

Al vencer Jarvis, límite, consumo del período y documentos disponibles se muestran en cero, incluso en planes ilimitados. El historial de documentos y recargas se conserva para consulta. Una nueva asignación o pago crea `integrations.jarvis_document_cycle` con un identificador propio y su fecha de asignación: solo cuentan las recargas de ese ciclo y el consumo posterior a su inicio. Se vuelve a habilitar únicamente el cupo base del plan. Esto también descarta saldos anteriores cuando el certificado consultado conserva las mismas fechas.

El paquete base finito se sincroniza con NextPyme usando el registro de operación durable e incluye la reserva existente. Si falta el token queda pendiente. Un resultado ambiguo no se reenvía automáticamente. No se llama a NextPyme para limpiar saldos al vencer: el usuario confirmó que el proveedor los descarta automáticamente.

`GET /subscriptions/access` consulta únicamente la base de datos de la empresa autenticada. El frontend lo lee al entrar, al recuperar el foco y cada minuto, sin consultar certificados. El aviso amarillo aparece desde diez días calendario antes del vencimiento, durante seis segundos, arriba y centrado. Al vencer muestra un aviso rojo y deja un recordatorio de acceso de consulta. Jarvis toma la hora exacta del certificado; SIIGO vence al empezar su día de vencimiento, en Colombia.

El servidor bloquea las escrituras de documentos, importaciones, productos, terceros y configuración de la integración vencida o suspendida. Las lecturas y descargas permanecen accesibles; administración y autenticación permiten renovar y volver a entrar. El trabajador de importaciones comprueba la vigencia antes de cada lote, incluyendo trabajos que ya estaban en cola. El frontend deshabilita las acciones principales y también comprueba las peticiones antes de enviarlas; la protección final permanece en el servidor.

## Ficha del cliente

El nombre del cliente en Seguimiento abre `/admin/clientes/:companyId`. La ficha muestra plan, vigencia, cupo, precio, contacto y pestañas de recargas, pagos, comentarios y datos. Permite editar contacto, asignar plan, recargar y registrar el pago/renovación desde la misma pantalla.

La consulta de saldo y habilitación manual de documentos NextPyme se encuentran en esa ficha y usan directamente su empresa, sin selector. Se retiraron del panel general de Jarvis. La habilitación manual mantiene su operación exclusiva sobre el cupo de NextPyme; las recargas del catálogo actualizan ambos cupos mediante su flujo separado.

Los comentarios y pagos nuevos se guardan en `companies.commercial_activity`. Los pagos históricos sin registro individual y el saldo pendiente no se reconstruyen ni se inventan. La activación de una recarga no implica que exista un pago registrado. Las tablas usan el total filtrado para paginar y ocultan los controles cuando todo cabe en una página.

## Activación

Desplegar frontend y backend juntos y aplicar `SeedJarvisCommercialPortfolio1795200000000`, `AddCompanyCommercialTopUps1795300000000`, `AddJarvisTopUpOperations1795400000000`, `AddJarvisCertificateTerm1795500000000`, `AddJarvisDocumentCycle1795600000000` y `AddCompanyCommercialActivity1795700000000`. Las dos últimas agregan las columnas necesarias para los nuevos ciclos y el historial del cliente. No se ejecutaron migraciones de bases de datos, consultas reales del certificado ni compras de recargas durante estas pruebas.
