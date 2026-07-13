export interface SupplierOption {
  nit: string
  name: string
}

export function formatSupplierOptionLabel(supplier: SupplierOption): string {
  return `${supplier.name} (${supplier.nit})`
}
