# Reglas generales de la interfaz

## Tema visual de Jarvis

- Antes de crear o modificar un componente, consultar `src/styles/theme.css`: es la fuente única de colores, tipografías, tamaños, pesos, radios y sombras de la interfaz.
- Usar las variables del tema. No añadir colores hexadecimales, RGB/HSL, familias tipográficas, tamaños de letra, pesos, sombras ni radios propios en los componentes. Si falta un estilo reutilizable, definir un token semántico en ese archivo.
- La interfaz utiliza `--font-family-base`. Reservar `--font-family-mono` para códigos o datos técnicos. Los títulos usan `--font-weight-heading`; el texto, `--font-weight-normal`; las etiquetas y botones tienen sus respectivos tokens.
- Título de página: `--text-h1`; título de sección: `--text-2xl`; subtítulo: `--text-xl`; contenido: `--text-md`; etiqueta/ayuda: `--text-sm`; detalle secundario: `--text-xs`. Reservar `--text-display`, `--text-price` y sus variantes para la landing.
- Usar `--jarvis-primary` para acciones; `--jarvis-navy` para títulos y superficies de marca; `--jarvis-accent` para acentos sobre fondos oscuros; y los tokens `success`, `warning`, `danger` e `info` para estados. No intercambiar sus significados.
- Reutilizar `Button`, `Modal`, `PageHeader` y los estilos de `src/styles/integration.css` antes de crear una nueva variante.
- Las reglas de disposición (anchos, rejillas, responsive y espaciado específico) permanecen en el CSS del componente. Las imágenes de marcas, PDF y correos tienen requisitos de representación propios; no aplicarles variables CSS que su motor no soporte.
- Ejecutar `npm run check:theme` al cambiar estilos. Esta comprobación también forma parte del build y rechaza estilos fuera del tema en CSS y colores/fuentes propios en componentes de interfaz.

## Cierre de modales

- Los modales no se cierran al hacer clic o tocar fuera de su contenido ni al pulsar Escape.
- Usar la X para el cierre manual y respetar los bloqueos de cierre durante operaciones en curso (`busy`) o cuando `dismissible` sea `false`.
- Reutilizar `src/components/Modal.tsx` en los modales nuevos para aplicar esta regla por defecto. Los contenedores personalizados, como el de nómina, también deben cumplirla.

## Tablas y paginación

- Con menos de 10 registros, no mostrar controles de paginación: números de página, flechas de navegación ni selector de filas por página. Esto incluye tablas vacías y resultados filtrados.
- Tampoco mostrar paginación si todos los registros caben en una sola página.
- Usar el total de registros del resultado filtrado o el total informado por el servidor, nunca la cantidad de filas de la página actual.
- Reutilizar `shouldShowTablePagination` de `src/utils/tablePagination.ts` en las tablas nuevas y modificadas.
- Al ocultar la paginación, mantener accesibles todos los registros y corregir la página actual si los filtros o la eliminación de registros la dejan fuera de rango. Se puede conservar un resumen del total cuando sea útil.
- Esta regla aplica a tablas de todos los módulos; la navegación de páginas de un PDF no es paginación de tabla.
