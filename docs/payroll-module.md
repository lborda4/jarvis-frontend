# Nómina electrónica de JARVIS

El módulo usa las rutas `/nomina`, `/nomina/nueva`, `/nomina/empleados` y `/nomina/configuracion`, el layout existente, la empresa activa del JWT y el cliente autenticado de JARVIS. No contiene datos de demostración ni almacenamiento de nóminas en localStorage.

## Creación por período

`Nueva nómina` abre una página con nombre, periodicidad (primera quincena, segunda quincena o mensual), mes, año y selección de empleados, todos obligatorios. La tabla permite buscar, ordenar y seleccionar empleados individualmente o todos los disponibles de la búsqueda. Se aplica la regla de paginación del proyecto.

`PUT /integrations/jarvis/payroll/periods/:id` crea un borrador por empleado en una sola transacción, con un identificador estable que evita duplicar una solicitud si se reintenta. Un error revierte la creación completa. Nombre, periodicidad e identificador del grupo se guardan en el estado JSON de los documentos existentes; no se agregan tablas. Los grupos con las mismas fechas conservan nombres y empleados independientes. Crear el período no transmite documentos ni consume cupo.

## Preparación del entorno

El backend necesita la migración `CreatePayrollModule1793600000000`. Tras corregir la conexión del entorno local se comprobó que ya estaba registrada y que sus siete tablas existen. La persistencia se verificó mediante una transacción real de PostgreSQL que se revirtió al terminar, sin dejar registros de prueba. En otros entornos se deben ejecutar las migraciones antes de usar el módulo.

1. Registrar una vigencia de parámetros que cubra el inicio del período. Los valores legales y factores quedan sin precargar hasta contar con información verificada; registrar las bases mensuales y las tarifas correspondientes.
2. Crear cargos y empleados. Los selectores de trabajador, subtipo, identificación y pago se consultan en las tablas maestras de NextPyme y sus códigos se validan también en el backend.
3. Preparar una nómina, agregar novedades y guardar el borrador. Los importes pueden reemplazarse manualmente y se conserva la fórmula de cada sugerencia.
4. Guardar el ambiente DIAN y sincronizarlo mediante la acción explícita de configuración. Esta operación modifica el ambiente de nómina en NextPyme y no se ejecutó durante el desarrollo.
5. Validar y confirmar el envío desde la interfaz. Se verifica el plan compartido de JARVIS y el saldo `docs_left_absolut` de NextPyme antes de transmitir. El usuario confirmó que facturación y nómina pertenecen al mismo paquete.

## Persistencia y estados

Se agregan tablas de empleados, cargos, versiones de parámetros, configuración, documentos, transmisiones y auditoría. Cada consulta contiene `company_id`. Un guard exige una integración JARVIS activa y se reutiliza la autenticación global existente.

Cada nómina conserva el empleado y los parámetros que se usaron. Las versiones de parámetros son inmutables; las nóminas aceptadas no se editan directamente. Las notas guardan el identificador original y construyen las referencias de número, CUNE y fecha. Los borradores no consumen cupo. Las nóminas aceptadas, en procesamiento o pendientes de confirmación reservan cupo en el mismo contador de JARVIS; los rechazos no se cuentan.

Se reserva el consecutivo bajo una transacción y se persiste la solicitud antes de llamar a NextPyme. Las llamadas HTTP se hacen fuera de esa transacción y no tienen reintentos automáticos. Un timeout conserva un estado incierto y bloquea el reenvío. Cuando existe CUNE, se puede actualizar el resultado desde NextPyme; sin CUNE se requiere confirmar el documento con el proveedor antes de habilitar otro intento.

Se almacenan las respuestas del proveedor y la validación DIAN. Un HTTP 200 o `success: true` no equivale a aceptación: se exige `IsValid`. Las descargas PDF/XML usan únicamente referencias devueltas por NextPyme y pasan por el backend; nunca exponen el token.

## Cálculos

Los importes se representan como cadenas decimales y los cálculos usan enteros (`bigint`) en centavos. El salario se prorratea por días. Las horas usan la base mensual configurada, cantidad y factor, redondeando al final. Se distingue factor total y recargo adicional para evitar volver a pagar la hora ordinaria incluida en el salario. Los descuentos solo se sugieren con base y porcentaje configurados. Aprendices, salarios integrales y pensiones de alto riesgo no reciben sugerencias ordinarias de descuentos. El auxilio de transporte se ingresa manualmente porque no se infiere su elegibilidad solamente del salario.

## Alcance verificado y pendientes de especificación

Se consultó la documentación oficial y se inspeccionó el código público de `@nextpyme/sdk` 1.1.0 sin instalarlo ni ejecutarlo. Se reutilizó el cliente propio de JARVIS.

- Verificados: `/payroll`, `/payroll-adjust-note`, `/config/environment`, `/status/document/{cune}`, `/download/{nit}/{filename}`, `/plan/infoplanuser`; estructuras de salario, auxilio de transporte, EPS y pensión; notas de reemplazo y eliminación.
- Verificados mediante consultas de lectura con la integración existente: saldo `docs_left_absolut` y tablas maestras `type_workers`, `sub_type_workers`, `type_document_identifications` y `payment_methods`. Estas consultas no generaron documentos.
- Pendientes: estructuras completas de horas extras, incapacidades, vacaciones, licencias, prestaciones y demás conceptos; segundos nombres y apellidos; fechas múltiples de pago y su transmisión. La documentación abreviada no confirma esos campos. Los datos pueden conservarse, pero los documentos con campos o conceptos sin mapeo verificado bloquean su transmisión.
- Los conceptos internos pueden asociarse a una categoría. El backend reconstruye el mapeo desde la versión de parámetros guardada y no confía en un mapeo enviado por el navegador.
- No se implementan PILA, provisiones, liquidación definitiva ni liquidación automática de prestaciones sociales.

Fuentes: [SDK oficial](https://developers.nextpyme.plus/docs/sdk/nodejs), [recursos y colección Postman](https://developers.nextpyme.plus/docs/ai-skills), [paquete oficial](https://www.npmjs.com/package/@nextpyme/sdk).

## Verificación

Se ejecutaron 30 pruebas de frontend, 61 de backend y una prueba de integración con PostgreSQL. Cubren importes, prorrateos, deducciones, factores, fechas, esquemas de transmisión, aislamiento, estados inciertos, rechazo DIAN, prevención de reenvíos y consumo compartido. La prueba con PostgreSQL comprueba el guardado de cargos, empleados, parámetros y borradores y la conservación del historial, revirtiendo todos los registros temporales. Se activa explícitamente con `PAYROLL_TEST_DATABASE_URL` y `PAYROLL_TEST_COMPANY_ID`, usando `src/payroll/payroll-persistence.integration.spec.ts` en el backend. Las consultas de lectura a NextPyme confirmaron cupos y catálogos; falta validar la transmisión con una empresa de pruebas autorizada. No se realizaron envíos DIAN ni se cambiaron ambientes empresariales durante el desarrollo.
