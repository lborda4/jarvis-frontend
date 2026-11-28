# Panel del asesor y comisiones

El asesor puede crear empresas Siigo o Jarvis con el mismo `CreateCompanyForm` del administrador. El servidor asigna la empresa al asesor autenticado y fija el nombre del comercial. No crea un vínculo operativo `UserCompany` para el asesor: el cliente recibe su propio enlace de registro y el asesor continúa en su panel comercial.

El panel muestra sus clientes y comisiones mensuales. Los endpoints `/advisor/*` exigen una cuenta de asesor registrada y activa; el asesor no puede elegir el ID de otro asesor ni acceder a administración. La cartera comercial no concede acceso operativo a sus clientes.

Si el asesor también tiene empresas vinculadas mediante `UserCompany`, el panel muestra **Mi empresa → Ir a la aplicación**. Puede operar esas empresas como un usuario normal y regresar desde **Panel comercial** en el menú de la aplicación. Inicia sesión en el panel comercial; al seleccionar una empresa se verifica su vínculo y se conserva el rol de asesor. El token de empresa y su renovación vuelven a comprobar ese vínculo. Los catálogos de integración se cargan únicamente dentro de la aplicación, no desde el panel comercial.

En **Administración → Asesores → Convertir a comercial**, el administrador busca una cuenta existente por correo y confirma la conversión. Se conserva la contraseña y se crea o reutiliza su perfil comercial sin borrar clientes, comisiones ni vínculos anteriores. El usuario debe volver a iniciar sesión. La conversión no envía correos, no activa cuentas inactivas ni cambia cuentas de administrador. Crear un asesor nuevo continúa siendo un flujo separado con invitación.

## Reglas comerciales confirmadas

- Básica: 10 % en venta inicial y 5 % en renovación del plan.
- Plus: 15 % en venta inicial y 7,5 % en renovación del plan.
- Pro: 20 % en venta inicial y 10 % en renovación del plan.
- Las recargas son compras nuevas de su propio producto y usan su clase; no heredan la del plan ni se tratan como renovaciones.
- Se incluyen planes y recargas. Se reconoce la comisión al registrar el pago, en el mes calendario de Colombia (`America/Bogota`), no al crear la empresa.

En **Administración → Planes → Editar** se guarda la clase del plan. Los precios Jarvis provienen de `commercial_terms`, cargados del portafolio, y Siigo permite guardar su precio de venta. El asesor no envía precios, porcentajes, fechas de pago ni su asignación; todos se resuelven en el servidor.

La nueva regla por clase sustituye, para las nuevas ventas, el uso de una comisión personalizada por asesor. Los valores anteriores de los perfiles se conservan en la base de datos, pero no intervienen en este cálculo.

## Catálogo del Excel JENIUS

Fuente actual: `Modelo_costos_punto_equilibrio_JENIUS_actualizado.xlsx`, hoja **Productos**, columnas A (clase), B (producto), E (precio por venta) y tabla M2:P4 (tasas iniciales y renovación). El resumen de costos no cambia la duración anual Jarvis definida por el usuario. No se ejecutan las instrucciones de uso ni las fórmulas del documento como código.

| Producto | Clase | Precio COP |
| --- | --- | ---: |
| Facturación electrónica, inicial o regular | Básica | 139.900 |
| Nómina electrónica | Básica | 129.900 |
| Combo facturación y nómina | Pro | 230.000 |
| Combo ilimitado | Pro | 720.000 |
| Recargas 10 / 25 / 50 / 100 documentos | Plus | 25.000 / 45.000 / 80.000 / 149.900 |
| Recargas 250 / 500 documentos | Pro | 300.000 / 480.000 |
| Recargas 1 a 10 empleados | Plus | Precios de las filas 14 a 23 |
| Recargas 11 / 15 / 20 / 30 empleados | Pro | 175.000 / 225.000 / 290.000 / 405.000 |
| Causación automática Siigo | Plus | 400.000 por mes |

Las clases de los cinco planes Jarvis se cargan por código estable. Las recargas usan `TOP_UP_COMMISSION_BASIS=PRODUCT` y la clase propia del código de catálogo. El precio actualizado de la recarga 100 es 149.900; las compras históricas conservan su precio anterior. La copia verificable de los datos comerciales está en `artifacts/jenius-commission-catalog.json`; las pruebas contrastan clases, precios y el ejemplo del Excel (1.951.550 COP de comisión).

Por indicación expresa del usuario, **Causación automática Siigo queda en standby**. Se conserva su referencia de 400.000 COP mensuales y clase Plus, pero no se crea ni activa el plan y no se asigna un cupo. El Excel no especifica su capacidad. Los planes Siigo existentes se conservan; no reciben este precio por suposición. Los planes sin precio o clase pueden configurarse en administración y no se venden desde el asesor mientras les falte esa información.

## Ventas y pagos

`advisor_sales` conserva una copia de la empresa, el asesor, producto, precio, clase, porcentaje y comisión por venta. Las ventas iniciales, recargas y nuevas asignaciones de plan quedan pendientes. La clase o el precio posteriores y una reasignación de asesor no cambian esas ventas. Las recargas se registran con su intento durable; solo las confirmadas como `APPLIED` pueden registrar pago.

El administrador registra el pago desde **Asesor → Comisiones mensuales** o desde **Cliente → Pagos → Ventas pendientes de pago**. Esto reconoce la comisión y agrega el pago al historial, sin renovar ni volver a habilitar documentos. Repetir el mismo registro no duplica la comisión ni cambia el mes original. La renovación del seguimiento sigue siendo una operación distinta: genera y registra la venta del nuevo período pagado.

Los informes mensuales suman ventas y comisiones pagadas y presentan los pendientes aparte. No se reconstruyen comisiones históricas desde empresas asignadas, saldos o recargas sin un registro de venta. No se ejecutan cobros ni transferencias al asesor.

## Activación y validación

Aplicar `1795900000000-AddAdvisorSales` después de `1795800000000-AddAdvisors` y luego `1796000000000-SeedJeniusCommissionCatalog`. La última migra las tasas a decimales para 7,5 %, distingue ventas iniciales y renovaciones, y carga la clasificación Jarvis del Excel. No modifica comisiones anteriores, períodos de suscripción ni compras guardadas.

Las pruebas emplean datos, repositorios y correo simulados. No se han ejecutado migraciones, enviado invitaciones reales, realizado pagos reales ni comprado documentos NextPyme durante estas verificaciones.
