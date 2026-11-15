# Envío mensual de nómina

Las quincenas se guardan como períodos de origen. En **Revisar nómina del mes**, el envío genera un documento mensual por empleado y conserva los importes, homologaciones y fechas de pago de sus períodos.

- El servidor consulta todas las fuentes del empleado y el mes; no utiliza los filtros de la pantalla para consolidar.
- Suma importes con aritmética decimal, sin recalcular las fórmulas guardadas. Conserva las novedades detalladas y los códigos de catálogo seleccionados.
- Rechaza períodos superpuestos, fuentes de otro mes, datos incompatibles o códigos legales contradictorios.
- Una sola quincena puede enviarse después de revisar el aviso, por ejemplo si el empleado ingresó o se retiró durante el mes.
- Los períodos ya enviados individualmente requieren revisión antes de consolidar. No se vuelven a emitir automáticamente como un mensual.

## Endpoint

`POST /integrations/jarvis/payroll/months/:month/employees/:id/send`

El cuerpo contiene `sources: [{ id, updatedAt, version }]`, tomado del listado del servidor. El empleado y la empresa se validan en el backend; la empresa siempre proviene del usuario autenticado.

`version` firma los valores y las capturas históricas del período. Se revisa el conjunto completo de fuentes al consolidar y de nuevo, bajo el bloqueo de nómina de la empresa, antes de reservar el consecutivo y transmitir. Si cambió el mes, se pide actualizar el resumen.

El cliente envía los empleados pendientes uno por uno y muestra el resultado junto a cada empleado. Una falla no vuelve a enviar a los aceptados.

## Persistencia y reintentos

Se reutiliza `jarvis_payroll_documents` y su historial de transmisiones; no hay una migración nueva.

- `state.monthlyConsolidation` identifica el mensual y registra las versiones de origen. `generated: true` distingue el documento adicional de las quincenas y lo excluye del listado de períodos para no duplicar los totales.
- `state.monthlyDocumentId` vincula las quincenas al resultado mensual. Estos metadatos los escribe únicamente el servidor.
- Si el origen ya es un mes completo, se reutiliza ese documento para respetar la restricción de fechas únicas por empleado.
- El listado devuelve `monthlySubmission`, el estado y los errores del mensual sobre sus períodos de origen.
- Un rechazo corregible permite editar las fuentes y consolidarlas otra vez conservando el identificador, prefijo y consecutivo del mensual rechazado.
- `ACCEPTED`, `PROCESSING` y `UNCERTAIN` impiden otro envío y los cambios en las fuentes. Los documentos aceptados se corrigen mediante notas de ajuste referenciadas al mensual.
- Los timeouts y las respuestas ambiguas conservan la reserva y requieren confirmar el resultado; no hay reintentos automáticos.

El envío utiliza el cliente existente de NextPyme, su token por empresa y el endpoint `payroll`. `payroll_period_id` conserva la frecuencia de pago (quincenal o mensual), consultada en el catálogo `payroll_periods`; las fechas de liquidación del cuerpo abarcan el mes completo.

Referencias: [tabla maestra de NextPyme](https://developers.nextpyme.plus/docs/tables) y [periodicidad mensual por beneficiario, DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_10193_2026.htm).

## Verificación

Las pruebas `payroll-monthly.spec.ts` y `payroll-monthly-service.spec.ts` cubren la consolidación, versiones, historial y reintentos con un proveedor simulado. Las pruebas del frontend cubren los acumulados y estados del resumen. También se verificaron las consultas reales en tablas temporales de PostgreSQL con rollback final y NextPyme simulado; no se emitieron documentos reales.
