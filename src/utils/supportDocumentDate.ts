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

function parseUtcDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const yearNumber = Number(year)

  // Date.UTC (y el constructor de Date) interpreta años de 0-99 como
  // "1900 + año" — un año realmente chico (ej. "0001", visto en un
  // payment_due_date placeholder que trae NextPyme para facturas sin
  // vencimiento real) se convertiría silenciosamente en 1901 en vez de
  // fallar, dando un Plazo calculado sin sentido (caso real: -45744 días).
  // El backend ya filtra esto en el origen, pero se rechaza también acá
  // por las dudas de que llegue algún otro dato igual de inválido.
  if (yearNumber < 1900) {
    return null
  }

  return Date.UTC(yearNumber, Number(month) - 1, Number(day))
}

/** Días completos entre dos fechas YYYY-MM-DD, parseadas en UTC explícito
 * (a diferencia de `daysBetweenLocalDates`, que parsea en horario local) —
 * evita que el resultado se corra un día por el huso horario del navegador
 * o un cambio de horario de verano entre las dos fechas. Null si alguna
 * fecha es inválida. */
function daysBetweenUtcDates(fromDate: string, toDate: string): number | null {
  const from = parseUtcDate(fromDate)
  const to = parseUtcDate(toDate)

  if (from === null || to === null) {
    return null
  }

  return Math.round((to - from) / 86_400_000)
}

/** Plazo (días de crédito) de una factura: un dato FIJO del documento, NUNCA
 * se deriva de la fecha actual del sistema (Date.now()/new Date()) — el
 * mismo documento debe mostrar siempre el mismo Plazo sin importar qué día
 * se abra el formulario.
 * 1. Si el emisor mandó `duration_measure > 0` en payment_form, es la
 *    fuente más confiable — se usa directo.
 * 2. Si no, se deriva de payment_due_date - issueDate (ambas fechas fijas
 *    del documento, parseadas en UTC).
 * 3. Si falta algún dato para calcularlo, null — nunca un número inventado. */
export function resolvePlazoDays(
  issueDate: string | null | undefined,
  paymentDueDate: string | null | undefined,
  durationMeasure: number | null | undefined,
): number | null {
  if (
    typeof durationMeasure === 'number' &&
    Number.isFinite(durationMeasure) &&
    durationMeasure > 0
  ) {
    return Math.trunc(durationMeasure)
  }

  if (!issueDate || !paymentDueDate) {
    return null
  }

  return daysBetweenUtcDates(issueDate, paymentDueDate)
}

/** Solo valida el formato, sin restringir el rango — para Factura de compra,
 * donde la fecha es la de una factura de tercero ya emitida (puede ser de
 * hace meses, no aplica la ventana de 5 días de Documento Soporte). */
export function isValidLocalDateFormat(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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

/** Vencimiento importado (ej. de NextPyme/DIAN) — a diferencia de la fecha
 * del documento, puede ser una fecha futura, así que no se valida contra el
 * rango de fechas seleccionables, solo el formato.
 *
 * `isCreditPaymentMethodByDocumentId` + `resolveFallbackDueDate` (opcionales):
 * cuando el medio de pago resuelto para un documento es a crédito y no vino
 * ningún vencimiento importado ni de un borrador, se completa con la MISMA
 * fecha del documento (la del Excel/importación, resuelta por
 * `resolveFallbackDueDate`) en vez de dejarlo en blanco — pedido explícito:
 * un vencimiento vacío bloqueaba "Enviar" sin que hubiera ningún campo
 * visible en la tabla para completarlo (ver isDocumentReadyToSend). Si no se
 * pasa `resolveFallbackDueDate`, cae a hoy. */
export function buildInitialRowDueDates(
  documents: Array<{
    id: string
    dueDate?: string | null
    draft?: { dueDate?: string | null } | null
  }>,
  current: Record<string, string | null> = {},
  isCreditPaymentMethodByDocumentId?: (documentId: string) => boolean,
  resolveFallbackDueDate?: (documentId: string) => string | null | undefined,
): Record<string, string | null> {
  const today = getTodayLocalDate()

  return Object.fromEntries(
    documents.map((document) => {
      const draftDueDate = document.draft?.dueDate?.trim()
      if (draftDueDate && /^\d{4}-\d{2}-\d{2}$/.test(draftDueDate)) {
        return [document.id, draftDueDate]
      }

      if (current[document.id] !== undefined) {
        return [document.id, current[document.id]]
      }

      const importedDueDate = document.dueDate?.trim()

      if (importedDueDate && /^\d{4}-\d{2}-\d{2}$/.test(importedDueDate)) {
        return [document.id, importedDueDate]
      }

      if (isCreditPaymentMethodByDocumentId?.(document.id)) {
        const fallback = resolveFallbackDueDate?.(document.id)?.trim()

        return [
          document.id,
          fallback && /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : today,
        ]
      }

      return [document.id, null]
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
