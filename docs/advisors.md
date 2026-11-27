# Asesores del administrador

La pestaña **Asesor** permite crear asesores con nombre y correo, reenviar el acceso, consultar o asignar sus clientes y revisar sus comisiones mensuales. Las nuevas ventas usan la clase del producto: básica 10 %, plus 15 % y pro 20 %. Ver [panel y comisiones](advisor-commissions.md).

Cada cliente tiene un asesor principal identificado por `advisorId`. Los nombres comerciales previos no se vinculan automáticamente. Para cambiar de asesor se desvincula primero el cliente. El nombre comercial de los clientes vinculados se actualiza al renombrar al asesor.

## Activación

Aplicar en el backend la migración `1795800000000-AddAdvisors`, después de las migraciones pendientes anteriores, antes de iniciar esta versión. Añade `advisors` y `companies.advisor_id`. No se ha ejecutado contra una base de datos durante el desarrollo.

El envío utiliza la configuración existente de Resend y `APP_PUBLIC_URL`. Al crear un asesor se guarda una cuenta inactiva con rol `advisor`, sin asignarle acceso operativo a empresas. El correo contiene un enlace de registro de 72 horas y un solo uso. El asesor define su contraseña y acepta la política de datos. Un reenvío pendiente invalida el enlace anterior; una cuenta registrada recibe el enlace de inicio de sesión. Los fallos de envío conservan la cuenta y permiten reintentar.

Un usuario existente puede convertirse en comercial conservando sus vínculos operativos. El selector permite elegir entre sus empresas vinculadas como usuario y la aplicación demo; estar asignado como asesor de un cliente no concede acceso operativo. El servidor verifica el vínculo al seleccionar la empresa y en cada petición, y mantiene bloqueada la administración. La demo conserva sus rutas y datos aislados y no emite documentos reales.

Las pruebas usan repositorios y correo simulados: no crean cuentas reales, no ejecutan migraciones y no envían mensajes.
