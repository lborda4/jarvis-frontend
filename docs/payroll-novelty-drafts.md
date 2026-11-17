# Edición local de novedades

Agregar, aplicar cambios y eliminar novedades actualiza el estado completo del empleado en el frontend. Estas acciones no llaman al endpoint de guardado ni recargan el listado. Los campos, las filas y los totales usan el mismo borrador.

En la pantalla de novedades, «Guardar período» envía todos los empleados editables del período. En el acceso directo al modal de un empleado, el botón guarda todas las novedades de ese empleado juntas. Se conserva un único documento por empleado y período.

El frontend usa `PUT /integrations/jarvis/payroll/documents` con `{ documents: [{ id, state, updatedAt }] }`. El backend comprueba la empresa autenticada, las versiones de edición y el estado editable de todos los documentos antes de escribir. Reutiliza las validaciones del guardado individual y la misma transacción para todo el lote. Un error revierte todas las escrituras. El envío mensual a la DIAN se bloquea si alguno de los empleados seleccionados tiene novedades locales pendientes de guardar.

El límite de JSON de las rutas de documentos de nómina se amplía a 10 MB para recibir el conjunto; el servicio limita el lote a 1000 documentos y conserva los límites por documento. Se mantiene el bloqueo de edición de documentos enviados y consolidados.

Los borradores permanecen en memoria al cerrar el modal o navegar dentro de la aplicación, separados por empresa. Se limpian cuando el servidor confirma el guardado, al cerrar sesión o al cambiar de empresa. Si falla el guardado, se conservan para reintentar. No sobreviven a recargar o cerrar la pestaña; la vista de edición advierte al intentar hacerlo con cambios pendientes. Si hay un conflicto con otra sesión, no se sobrescriben los datos del servidor.

Frontend y backend deben actualizarse juntos. No requiere migración ni cambia el envío a la DIAN.
