import type {
  ExtractInvoicesResponse,
  InvoiceFilters,
  InvoicePreview,
} from '../types/invoice'
import type { ParseXmlResponse } from '../types/xmlInvoice'
import { isParseXmlResponse, normalizeXmlImportSummary } from '../types/xmlInvoice'
import { mapXmlSummaryToInvoicePreview } from './mapXmlSummaryToPreview'

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeInvoicePreview(
  record: Partial<InvoicePreview> | null | undefined,
  index: number,
): InvoicePreview {
  const cufe = normalizeString(record?.cufe)

  return {
    cufe: cufe || `record-${index}`,
    documentType: normalizeString(record?.documentType),
    folio: normalizeString(record?.folio),
    prefix: normalizeString(record?.prefix),
    issueDate: normalizeString(record?.issueDate),
    receptionDate: normalizeString(record?.receptionDate),
    issuerNit: normalizeString(record?.issuerNit),
    issuerName: normalizeString(record?.issuerName),
    receiverNit: normalizeString(record?.receiverNit),
    receiverName: normalizeString(record?.receiverName),
    currency: normalizeString(record?.currency) || 'COP',
    paymentMethod: normalizeString(record?.paymentMethod),
    total: normalizeNumber(record?.total),
    status: normalizeString(record?.status),
    group: normalizeString(record?.group),
  }
}

function normalizeFilters(
  filters: Partial<InvoiceFilters> | null | undefined,
): InvoiceFilters {
  return {
    documentTypes: normalizeStringArray(filters?.documentTypes),
    statuses: normalizeStringArray(filters?.statuses),
  }
}

function buildFiltersFromRecords(records: InvoicePreview[]): InvoiceFilters {
  return {
    documentTypes: [
      ...new Set(records.map((record) => record.documentType).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'es')),
    statuses: [
      ...new Set(records.map((record) => record.status).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'es')),
  }
}

export function normalizeExtractInvoicesResponse(
  data: Partial<ExtractInvoicesResponse> | null | undefined,
): ExtractInvoicesResponse | null {
  if (!data) return null

  const records = Array.isArray(data.records)
    ? data.records.map((record, index) => normalizeInvoicePreview(record, index))
    : []

  const total =
    typeof data.total === 'number' && Number.isFinite(data.total)
      ? data.total
      : records.length

  const normalizedFilters = normalizeFilters(data.filters)
  const filters =
    normalizedFilters.documentTypes.length > 0 ||
    normalizedFilters.statuses.length > 0
      ? normalizedFilters
      : buildFiltersFromRecords(records)

  return {
    total,
    filters,
    records,
  }
}

export function mapXmlParseResponseToExtractInvoices(
  response: ParseXmlResponse,
): ExtractInvoicesResponse | null {
  if (!response.summary || !response.id) return null

  const documentId = response.id.trim()
  const summary = normalizeXmlImportSummary(response.summary)
  const record = normalizeInvoicePreview(
    mapXmlSummaryToInvoicePreview(summary, documentId),
    0,
  )

  return normalizeExtractInvoicesResponse({
    total: 1,
    records: [record],
  })
}

export function adaptToExtractInvoicesResponse(
  data: unknown,
): ExtractInvoicesResponse | null {
  if (!data) return null

  if (isParseXmlResponse(data)) {
    return mapXmlParseResponseToExtractInvoices(data)
  }

  return normalizeExtractInvoicesResponse(
    data as Partial<ExtractInvoicesResponse>,
  )
}

export function getDocumentTypeOptions(
  data: ExtractInvoicesResponse | null | undefined,
  rows: Pick<InvoicePreview, 'documentType'>[],
): string[] {
  const fromFilters = data?.filters?.documentTypes

  if (Array.isArray(fromFilters) && fromFilters.length > 0) {
    return fromFilters
  }

  return [...new Set(rows.map((row) => row.documentType).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  )
}
