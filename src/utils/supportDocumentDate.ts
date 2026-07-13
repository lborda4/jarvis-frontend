export const SUPPORT_DOCUMENT_MAX_DAYS_BACK = 5

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getTodayLocalDate(): string {
  return formatLocalDate(new Date())
}

export function getMinSelectableSupportDocumentDate(
  daysBack = SUPPORT_DOCUMENT_MAX_DAYS_BACK,
): string {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)

  return formatLocalDate(date)
}

export function isSupportDocumentDateInRange(
  value: string,
  minDate = getMinSelectableSupportDocumentDate(),
  maxDate = getTodayLocalDate(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return value >= minDate && value <= maxDate
}

export function buildInitialRowDates(
  documents: Array<{ id: string; issueDate?: string | null }>,
  current: Record<string, string> = {},
): Record<string, string> {
  const today = getTodayLocalDate()

  return Object.fromEntries(
    documents.map((document) => {
      if (current[document.id]) {
        return [document.id, current[document.id]]
      }

      const importedDate = document.issueDate?.trim()

      if (
        importedDate &&
        isSupportDocumentDateInRange(importedDate)
      ) {
        return [document.id, importedDate]
      }

      return [document.id, today]
    }),
  )
}
