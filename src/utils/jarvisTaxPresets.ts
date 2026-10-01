export const JARVIS_TAX_RATES: Record<string, readonly number[]> = {
  INC: [4, 8, 16],
  ReteIVA: [15, 100],
  Retefuente: [1, 2, 2.5, 3.5, 4, 6, 10, 11],
  ReteICA: [4.14, 6.9, 7, 8, 9.66, 11.04, 13.8, 14],
  IVA: [0, 5, 19],
}

export function normalizeJarvisTaxType(value: string): string {
  const type = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return type === 'retefuente' ? 'reterenta' : type
}

export function taxPresetRates(type: string): readonly number[] {
  return Object.entries(JARVIS_TAX_RATES).find(([name]) => normalizeJarvisTaxType(name) === normalizeJarvisTaxType(type))?.[1] ?? []
}

export function taxPresetLabel(type: string, rate: number): string {
  const isIca = normalizeJarvisTaxType(type) === 'reteica'
  const formatted = rate.toLocaleString('es-CO', { minimumFractionDigits: isIca ? 2 : 0, maximumFractionDigits: 4 })
  return `${type} | ${formatted}${isIca ? ' x 1.000' : '%'}`
}
