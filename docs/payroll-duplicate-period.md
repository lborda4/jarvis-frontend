# Duplicar una nómina

El menú de tres puntos del período incluye «Duplicar». Abre `/nomina/nueva?duplicar=<documento-de-origen>` y preselecciona los empleados de esa quincena o mes, excluyendo notas de ajuste y otros grupos que compartan las mismas fechas.

La información general se completa de nuevo: periodicidad, nombre, mes, año y fecha de pago. La disponibilidad de los empleados sigue comprobándose para las nuevas fechas. Los empleados inactivos, fuera de sus fechas de vinculación o ya incluidos en el período se muestran con su motivo de indisponibilidad.

Al continuar, se envían las referencias y fechas de actualización de los documentos de origen al endpoint existente de creación del período. El backend comprueba que pertenecen a la empresa autenticada y al mismo período, que no sean notas ni documentos mensuales generados, y que no hayan cambiado desde que se abrió el formulario. La copia se crea en una sola transacción y conserva la idempotencia del identificador de la nueva nómina.

Se copian todas las novedades, sus valores, cantidades y datos específicos, junto con los días trabajados y las deducciones legales. Los importes se conservan como valores manuales, sin ejecutar fórmulas antiguas. Se incorporan las definiciones de conceptos de origen que falten en los parámetros del nuevo período y se conservan las validaciones normales de guardado.

Las fechas de vacaciones, incapacidades y otras novedades se desplazan al nuevo período. Se ajustan los límites cuando el mes nuevo es más corto. Las horas extras mantienen su duración, incluso cuando el intervalo cruza medianoche. Esto no recalcula sus importes ni cantidades; se pueden revisar y editar al continuar a novedades.

Los documentos, el grupo y las líneas reciben identificadores nuevos. No se copian consecutivos, CUNE, aceptación, transmisiones, archivos ni enlaces al consolidado mensual de origen. La nómina original permanece intacta y duplicar no envía documentos a la DIAN.

Los borradores de novedades pendientes deben guardarse antes de duplicar el período. El endpoint de períodos admite JSON de hasta 1 MB para incluir las referencias de los empleados. Frontend y backend deben actualizarse juntos; no requiere migración.
