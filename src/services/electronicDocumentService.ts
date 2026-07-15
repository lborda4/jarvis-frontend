import type {
  ElectronicDocumentListFilters,
  ElectronicDocumentListResponse,
  ResumeElectronicDocumentResponse,
} from '../types/electronicDocument'
import { apiClient } from './apiClient'

const ELECTRONIC_DOCUMENTS_ENDPOINT = '/electronic-documents'
const RESUME_DOCUMENT_ENDPOINT = '/integrations/siigo/documents/resume'
const RESUME_DOCUMENTS_BATCH_ENDPOINT =
  '/integrations/siigo/documents/resume-batch'

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
      },
    },
  )

  return response.data
}

export async function resumeElectronicDocument(
  documentId: string,
): Promise<ResumeElectronicDocumentResponse> {
  const response = await apiClient.post<ResumeElectronicDocumentResponse>(
    RESUME_DOCUMENT_ENDPOINT,
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
    RESUME_DOCUMENTS_BATCH_ENDPOINT,
    { documentIds },
  )

  return response.data
}
