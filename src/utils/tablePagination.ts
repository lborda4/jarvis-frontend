/** Regla común de tablas: ocultar paginación para resultados pequeños o de una sola página. */
export function shouldShowTablePagination(
  total: number,
  pageSize = 10,
): boolean {
  return total >= 10 && pageSize > 0 && total > pageSize
}
