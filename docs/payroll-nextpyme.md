# Revisión de rechazos del emisor en nómina NextPyme

Revisión del contrato público de NextPyme: 15 de noviembre de 2026.

## Qué significan estos rechazos

| Regla | Datos por revisar | Dónde se corrigen |
| --- | --- | --- |
| NIE017 | NIT del propietario del software que figura en el XML, sin DV ni separadores, y su registro ante DIAN. No es necesariamente el NIT del empleador. | Configuración del software en NextPyme y registro DIAN. |
| 92 | Habilitación del emisor para nómina, asociación del software y ambiente utilizado. Estar habilitado para facturar no confirma habilitación para nómina. | DIAN y configuración de nómina en NextPyme. |
| NIE033 | NIT del empleador y correspondencia entre la empresa local y el token de NextPyme. | Datos de la empresa en NextPyme; revisar el token asignado en administración. |
| NIE020 | ID y PIN del software específico de nómina y correspondencia con DIAN. NextPyme genera el Software Security Code del XML. | Configuración del software de nómina en NextPyme. |

`Documento con errores en campos mandatorios` es un resumen. Hay que conservar los rechazos específicos y revisar el XML si no se detalla qué campo falta.

`AttachedDocument #NI5 generada con éxito` confirma la creación del adjunto. No demuestra aceptación DIAN y no debe contarse como un rechazo ni convertir el estado a aceptado.

## Comprobación incorporada al envío

Antes de consultar cupo, reservar consecutivo o llamar a `POST /api/ubl2.1/payroll`, el backend:

1. Lee `GET /api/ubl2.1/config/company` con el token de la empresa.
2. Compara `data.identification_number` con el NIT local. Para la comparación local se admiten puntos y un DV separado por guion; el NIT remoto debe contener únicamente el número base. No se elimina a ciegas el último dígito de un NIT sin separador.
3. Comprueba que exista `data.payroll_type_environment_id` con valor 1 o 2.
4. Comprueba la presencia de `data.software.identifier_payroll` y `data.software.pin_payroll`.

La lectura devuelve únicamente NIT, ambiente y dos indicadores de presencia. No devuelve ni registra PIN, identificador de software, datos SMTP o el cuerpo de configuración.

La comprobación no certifica que el PIN sea correcto, que la DIAN haya habilitado al emisor o que el propietario del software sea el correcto. Esos puntos requieren contrastar el registro real de NextPyme con DIAN. Los rechazos siguen determinando el resultado del envío.

## Qué falta comprobar por empresa

- Que el token corresponda al empleador correcto y su NIT esté registrado en NextPyme sin DV ni separadores.
- Que el propietario del software coincida con el registro DIAN que se usa para generar el XML.
- Que el ID y PIN guardados correspondan a **nómina**, no solo al software de facturación.
- Que el emisor haya completado la habilitación de nómina y tenga asociado ese software en el ambiente utilizado.
- Que el certificado digital esté vigente y configurado para el emisor.

El código de administración actual configura producción de facturación mediante `type_environment_id`. Ese campo no configura por sí solo el ambiente de nómina. NextPyme documenta `payroll_type_environment_id` para nómina: 1 producción, 2 pruebas. Esta revisión no cambia ambientes remotos automáticamente ni presume que todas las empresas deban pasar a producción.

La documentación de utilidades muestra `PUT /config/software` con `id` y `pin`, pero su ejemplo no detalla cómo seleccionar exclusivamente el software de nómina. Antes de automatizar esa escritura se debe confirmar el contrato específico con NextPyme, para no sobrescribir las credenciales de facturación. El ID y PIN reales no se deben inventar ni pedir por un canal público.

## Alcance de la revisión del body

El envío existente usa el endpoint de nómina y el token por empresa. No agrega NIT del empleador ni Software Security Code al bloque `worker`: ese bloque identifica al empleado. Los datos del emisor y del software proceden de la configuración del proveedor.

Los ejemplos abreviados de los SDK públicos difieren del contrato REST que ha validado los cuerpos actuales (por ejemplo, nombres de algunos campos y forma de devengados). Esta revisión no cambia esos campos basándose únicamente en el ejemplo del SDK. Para los rechazos citados hay que revisar los datos del emisor y software en el XML generado, no sustituir el esquema de novedades que ya pasó la validación HTTP.

No se consultaron configuraciones reales de empresas ni se hicieron emisiones, cambios de ambiente o escrituras en DIAN/NextPyme durante esta revisión. Las pruebas usan respuestas simuladas.

## Comparación con el body de referencia

El body compartido se comparó con el serializador y con la llamada real de envío del backend. Se añadieron `date` y `time` en la raíz, `worker.worker_code` y el correo registrado del empleado (`worker.email`, cuando existe). `date` conserva la fecha de emisión del documento y `time` se calcula en hora de Colombia. No se copian las fechas ni los valores ficticios del ejemplo.

| Bloque | Comprobación antes de enviar |
| --- | --- |
| Raíz | Tipo de documento, fecha, hora, prefijo, consecutivo, novedad, código del empleado y período de nómina. |
| `period` | Ingreso, inicio y fin de liquidación, tiempo laborado y fecha de emisión. |
| `worker` | Identificación, nombres principales, ciudad, dirección, contrato, tipos de trabajador y documento, salario, indicadores y código. El correo se transmite cuando está registrado y se valida su formato. Los segundos nombres y apellidos pueden faltar. |
| `payment` | Método seleccionado del catálogo. Para el ID 30 se exigen banco, tipo y número de cuenta. Efectivo no envía datos bancarios. |
| `payment_dates` | Al menos una fecha de pago válida. |
| `accrued` | Días liquidados, salario del período y total de ingresos; auxilio y otras novedades según lo registrado. |
| `deductions` | Salud y pensión con valor explícito, incluido cero cuando corresponde, y total de deducciones. Los fondos opcionales se envían junto con su tipo cuando hay un valor registrado. |

Se conservan los tipos solicitados: salud **4**, pensión **6**, solidaridad **9** y subsistencia **9**. No se sustituyen por los códigos ilustrativos del ejemplo. Los importes se serializan como cadenas decimales para conservar centavos sin redondeo binario; los IDs y días son números.

`period.worked_time` representa la antigüedad acumulada con base 30/360 desde el ingreso, mientras que `accrued.worked_days` representa los días liquidados del período. Con ingreso el 1 de enero de 2024 y cierre el 31 de enero de 2026, el cálculo existente produce 750 y 30, respectivamente; no se reemplaza la antigüedad por el 30 ilustrativo del ejemplo.

La comprobación se ejecuta sobre el JSON final, antes de guardar la solicitud de transmisión, marcarla en proceso o consumir el consecutivo. Un obligatorio ausente devuelve su ruta exacta, por ejemplo `worker.municipality_id`, en lugar de depender de un HTTP 422 genérico. Esto comprueba la preparación del cuerpo; la aceptación definitiva corresponde a NextPyme/DIAN y la habilitación sigue pendiente.

## Referencias técnicas

- [Utilidades y configuración REST de NextPyme](https://developers.nextpyme.plus/docs/utilities): ejemplos de `config/company`, `config/environment` y `config/software`.
- [SDK oficial de NextPyme](https://developers.nextpyme.plus/docs/sdk/php): separación del ambiente de nómina y servicios disponibles.
- [Resolución DIAN 000013 de 2021 y anexo técnico](https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000013%20de%2011-02-2021.pdf): significado de las reglas NIE017, NIE020 y NIE033.
