import type { JarvisTax } from '../types/jarvis'
export function jarvisTaxTechnical(tax: Pick<JarvisTax, 'tax_type' | 'rate' | 'code'>) {
 const type = tax.tax_type.trim().toLowerCase()
 const divisor = type === 'reteica' ? 1000 : 100
 const note = type === 'reteiva' ? 'Sobre el valor del IVA, no sobre el subtotal'
   : type === 'reteica' ? 'Sobre la base sujeta a ReteICA'
   : type.startsWith('rete') ? 'Sobre la base sujeta a retención'
   : tax.code === '103' ? 'Operación exenta' : tax.code === '104' ? 'Operación excluida'
   : tax.code === '105' ? 'Operación no gravada' : 'Sobre la base gravable'
 return { divisor, unit: divisor === 1000 ? 'x 1.000' : '%', note, factor: tax.rate == null ? null : tax.rate / divisor }
}
export function calculateJarvisRetention(type: string, rate: number, base: number, iva: number): number {
 const normalized = type.trim().toLowerCase()
 return Math.round(((normalized === 'reteiva' ? iva : base) * rate / (normalized === 'reteica' ? 1000 : 100) + Number.EPSILON) * 100) / 100
}
