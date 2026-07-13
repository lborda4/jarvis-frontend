import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { CreateSiigoSupportDocumentRequest } from '../types/siigo'

type SupportDocumentItem = CreateSiigoSupportDocumentRequest['items'][number]

function normalizeTaxType(value?: string): string {
  return (value?.trim() ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isRetentionTaxType(type?: string): boolean {
  const normalized = normalizeTaxType(type)

  return (
    normalized.includes('rete') ||
    normalized.includes('autorreten') ||
    normalized.includes('autorretencion')
  )
}

function calculateLineBreakdown(
  item: SupportDocumentItem,
  taxesById: Map<number, SiigoTaxOption>,
): { baseValue: number; taxTotal: number; lineTotal: number } {
  const lineGross = roundMoney(item.quantity * item.price)
  const discount =
    item.discount !== undefined && item.discount > 0 ? roundMoney(item.discount) : 0
  const baseValue = roundMoney(lineGross - discount)
  let taxTotal = 0

  for (const taxRef of item.taxes ?? []) {
    const taxDefinition = taxesById.get(taxRef.id)

    if (
      !taxDefinition ||
      !Number.isFinite(taxDefinition.percentage) ||
      taxDefinition.percentage <= 0 ||
      isRetentionTaxType(taxDefinition.type)
    ) {
      continue
    }

    taxTotal = roundMoney(
      taxTotal + roundMoney((baseValue * taxDefinition.percentage) / 100),
    )
  }

  return {
    baseValue,
    taxTotal,
    lineTotal: roundMoney(baseValue + taxTotal),
  }
}

function resolveRetentionBase(
  retentionType: string | undefined,
  subtotal: number,
  taxTotal: number,
): number {
  const normalized = normalizeTaxType(retentionType)

  if (normalized === 'reteiva') {
    return taxTotal
  }

  return subtotal
}

function calculateRetentionAmount(
  retentionType: string | undefined,
  percentage: number,
  base: number,
): number {
  const normalized = normalizeTaxType(retentionType)

  if (normalized === 'reteica') {
    return roundMoney((base * percentage) / 1000)
  }

  return roundMoney((base * percentage) / 100)
}

function calculateRetentionTotal(
  items: SupportDocumentItem[],
  retentions: SiigoTaxOption[],
  taxesById: Map<number, SiigoTaxOption>,
): number {
  if (!retentions.length) {
    return 0
  }

  let subtotal = 0
  let taxTotal = 0

  for (const item of items) {
    const breakdown = calculateLineBreakdown(item, taxesById)
    subtotal = roundMoney(subtotal + breakdown.baseValue)
    taxTotal = roundMoney(taxTotal + breakdown.taxTotal)
  }

  return retentions.reduce((sum, retention) => {
    if (
      !Number.isFinite(retention.percentage) ||
      retention.percentage <= 0 ||
      !isRetentionTaxType(retention.type)
    ) {
      return sum
    }

    const base = resolveRetentionBase(retention.type, subtotal, taxTotal)

    return roundMoney(
      sum +
        calculateRetentionAmount(
          retention.type,
          retention.percentage,
          base,
        ),
    )
  }, 0)
}

export function calculateSiigoSupportDocumentPaymentValue(
  items: SupportDocumentItem[],
  taxesCatalog: SiigoTaxOption[] = [],
  retentions: SiigoTaxOption[] = [],
): number {
  const taxesById = new Map(taxesCatalog.map((tax) => [tax.id, tax]))
  const itemsTotal = roundMoney(
    items.reduce(
      (sum, item) => sum + calculateLineBreakdown(item, taxesById).lineTotal,
      0,
    ),
  )
  const retentionTotal = calculateRetentionTotal(items, retentions, taxesById)

  return roundMoney(itemsTotal - retentionTotal)
}
