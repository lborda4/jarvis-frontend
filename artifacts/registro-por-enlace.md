# Registro por correo de bienvenida

Al crear una empresa, Administración solicita el **Correo de bienvenida** y envía automáticamente una invitación con la plantilla Jarvis. El destinatario abre el enlace, define y confirma su contraseña y acepta el documento de su integración. El correo y la empresa proceden del enlace; no se solicitan NIT ni código de invitación.

Si el correo ya tiene una cuenta, se exige su contraseña actual para vincular la empresa y se conserva esa contraseña.

Los enlaces vencen en 72 horas y se utilizan una sola vez. Consultar el enlace no lo consume. Administración permite enviar o reenviar una bienvenida para empresas nuevas y existentes; el nuevo enlace invalida los anteriores pendientes del mismo correo y empresa. Al cambiar el correo principal, también se revoca su invitación anterior. Un error de correo se informa sin deshacer la creación de la empresa.

En **Configuración** de Siigo y Jarvis aparece **Invitar al contador**. Una persona con acceso a la empresa puede ingresar el correo del contador para enviarle el mismo proceso de bienvenida. El nuevo usuario se vincula a esa empresa sin modificar a la persona a cargo ni su acceso. Las invitaciones de otros destinatarios se conservan. Si el contador ya tiene cuenta, usa su contraseña actual; si ya tiene acceso a la empresa, se informa sin enviar otra invitación.

La invitación al contador utiliza la empresa activa de la sesión y verifica en el servidor que quien invita pertenece a ella y que tiene una integración activa de Siigo o Jarvis. Esta ampliación reutiliza la tabla de invitaciones y no requiere otra migración.

## Despliegue

1. Aplicar la migración del backend `1794400000000-CreateCompanyRegistrationInvitations.ts` antes de activar el nuevo backend. Crea la tabla de invitaciones y el campo `companies.registration_email`.
2. Desplegar backend y frontend de este cambio.
3. Configurar `APP_PUBLIC_URL` con el origen público del frontend, `RESEND_API_KEY` y `RESEND_FROM` con un remitente autorizado en Resend. Se reutiliza la configuración de recuperación de contraseña.
4. Para empresas existentes pendientes de registro, usar **Acceso de usuario → Enviar / reenviar**. Los códigos antiguos ya no permiten crear cuentas.

La plantilla puede revisarse en `correo-bienvenida-jarvis.html`; su enlace es de ejemplo. Las pruebas automatizadas no envían correos reales.
