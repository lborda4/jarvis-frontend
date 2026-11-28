# Asesores del administrador

La pestaña **Asesor** permite crear asesores con nombre y correo, reenviar el acceso, consultar o asignar sus clientes y revisar sus comisiones mensuales. Las nuevas ventas usan la clase del producto: básica 10 %, plus 15 % y pro 20 %. Ver [panel y comisiones](advisor-commissions.md).

Cada cliente tiene un asesor principal identificado por `advisorId`. Los nombres comerciales previos no se vinculan automáticamente. Para cambiar de asesor se desvincula primero el cliente. El nombre comercial de los clientes vinculados se actualiza al renombrar al asesor.

## Activación

Aplicar en el backend la migración `1795800000000-AddAdvisors`, después de las migraciones pendientes anteriores, antes de iniciar esta versión. Añade `advisors` y `companies.advisor_id`. No se ha ejecutado contra una base de datos durante el desarrollo.

El envío utiliza la configuración existente de Resend y `APP_PUBLIC_URL`. Al crear un asesor se guarda una cuenta inactiva con rol `advisor`, sin asignarle acceso operativo a empresas. El correo contiene un enlace de registro de 72 horas y un solo uso. El asesor define su contraseña y acepta la política de datos. Un reenvío pendiente invalida el enlace anterior; una cuenta registrada recibe el enlace de inicio de sesión. Los fallos de envío conservan la cuenta y permiten reintentar.

Un usuario existente puede convertirse en comercial conservando sus vínculos operativos. El selector permite elegir entre sus empresas vinculadas como usuario y la empresa demo; estar asignado como asesor de un cliente no concede acceso operativo. El servidor verifica el vínculo al seleccionar la empresa y en cada petición, y mantiene bloqueada la administración.

La demo es una única empresa compartida por todos los comerciales, guardada en PostgreSQL. Reutiliza las rutas, menús, formularios, borradores, documentos, catálogos, nómina y reportes de la aplicación normal. Al abrirla, `POST /advisor/demo/access` concede el vínculo con esa empresa y el frontend selecciona la empresa mediante `POST /auth/switch-company`, igual que para una empresa real. El rol comercial se conserva, la sesión sobrevive a la recarga y el selector permite volver a cualquiera de las empresas reales vinculadas. Si la cuenta deja de ser comercial, el servidor rechaza su acceso a la demo aunque conserve un vínculo previo.

Aplicar la migración del backend `1796400000000-SharedAdvisorDemoTenant`, después de las anteriores y antes de iniciar esta versión. Crea la empresa compartida con los módulos de facturación y nómina, una suscripción interna y numeraciones demo. Conserva las facturas de la demo anterior en el historial normal; las tablas anteriores quedan como archivo, sin endpoints activos. Los datos de negocio se guardan en las tablas normales por empresa, sin filtrar por el comercial que los creó.

La integración de la empresa demo utiliza un marcador interno que el transporte del backend intercepta antes de hacer HTTP. Simula las consultas, la emisión, los eventos RADIAN y los correos sin contactar a NextPyme ni a la DIAN; las operaciones desconocidas fallan localmente. Las empresas reales continúan utilizando su transporte habitual. Los PDF demo usan el mismo generador con una etiqueta de demostración, sin QR de la DIAN ni afirmaciones de validación tributaria. Los registros guardados pertenecen a PostgreSQL; la sesión y las cachés del navegador mantienen el comportamiento normal de la aplicación.

Las pruebas usan repositorios y correo simulados: no crean cuentas reales, no ejecutan migraciones y no envían mensajes.
