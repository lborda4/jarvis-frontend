# Numeración de nómina administrada por Jarvis

En **Configuración → Integración Jarvis**, solo los administradores ven **Configurar numeración de nómina**. El modal muestra la empresa activa, el registro de NI/NA en NextPyme y el próximo consecutivo de cada prefijo. El usuario final no configura rangos ni elige resolución al enviar.

## Flujo

1. `GET /admin/companies/:companyId/jarvis/payroll-numbering` consulta `GET /api/ubl2.1/reports/resolutions` con el token guardado de esa empresa. Se consulta el registro de NextPyme tanto en pruebas como en producción; no se usa `numbering-range` de facturación DIAN para buscar NI/NA.
2. Al pulsar **Aplicar configuración NI y NA**, el backend vuelve a consultar y hace ambos PUT aunque los rangos ya existan. Para los registros encontrados usa el tipo, prefijo y límites consultados, junto con `resolution`, `resolution_date`, `technical_key`, `date_from`, `date_to` y `generated_to_date` cuando NextPyme los devuelve. Omite los campos de solo lectura `id`, `number`, `next_consecutive` y el objeto `type_document`.

Si un rango no existe, se usan los datos confirmados por soporte:

```json
{ "type_document_id": 9, "prefix": "NI", "from": 1, "to": 99999999 }
```

```json
{ "type_document_id": 10, "prefix": "NA", "from": 1, "to": 99999999 }
```

Se usa `PUT /api/ubl2.1/config/resolution`. No se inventan número de autorización, fechas o clave técnica cuando faltan en la consulta.

3. Se reconsultan ambos registros antes de confirmar éxito y se sincronizan los contadores locales con el mayor valor entre la reserva local, los documentos ya numerados y el próximo consecutivo que reporta NextPyme tanto antes como después del PUT. Si un rango existe con otros límites, está duplicado o no informa un consecutivo verificable, el modal pide revisar la configuración; no lo sobrescribe automáticamente.
4. Si NI se aplica y NA falla, se informa el error y el siguiente intento vuelve a aplicar ambos PUT. Un rango encontrado en la consulta no oculta un error del PUT: solo se anuncia éxito después de que ambos PUT respondan correctamente y se verifique la configuración.

Las rutas admin exigen `AdminGuard`. El navegador no recibe ni envía el token NextPyme. La configuración no cambia el ambiente de nómina: utiliza el que tenga configurado la empresa.

## Contadores y envíos

- Las nuevas nóminas usan tipo 9, prefijo NI y `jarvis_payroll_settings.next_number`.
- Las nuevas notas usan tipo 10, prefijo NA y `jarvis_payroll_settings.next_note_number`.
- Los números se reservan con el mismo bloqueo transaccional por empresa que utiliza el envío de nómina. Registrar rangos no mantiene una transacción abierta mientras responde NextPyme.
- Los reintentos conservan los números ya reservados y no consumen otro consecutivo. Los documentos históricos no se renumeran. Las notas históricas que usaron NI siguen ocupando ese número dentro del prefijo NI para evitar colisiones.
- Los envíos nuevos se limitan al rango 1–99999999. No se reinician contadores al cambiar de ambiente ni al volver a pulsar el botón.

## Despliegue y validación

Aplicar la migración **1795100000000-AddPayrollNoteNumbering** antes de usar este backend. Añade el contador de NA y lo inicializa desde los documentos existentes con ese prefijo, sin bajar el contador NI.

Se verificaron los PUT con datos simulados, el uso de los datos encontrados incluso para rangos existentes, la recuperación de errores parciales, los permisos admin y el envío de una nota dentro de las pruebas del servicio (tipo 10, NA y referencia al NI original). No se hicieron solicitudes de configuración reales a NextPyme ni se ejecutó la migración sobre una base de datos de la empresa durante este desarrollo.
