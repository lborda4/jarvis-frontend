import type {
  ElectronicDocumentFilterOptions,
  ElectronicDocumentListFilters,
  ElectronicDocumentListResponse,
  ResumeElectronicDocumentResponse,
} from '../types/electronicDocument'
import { apiClient } from './apiClient'

const ELECTRONIC_DOCUMENTS_ENDPOINT = '/electronic-documents'
const ELECTRONIC_DOCUMENT_FILTER_OPTIONS_ENDPOINT =
  '/electronic-documents/filter-options'
const SIIGO_RESUME_DOCUMENT_ENDPOINT = '/integrations/siigo/documents/resume'
const SIIGO_RESUME_DOCUMENTS_BATCH_ENDPOINT =
  '/integrations/siigo/documents/resume-batch'
const JARVIS_RESUME_DOCUMENT_ENDPOINT = '/integrations/jarvis/documents/resume'

export async function fetchElectronicDocuments(
  filters: Partial<ElectronicDocumentListFilters> = {},
): Promise<ElectronicDocumentListResponse> {
  const response = await apiClient.get<ElectronicDocumentListResponse>(
    ELECTRONIC_DOCUMENTS_ENDPOINT,
    {
      params: {
        status: filters.status || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        search: filters.search || undefined,
        electronicDocumentType: filters.electronicDocumentType || undefined,
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
}

export async function fetchElectronicDocumentFilterOptions(
  filters: Pick<
    ElectronicDocumentListFilters,
    'electronicDocumentType'
  > = {},
): Promise<ElectronicDocumentFilterOptions> {
  const response = await apiClient.get<ElectronicDocumentFilterOptions>(
    ELECTRONIC_DOCUMENT_FILTER_OPTIONS_ENDPOINT,
    {
      params: {
        electronicDocumentType: filters.electronicDocumentType || undefined,
      },
    },
  )

  return response.data
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

  return response.data
}

export interface ResumeElectronicDocumentsBatchResponse {
  items: ResumeElectronicDocumentResponse[]
}

export async function resumeElectronicDocumentsBatch(
  documentIds: string[],
): Promise<ResumeElectronicDocumentsBatchResponse> {
  const response = await apiClient.post<ResumeElectronicDocumentsBatchResponse>(
    SIIGO_RESUME_DOCUMENTS_BATCH_ENDPOINT,
    { documentIds },
  )

  return response.data
}
