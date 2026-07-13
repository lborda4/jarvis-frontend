export interface DianParty {
  nit: string
  nombre: string
}

export interface DianInvoiceItem {
  descripcion: string
  cantidad: number
  valorUnitario: number
  total: number
}

export interface DianInvoiceTotals {
  subtotal: number
  total: number
  iva: number
}

export interface DianInvoiceResult {
  cufe: string
  numeroFactura: string
  fechaEmision: string
  moneda: string
  emisor: DianParty
  receptor: DianParty
  items: DianInvoiceItem[]
  totales: DianInvoiceTotals
}

export interface DianSearchError {
  cufe: string
  mensaje: string
}

export interface SearchDianRequest {
  cufes: string[]
}

export interface SearchDianResponse {
  totalProcesados: number
  totalExitosos: number
  totalFallidos: number
  resultados: DianInvoiceResult[]
  errores: DianSearchError[]
}
