# Pruebas y producción de facturación

En **Configuración → Integración Jarvis**, el botón **Pruebas/producción facturación** se muestra solo al administrador. Opera sobre la empresa activa y su token guardado. Las rutas GET y PUT `/admin/companies/:companyId/jarvis/billing-environment` también exigen `AdminGuard`.

Al aplicar Pruebas:

1. El backend llama a `PUT /api/ubl2.1/config/environment` con `{ "type_environment_id": 2 }`.
2. Llama a `PUT /api/ubl2.1/config/resolution` con factura tipo 1, prefijo SETP, resolución 18760000001, fecha 2019-01-19, clave técnica indicada, rango 990000000–995000000 y vigencia 2019-01-19 a 2030-01-19. `generated_to_date` sigue el ejemplo documentado con valor 0; el siguiente número enviado se conserva localmente, no se obtiene reiniciando ese parámetro.
3. Solo después de ambas respuestas correctas activa esa resolución en `integrations.credentials.resolutions.electronic_invoice`, que es la utilizada al emitir la factura.

Producción envía `type_environment_id: 1` y recupera la resolución de producción guardada antes del cambio, con su consecutivo. Si no existe una resolución de producción completa, esa opción no se habilita. No se crea una resolución ficticia para producción.

Los dos perfiles se almacenan en `jarvis_billing_environments`. Al alternar, se conserva el siguiente número de la resolución activa y se compara con el mayor número del historial de ese tipo y prefijo, sin retroceder. Ejemplo: FV53 → SETP990000000 → FV53 → SETP990000007. Cada prefijo continúa desde su propio avance. El historial permanece disponible.

## Despliegue

Requiere desplegar frontend y backend y ejecutar la migración `1795000000000-CreateJarvisBillingEnvironments`. Se incluye en las migraciones normales de TypeORM; no se ejecutaron migraciones ni se cambiaron ambientes reales durante el desarrollo.

La tabla guarda también identificadores de operaciones activas. Se usan transacciones cortas para coordinar cambios y emisiones entre instancias; no se mantiene una transacción abierta mientras NextPyme responde. Una configuración no puede comenzar durante un envío y una emisión no puede comenzar durante una configuración.

Si falla uno de los dos PUT o la escritura final, el cambio queda pendiente, se conserva la resolución local anterior y se bloquea emitir hasta que el administrador reintente la configuración. No se afirma que una petición remota fallida haya sido revertida: ambos PUT se vuelven a ejecutar al reintentar.

Si el proceso del backend termina abruptamente mientras registra una operación, su identificador se conserva para no habilitar un cambio a ciegas. Un operador debe comprobar que la emisión/configuración ya terminó antes de retirar de `operations` ese identificador concreto. No se borran automáticamente operaciones por antigüedad.

Editar el token conserva el ambiente de facturación seleccionado. El cambio no envía `payroll_type_environment_id` ni `eqdocs_type_environment_id`. La resolución del documento soporte, nómina y sus consecutivos no se sustituyen por SETP.

Referencia: [configuración oficial NextPyme](https://developers.nextpyme.plus/docs/sdk/nodejs). El ambiente es una configuración real de la empresa en NextPyme; no es un simulador local.
