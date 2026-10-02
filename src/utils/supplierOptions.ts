import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { SupplierOption } from '../types/supplier'

export function uniqueSupplierOptions(options: SupplierOption[]): SupplierOption[] {
  const suppliers = new Map<string, SupplierOption>()
  for (const option of options) {
    const nit = option.nit.trim()
    if (!nit) continue
    const name = option.name?.trim() || nit
    const existing = suppliers.get(nit)
    if (!existing || existing.name === nit) suppliers.set(nit, { nit, name })
  }
  return [...suppliers.values()]
}

export function extractSupplierOptions(
  documents: ElectronicDocumentListItem[],
): SupplierOption[] {
  const suppliers = new Map<string, SupplierOption>()

  for (const document of documents) {
    const nit = document.supplierNit?.trim()

    if (!nit || suppliers.has(nit)) {
      continue
    }

    suppliers.set(nit, {
      nit,
      name: document.supplierName?.trim() || nit,
    })
  }

  return [...suppliers.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'es'),
  )
}

export function mergeSupplierOptions(
  current: SupplierOption[],
  documents: ElectronicDocumentListItem[],
): SupplierOption[] {
  const suppliers = new Map(current.map((supplier) => [supplier.nit, supplier]))

  for (const document of documents) {
    const nit = document.supplierNit?.trim()

    if (!nit || suppliers.has(nit)) {
      continue
    }

    suppliers.set(nit, {
      nit,
      name: document.supplierName?.trim() || nit,
    })
  }

  return [...suppliers.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'es'),
  )
}

export function filterDocumentsBySupplier(
  documents: ElectronicDocumentListItem[],
  supplier: SupplierOption | null,
): ElectronicDocumentListItem[] {
  if (!supplier) {
    return documents
  }

  return documents.filter((document) => document.supplierNit?.trim() === supplier.nit)
}
