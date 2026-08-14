export const ELECTRONIC_DOCUMENT_PAGE_SIZE_OPTIONS = [10, 50, 100] as const

export type ElectronicDocumentPageSize =
  (typeof ELECTRONIC_DOCUMENT_PAGE_SIZE_OPTIONS)[number]

export const DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE = 10

/** @deprecated Use DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE */
export const ELECTRONIC_DOCUMENTS_PAGE_SIZE = DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE

export function normalizeElectronicDocumentPageLimit(
  value?: number | string | null,
): ElectronicDocumentPageSize {
  const parsed = Number.parseInt(String(value ?? ''), 10)

  if (
    ELECTRONIC_DOCUMENT_PAGE_SIZE_OPTIONS.includes(
      parsed as ElectronicDocumentPageSize,
    )
  ) {
    return parsed as ElectronicDocumentPageSize
  }

  return DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE
}

const PAGE_LIMIT_STORAGE_KEY = 'jarvis_electronic_document_page_limit'

/** Recuerda la preferencia de "Filas por página" entre recargas/sesiones —
 * antes se perdía (volvía al valor por defecto) cada vez que se recargaba
 * la página o el navegador. */
export function getStoredElectronicDocumentPageLimit(): ElectronicDocumentPageSize {
  try {
    return normalizeElectronicDocumentPageLimit(
      window.localStorage.getItem(PAGE_LIMIT_STORAGE_KEY),
    )
  } catch {
    return DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE
  }
}

export function setStoredElectronicDocumentPageLimit(
  limit: ElectronicDocumentPageSize,
): void {
  try {
    window.localStorage.setItem(PAGE_LIMIT_STORAGE_KEY, String(limit))
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.) — no es crítico.
  }
}

export function pickSmallestPageSizeCovering(
  count: number,
): ElectronicDocumentPageSize {
  if (count <= 10) {
    return 10
  }

  if (count <= 50) {
    return 50
  }

  return 100
}
