export interface XmlImportSummary {
  supplierName: string
  supplierDocument: string
  invoiceNumber: string
  invoiceDate: string
  total: number
}

export interface ParseXmlResponse {
  success?: boolean
  message?: string
  id?: string
  summary?: Partial<XmlImportSummary> | null
}

export function isParseXmlResponse(data: unknown): data is ParseXmlResponse {
  if (typeof data !== 'object' || data === null) return false
  if ('records' in data) return false

  const candidate = data as ParseXmlResponse

  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  )
}

export function normalizeXmlImportSummary(
  summary: Partial<XmlImportSummary>,
): XmlImportSummary {
  return {
    supplierName: summary.supplierName?.trim() ?? '',
    supplierDocument: summary.supplierDocument?.trim() ?? '',
    invoiceNumber: summary.invoiceNumber?.trim() ?? '',
    invoiceDate: summary.invoiceDate?.trim() ?? '',
    total: Number.isFinite(Number(summary.total)) ? Number(summary.total) : 0,
  }
}
