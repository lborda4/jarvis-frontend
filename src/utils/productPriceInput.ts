/** Los precios del formulario usan formato colombiano: 1.250,50. */
export function parseProductPrice(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.'))
}
