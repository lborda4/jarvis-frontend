export type JarvisPdfDocumentKind =
  | 'ELECTRONIC_INVOICE'
  | 'SUPPORT_DOCUMENT'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'SUPPORT_CREDIT_NOTE'

export function jarvisPdfCopy(kind?: string | null) {
  switch (kind) {
    case 'SUPPORT_DOCUMENT':
      return {
        title: 'Documento Soporte\nElectrónico',
        shortTitle: 'Documento soporte',
        party: 'Proveedor',
        uniqueCode: 'CUDS',
        footer: 'documento soporte electrónico',
        related: 'Documento relacionado',
        listPath: '/documento-soporte',
      }
    case 'CREDIT_NOTE':
      return {
        title: 'Nota Crédito',
        shortTitle: 'Nota crédito',
        party: 'Cliente',
        uniqueCode: 'CUDE',
        footer: 'nota crédito',
        related: 'Factura relacionada',
        listPath: '/nota-credito',
      }
    case 'DEBIT_NOTE':
      return {
        title: 'Nota Débito',
        shortTitle: 'Nota débito',
        party: 'Cliente',
        uniqueCode: 'CUDE',
        footer: 'nota débito',
        related: 'Factura relacionada',
        listPath: '/nota-debito',
      }
    case 'SUPPORT_CREDIT_NOTE':
      return {
        title: 'Nota de Ajuste',
        shortTitle: 'Nota de ajuste',
        party: 'Proveedor',
        uniqueCode: 'CUDS',
        footer: 'nota de ajuste al documento soporte electrónico',
        related: 'Documento relacionado',
        listPath: '/nota-ajuste',
      }
    default:
      return {
        title: 'Factura Electrónica\nde Venta',
        shortTitle: 'Factura',
        party: 'Cliente',
        uniqueCode: 'CUFE',
        footer: 'factura electrónica de venta',
        related: 'Factura relacionada',
        listPath: '/factura-venta',
      }
  }
}

export function jarvisPdfKindFromFlags({
  supportDocument = false,
  creditNote = false,
  debitNote = false,
  adjustmentNote = false,
}: {
  supportDocument?: boolean
  creditNote?: boolean
  debitNote?: boolean
  adjustmentNote?: boolean
} = {}): JarvisPdfDocumentKind {
  if (debitNote) return 'DEBIT_NOTE'
  if (adjustmentNote) return 'SUPPORT_CREDIT_NOTE'
  if (creditNote) return 'CREDIT_NOTE'
  if (supportDocument) return 'SUPPORT_DOCUMENT'
  return 'ELECTRONIC_INVOICE'
}
