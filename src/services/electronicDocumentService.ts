import type {
  ElectronicDocumentDraftItem,
  ElectronicDocumentFilterOptions,
  ElectronicDocumentListFilters,
  ElectronicDocumentListResponse,
  ResumeElectronicDocumentResponse,
} from '../types/electronicDocument'
import { apiClient } from './apiClient'
import {
  cachedQuery,
  companyQueryKey,
  invalidateQueryCache,
  peekCachedQuery,
  QUERY_STALE_MS,
  setCachedQuery,
} from './queryCache'

const ELECTRONIC_DOCUMENTS_ENDPOINT = '/electronic-documents'
const ELECTRONIC_DOCUMENT_FILTER_OPTIONS_ENDPOINT =
  '/electronic-documents/filter-options'
const SIIGO_RESUME_DOCUMENT_ENDPOINT = '/integrations/siigo/documents/resume'
const SIIGO_RESUME_DOCUMENTS_BATCH_ENDPOINT =
  '/integrations/siigo/documents/resume-batch'
const JARVIS_RESUME_DOCUMENT_ENDPOINT = '/integrations/jarvis/documents/resume'

function documentsCacheKey(
  filters: Partial<ElectronicDocumentListFilters>,
): string {
  return companyQueryKey([
    'electronic-documents',
    filters.electronicDocumentType ?? '',
    filters.page ?? 1,
    filters.limit ?? '',
    filters.status ?? '',
    filters.dateFrom ?? '',
    filters.dateTo ?? '',
    filters.search ?? '',
    (filters.supplierNits ?? []).join(','),
    (filters.issueDates ?? []).join(','),
    filters.issueDateFrom ?? '',
    filters.issueDateTo ?? '',
    (filters.siigoDocumentNumbers ?? []).join(','),
    (filters.importStatuses ?? []).join(','),
  ])
}

export async function fetchElectronicDocuments(
  filters: Partial<ElectronicDocumentListFilters> = {},
  options?: {
    /** Ignora la caché de 10 minutos y siempre pega contra el server —
     * necesario para watchImportedDocuments: sondea con la MISMA clave de
     * filtros en cada intento (mismo page/tipo), así que sin esto cada
     * intento del polling devolvía la respuesta cacheada del primero en vez
     * de reflejar lo que el backend ya validó, y el aviso de "tardando más
     * de lo esperado" salía aunque el server ya hubiera terminado. */
    force?: boolean
  },
): Promise<ElectronicDocumentListResponse> {
  const key = documentsCacheKey(filters)

  return cachedQuery(
    key,
    QUERY_STALE_MS.documents,
    async () => {
      const response = await apiClient.get<ElectronicDocumentListResponse>(
        ELECTRONIC_DOCUMENTS_ENDPOINT,
        {
          params: {
            status: filters.status || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
            search: filters.search || undefined,
            electronicDocumentType:
              filters.electronicDocumentType || undefined,
            page: filters.page || undefined,
            limit: filters.limit || undefined,
            supplierNits:
              filters.supplierNits && filters.supplierNits.length > 0
                ? filters.supplierNits.join(',')
                : undefined,
            issueDates:
              filters.issueDates && filters.issueDates.length > 0
                ? filters.issueDates.join(',')
                : undefined,
            issueDateFrom: filters.issueDateFrom || undefined,
            issueDateTo: filters.issueDateTo || undefined,
            siigoDocumentNumbers:
              filters.siigoDocumentNumbers &&
              filters.siigoDocumentNumbers.length > 0
                ? filters.siigoDocumentNumbers.join(',')
                : undefined,
            importStatuses:
              filters.importStatuses && filters.importStatuses.length > 0
                ? filters.importStatuses.join(',')
                : undefined,
          },
        },
      )

      return response.data
    },
    { force: options?.force },
  )
}

export function peekElectronicDocuments(
  filters: Partial<ElectronicDocumentListFilters> = {},
): ElectronicDocumentListResponse | undefined {
  return peekCachedQuery(documentsCacheKey(filters))
}

export async function fetchElectronicDocumentFilterOptions(
  filters: Pick<
    ElectronicDocumentListFilters,
    'electronicDocumentType'
  > = {},
  options?: { force?: boolean },
): Promise<ElectronicDocumentFilterOptions> {
  const key = companyQueryKey([
    'electronic-documents',
    'filter-options',
    filters.electronicDocumentType ?? '',
  ])

  if (options?.force) {
    invalidateQueryCache(key)
  }

  return cachedQuery(
    key,
    QUERY_STALE_MS.filterOptions,
    async () => {
      const response = await apiClient.get<ElectronicDocumentFilterOptions>(
        ELECTRONIC_DOCUMENT_FILTER_OPTIONS_ENDPOINT,
        {
          params: {
            electronicDocumentType: filters.electronicDocumentType || undefined,
          },
        },
      )
      return response.data
    },
    options,
  )
}

export async function resumeElectronicDocument(
  documentId: string,
  provider: 'SIIGO' | 'JARVIS' = 'SIIGO',
): Promise<ResumeElectronicDocumentResponse> {
  const endpoint =
    provider === 'JARVIS'
      ? JARVIS_RESUME_DOCUMENT_ENDPOINT
      : SIIGO_RESUME_DOCUMENT_ENDPOINT

  const response = await apiClient.post<ResumeElectronicDocumentResponse>(
    endpoint,
    { documentId },
  )

  invalidateQueryCache(companyQueryKey(['electronic-documents']))

  return response.data
}

/** El backend solo confirma que encoló el lote — ya no espera a que
 * termine (ver SiigoDocumentResumeService.resumeBatchInBackground). El
 * progreso real se sigue leyendo con fetchElectronicDocuments (forzando
 * bypass de caché — ver watchImportedDocuments), no con esta respuesta. */
export interface ResumeElectronicDocumentsBatchResponse {
  accepted: boolean
}

export async function resumeElectronicDocumentsBatch(
  documentIds: string[],
): Promise<ResumeElectronicDocumentsBatchResponse> {
  const response = await apiClient.post<ResumeElectronicDocumentsBatchResponse>(
    SIIGO_RESUME_DOCUMENTS_BATCH_ENDPOINT,
    { documentIds },
  )

  invalidateQueryCache(companyQueryKey(['electronic-documents']))

  return response.data
}

/** Actualiza caché tras mutaciones locales (import, envío, etc.). */
export function patchElectronicDocumentsCache(
  filters: Partial<ElectronicDocumentListFilters>,
  response: ElectronicDocumentListResponse,
): void {
  setCachedQuery(documentsCacheKey(filters), response)
}

export interface SaveElectronicDocumentDraftRequest {
  items?: ElectronicDocumentDraftItem[]
  accountCode?: string | null
  paymentMethodId?: number | null
  dueDate?: string | null
  observations?: string | null
  retentionTaxIds?: number[]
  documentDiscount?: number | null
}

export interface SaveElectronicDocumentDraftResponse {
  success: boolean
  status: string
  savedAt: string
}

/** Guarda el borrador de contabilización del documento. Invalida la caché
 * del listado porque el estado del documento puede cambiar al guardarlo (lo
 * que faltaba por completar deja de faltar). */
export async function saveElectronicDocumentDraft(
  documentId: string,
  request: SaveElectronicDocumentDraftRequest,
): Promise<SaveElectronicDocumentDraftResponse> {
  const response = await apiClient.put<SaveElectronicDocumentDraftResponse>(
    `${ELECTRONIC_DOCUMENTS_ENDPOINT}/${documentId}/draft`,
    request,
  )

  invalidateQueryCache(companyQueryKey(['electronic-documents']))

  return response.data
}

/** Elimina un documento local que aún no está en estado lista. */
export async function deleteElectronicDocument(
  documentId: string,
): Promise<void> {
  await apiClient.delete(`${ELECTRONIC_DOCUMENTS_ENDPOINT}/${documentId}`)
  invalidateQueryCache(companyQueryKey(['electronic-documents']))
}

export interface DeleteElectronicDocumentsBatchResponse {
  deletedIds: string[]
  skippedIds: string[]
}

/** Variante en lote de deleteElectronicDocument — un solo request en vez de
 * uno por documento (borrar 100 registros uno por uno se notaba lento por
 * el límite de conexiones simultáneas del navegador). Solo para registros
 * que ya no dependen de SIIGO (ver dbOnlyTargets en SupportDocumentPage). */
export async function deleteElectronicDocumentsBatch(
  documentIds: string[],
): Promise<DeleteElectronicDocumentsBatchResponse> {
  const response = await apiClient.post<DeleteElectronicDocumentsBatchResponse>(
    `${ELECTRONIC_DOCUMENTS_ENDPOINT}/delete-batch`,
    { documentIds },
  )
  invalidateQueryCache(companyQueryKey(['electronic-documents']))

  return response.data
}
