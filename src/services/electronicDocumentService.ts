import type {
  ElectronicDocumentListFilters,
  ElectronicDocumentListResponse,
  ResumeElectronicDocumentResponse,
} from '../types/electronicDocument'
import { apiClient } from './apiClient'

const ELECTRONIC_DOCUMENTS_ENDPOINT = '/electronic-documents'
const RESUME_DOCUMENT_ENDPOINT = '/integrations/siigo/documents/resume'

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
