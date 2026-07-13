import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { formatDate } from './formatters'

export function formatIssueDate(date: string | null | undefined): string | null {
  const normalizedDate = date?.trim()

  if (!normalizedDate) {
    return null
  }

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedDate)

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).toLocaleDateString('es-CO')
  }

  return formatDate(normalizedDate)
}

export function getDocumentDisplayDate(
  document: Pick<ElectronicDocumentListItem, 'issueDate' | 'createdAt'>,
): string {
  return formatIssueDate(document.issueDate) ?? formatDate(document.createdAt)
}

export function getDocumentSupplierName(
  document: Pick<ElectronicDocumentListItem, 'supplierName'>,
): string {
  return document.supplierName?.trim() || '—'
}

export function getDocumentInvoiceNumber(
  document: Pick<ElectronicDocumentListItem, 'invoiceNumber' | 'id'>,
): string {
  if (document.invoiceNumber?.trim()) {
    return document.invoiceNumber.trim()
  }

  return `DS-${document.id.slice(0, 8).toUpperCase()}`
}
