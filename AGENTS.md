# Reglas generales de la interfaz

## Tablas y paginación

- Con menos de 10 registros, no mostrar controles de paginación: números de página, flechas de navegación ni selector de filas por página. Esto incluye tablas vacías y resultados filtrados.
- Tampoco mostrar paginación si todos los registros caben en una sola página.
- Usar el total de registros del resultado filtrado o el total informado por el servidor, nunca la cantidad de filas de la página actual.
- Reutilizar `shouldShowTablePagination` de `src/utils/tablePagination.ts` en las tablas nuevas y modificadas.
- Al ocultar la paginación, mantener accesibles todos los registros y corregir la página actual si los filtros o la eliminación de registros la dejan fuera de rango. Se puede conservar un resumen del total cuando sea útil.
- Esta regla aplica a tablas de todos los módulos; la navegación de páginas de un PDF no es paginación de tabla.
