# Desprendibles de un período aceptado

El menú de tres puntos del período aceptado incluye «Desprendibles». El modal consulta los empleados de ese período y sus correos actuales. Permite selección individual y selección de todos, incluso cuando la lista ocupa varias páginas.

- «Enviar correo» envía el PDF únicamente al correo configurado de ese empleado.
- «Enviar seleccionados» procesa los pendientes seleccionados con un máximo de dos envíos simultáneos. El servicio de correo separa las solicitudes de nómina al menos 250 ms. Los resultados y errores se muestran por empleado; los envíos confirmados se deseleccionan.
- «Descargar PDF» descarga el desprendible individual.
- «Descargar ZIP» incluye un PDF independiente por cada seleccionado; también permite seleccionar empleados sin correo.

El backend valida empresa, período y aceptación, incluyendo la aceptación mensual del documento de origen. No acepta un destinatario ni un PDF enviado por el navegador: toma el correo actual de la ficha del empleado y genera el PDF con los valores y conceptos guardados de la quincena o mes correspondiente. Cada correo contiene un único PDF y un único destinatario. Los archivos se generan en memoria.

El PDF mantiene el diseño del desprendible existente. El ZIP utiliza identificadores únicos para evitar que un archivo sobrescriba a otro. La vista se bloquea durante el envío y la generación del ZIP, incluyendo el cierre manual del modal.

Se reutiliza `ResendMailService` y su configuración existente `passwordResetMail.apiKey` / `passwordResetMail.from`. El remitente debe estar configurado y autorizado en Resend. Los adjuntos usan base64 según la [documentación de Resend](https://resend.com/docs/api-reference/emails/send-email). No se declara un envío exitoso cuando falta configuración o el proveedor no lo confirma.

Cada empleado utiliza una clave de idempotencia para los reintentos desde el mismo modal. El backend retiene la operación y el adjunto hasta 23 horas para reutilizar la misma solicitud al proveedor. Este seguimiento es temporal y reside en el proceso; no es un registro persistente de entrega o de rebotes. No hay reenvíos automáticos.

Endpoints protegidos bajo `/integrations/jarvis/payroll/payslips`:

- `POST recipients`: `{ ids }` consulta destinatarios actuales.
- `GET :id/pdf`: descarga individual.
- `POST zip`: `{ ids }` descarga del conjunto.
- `POST :id/email`: `{ requestId }` envía un desprendible.

Frontend y backend deben actualizarse juntos. No requiere migraciones. Las verificaciones usan servicios de correo simulados; no se envían correos reales durante las pruebas.
