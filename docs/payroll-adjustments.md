# Ajustes de nómina

En Nóminas, las acciones Eliminar y Reemplazar junto a Revisar mes trabajan sobre el documento mensual aceptado por empleado, incluyendo todas sus quincenas. No eliminan registros de la base de datos.

- Eliminar: muestra el documento histórico y confirma una nota tipo 2 con el botón Anular envío de la DIAN.
- Reemplazar: copia el documento histórico y abre el editor de novedades. Las novedades se editan localmente hasta pulsar Enviar reemplazo a la DIAN (nota tipo 1).
- La fecha del ajuste comienza en el día actual de Colombia y puede modificarse. Se pide un motivo, máximo 2000 caracteres. Las notas de encabezado y pie se conservan del original.
- Número, CUNE y fecha del predecesor provienen del documento aceptado. El prefijo NA y su consecutivo los asigna el servidor usando su contador independiente.

El frontend prepara un borrador con `PUT /integrations/jarvis/payroll/documents/:originalId/adjustments/:id`, luego usa el envío de documentos existente. El backend hace `POST /api/ubl2.1/payroll-adjust-note` con el token de la empresa; nunca toma CUNE, consecutivos ni datos de otra empresa del navegador.

La preparación conserva las fechas del período, empleado y parámetros históricos. Solo permite editar novedades, días liquidados, fecha y motivo del reemplazo. El borrador incorpora una huella de la solicitud para reutilizar el mismo resultado en reintentos y comprueba versiones al modificarlo. Se bloquea un segundo ajuste del mismo predecesor y los envíos en procesamiento o sin confirmación; estos últimos ofrecen Verificar estado del ajuste.

La aceptación depende de la respuesta DIAN, conservando los estados de rechazo y por confirmar. El listado muestra los ajustes aceptados o pendientes. Una anulación aceptada bloquea nuevos ajustes de ese documento; un reemplazo aceptado se convierte en el predecesor de la siguiente corrección.

La preparación del reemplazo incorpora conceptos configurados después del envío original conservando las bases históricas. El serializador del ajuste transforma vacaciones, licencias, primas, cesantías, bonificaciones y comisiones a las estructuras del ejemplo; los totales del reemplazo incluyen también los componentes no salariales de prima y los intereses de cesantías capturados por separado.

Referencia: https://developers.nextpyme.plus/docs/sdk/php (tipos de nota). La forma reducida de eliminación sigue el curl suministrado por el usuario. Reemplazo reutiliza los campos generales y las deducciones del serializador existente, con la traducción de sus devengos estructurados. Las pruebas simulan al proveedor; no transmiten documentos reales.
