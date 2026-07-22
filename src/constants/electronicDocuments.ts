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
