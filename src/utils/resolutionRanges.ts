import type { JarvisAvailableResolution } from '../types/jarvis'

export interface ActiveResolutionRange extends JarvisAvailableResolution {
  /** true si hay más de un rango activo para el mismo tipo de documento —
   * puede indicar datos desincronizados en NextPyme/DIAN. */
  hasConflict: boolean
}

export interface DocumentTypeRangeGroup {
  typeDocumentId: number | null
  label: string
  ranges: ActiveResolutionRange[]
  hasConflict: boolean
}

function todayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWithinDateRange(
  item: JarvisAvailableResolution,
  today: string,
): boolean {
  const from = item.dateFrom?.slice(0, 10)
  const to = item.dateTo?.slice(0, 10)

  if (from && today < from) return false
  if (to && today > to) return false

  return true
}

/** Clave estable de agrupación por tipo de documento — prefiere el id
 * numérico (typeDocumentId); si no viene (respuestas viejas de NextPyme sin
 * ese campo), cae al nombre legible para no perder el agrupamiento.
 * Exportada para que la UI pueda construir la pestaña de un tipo de
 * documento aunque no tenga NINGÚN rango activo (ver
 * ResolutionRangesByType), caso que groupByDocumentType no puede cubrir por
 * sí solo — solo agrupa lo que ya está activo. */
export function documentTypeKey(item: JarvisAvailableResolution): string {
  return item.typeDocumentId != null
    ? `id:${item.typeDocumentId}`
    : `label:${item.documentTypeLabel ?? 'sin-tipo'}`
}

/**
 * Rangos "activos": tienen resolución (formNumber, mapea a `resolution` del
 * JSON crudo de NextPyme) y hoy cae dentro de [dateFrom, dateTo] (inclusive,
 * y un extremo ausente no descarta el rango). Si dos o más rangos activos
 * comparten tipo de documento, se marcan con `hasConflict: true` en vez de
 * descartarse silenciosamente — puede ser un dato real (dos resoluciones
 * vigentes a la vez) que el usuario debe revisar, no un error nuestro.
 */
export function getActiveRanges(
  data: JarvisAvailableResolution[],
): ActiveResolutionRange[] {
  const today = todayIsoDate()

  const candidates = data.filter(
    (item) => item.formNumber != null && isWithinDateRange(item, today),
  )

  const countByType = new Map<string, number>()
  for (const item of candidates) {
    const key = documentTypeKey(item)
    countByType.set(key, (countByType.get(key) ?? 0) + 1)
  }

  return candidates.map((item) => ({
    ...item,
    hasConflict: (countByType.get(documentTypeKey(item)) ?? 0) > 1,
  }))
}

/** Agrupa rangos ya activos (ver getActiveRanges) por tipo de documento,
 * usando `documentTypeLabel` como nombre legible de cada grupo. Orden
 * alfabético por nombre, para que la lista de pestañas sea estable entre
 * refrescos. */
export function groupByDocumentType(
  activeRanges: ActiveResolutionRange[],
): DocumentTypeRangeGroup[] {
  const groups = new Map<string, DocumentTypeRangeGroup>()

  for (const range of activeRanges) {
    const key = documentTypeKey(range)
    const label = range.documentTypeLabel?.trim() || 'Sin tipo de documento'
    const existing = groups.get(key)

    if (existing) {
      existing.ranges.push(range)
      existing.hasConflict = existing.hasConflict || range.hasConflict
      continue
    }

    groups.set(key, {
      typeDocumentId: range.typeDocumentId ?? null,
      label,
      ranges: [range],
      hasConflict: range.hasConflict,
    })
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'es'),
  )
}
