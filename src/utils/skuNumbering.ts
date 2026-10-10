import { PRODUCT_KIND, type ProductKind } from '../constants/createProduct'

export interface SkuSequence {
  prefix: string
  nextNumber: number
  digits: number
}

export interface SkuNumbering {
  product: SkuSequence
  service: SkuSequence
}

export const DEFAULT_SKU_NUMBERING: SkuNumbering = {
  product: { prefix: 'PROD', nextNumber: 1, digits: 4 },
  service: { prefix: 'SERV', nextNumber: 1, digits: 4 },
}

export function normalizeSkuSequence(
  sequence: Partial<SkuSequence> | null | undefined,
  fallback: SkuSequence,
): SkuSequence {
  const nextNumber = Number(sequence?.nextNumber)
  const digits = Number(sequence?.digits)
  return {
    prefix: (sequence?.prefix ?? fallback.prefix).trim() || fallback.prefix,
    nextNumber: Number.isFinite(nextNumber) && nextNumber >= 1 ? Math.floor(nextNumber) : fallback.nextNumber,
    digits: Number.isFinite(digits) && digits >= 1 ? Math.min(8, Math.floor(digits)) : fallback.digits,
  }
}

export function normalizeSkuNumbering(value: Partial<SkuNumbering> | null | undefined): SkuNumbering {
  return {
    product: normalizeSkuSequence(value?.product, DEFAULT_SKU_NUMBERING.product),
    service: normalizeSkuSequence(value?.service, DEFAULT_SKU_NUMBERING.service),
  }
}

export function formatSkuSequence(sequence: SkuSequence): string {
  const prefix = sequence.prefix.trim().replace(/[-_\s]+$/, '')
  const digits = Math.max(sequence.digits, String(sequence.nextNumber).length)
  const number = String(sequence.nextNumber).padStart(digits, '0')
  return prefix ? `${prefix}-${number}` : number
}

export function parseSkuSequence(sku: string, fallbackPrefix: string): SkuSequence {
  const match = sku.trim().match(/^(.*?)[-_]?(\d+)$/)
  if (!match?.[2]) {
    return { prefix: fallbackPrefix, nextNumber: 1, digits: 4 }
  }
  return {
    prefix: match[1].replace(/[-_\s]+$/, '') || fallbackPrefix,
    nextNumber: Number(match[2]),
    digits: Math.max(4, match[2].length),
  }
}

export function incrementSkuSequence(sequence: SkuSequence): SkuSequence {
  return { ...sequence, nextNumber: sequence.nextNumber + 1 }
}

export function skuSequenceForKind(numbering: SkuNumbering, kind: ProductKind): SkuSequence {
  return kind === PRODUCT_KIND.SERVICE ? numbering.service : numbering.product
}
