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

/** Suma (o resta, si days es negativo) días a una fecha local YYYY-MM-DD. */
export function addDaysToLocalDate(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00`)

  if (Number.isNaN(base.getTime()) || !Number.isFinite(days)) {
    return date
  }

  base.setDate(base.getDate() + Math.trunc(days))

  return formatLocalDate(base)
}

/** Días completos entre dos fechas locales YYYY-MM-DD (0 si son inválidas). */
export function daysBetweenLocalDates(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0
  }

  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
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
  options?: { allowAnyDate?: boolean },
): Record<string, string> {
  const today = getTodayLocalDate()
  const allowAnyDate = options?.allowAnyDate === true

  return Object.fromEntries(
    documents.map((document) => {
      if (current[document.id]) {
        return [document.id, current[document.id]]
      }

      const importedDate = document.issueDate?.trim()

      if (
        importedDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(importedDate) &&
        (allowAnyDate || isSupportDocumentDateInRange(importedDate))
      ) {
        return [document.id, importedDate]
      }

      return [document.id, today]
    }),
  )
}

export function buildInitialRowObservations(
  documents: Array<{ id: string; observations?: string | null }>,
  current: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] ?? document.observations?.trim() ?? '',
    ]),
  )
}
