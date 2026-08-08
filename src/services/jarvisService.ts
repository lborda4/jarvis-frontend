import type {
  CreateJarvisTerceroRequest,
  CreateJarvisTerceroResponse,
  JarvisCredentialsStatusResponse,
  JarvisDianResolution,
  JarvisDocumentType,
  JarvisTercerosListResponse,
  LookupJarvisTerceroNitResponse,
  SaveJarvisCredentialsRequest,
  SaveJarvisCredentialsResponse,
} from '../types/jarvis'
import { apiClient } from './apiClient'

const JARVIS_CREDENTIALS_STATUS_ENDPOINT =
  '/integrations/jarvis/credentials/status'
const JARVIS_CREDENTIALS_ENDPOINT = '/integrations/jarvis/credentials'
const JARVIS_RESOLUTIONS_ENDPOINT = '/integrations/jarvis/resolutions'
const JARVIS_RESOLUTIONS_PARSE_ENDPOINT =
  '/integrations/jarvis/resolutions/parse'
const JARVIS_TERCEROS_ENDPOINT = '/integrations/jarvis/terceros'
const JARVIS_CATALOGS_ENDPOINT = '/integrations/jarvis/catalogs'
const JARVIS_SUPPORT_DOCUMENTS_ENDPOINT =
  '/integrations/jarvis/support-documents'

export interface JarvisCatalogItem {
  id: number
  name: string
  code?: string | null
  type?: string | null
  percentage?: number | null
}

export interface JarvisCatalogsResponse {
  taxes: JarvisCatalogItem[]
  paymentMethods: JarvisCatalogItem[]
  paymentForms: JarvisCatalogItem[]
  currencies: JarvisCatalogItem[]
}

export interface CreateJarvisSupportDocumentRequest {
  documentId: string
  date: string
  observations?: string
  retentions?: Array<{ id: number; type?: string; percentage?: number }>
  payment?: {
    id: number
    payment_form_id?: number
    due_date?: string
  }
}

export interface CreateManualJarvisSupportDocumentItem {
  description: string
  quantity: number
  unitValue: number
  discount?: number
  taxAmount?: number
  code?: string
}

export interface CreateManualJarvisSupportDocumentRequest {
  issueDate: string
  supplierDocumentType: string
  supplierIdentification: string
  supplierName?: string
  currency?: string
  documentPrefix: string
  documentNumber: string
  observations?: string
  items: CreateManualJarvisSupportDocumentItem[]
  retentions?: Array<{ id: number; type?: string; percentage?: number }>
  payment?: {
    id: number
    payment_form_id?: number
    due_date?: string
  }
  send?: boolean
}

export interface CreateManualJarvisSupportDocumentResponse {
  documentId: string
  sent: boolean
  document: unknown
  supportDocument?: {
    id: string
    number?: number | string
    consecutive?: string
    prefix?: string
    date: string
    cude?: string | null
  }
}

export async function fetchJarvisCredentialsStatus(): Promise<JarvisCredentialsStatusResponse> {
  const response = await apiClient.get<JarvisCredentialsStatusResponse>(
    JARVIS_CREDENTIALS_STATUS_ENDPOINT,
  )

  return response.data
}

export async function fetchJarvisCredentialsConfigured(): Promise<boolean> {
  const status = await fetchJarvisCredentialsStatus()
  return status.configured
}

export async function saveJarvisCredentials(
  request: SaveJarvisCredentialsRequest,
): Promise<SaveJarvisCredentialsResponse> {
  const response = await apiClient.post<SaveJarvisCredentialsResponse>(
    JARVIS_CREDENTIALS_ENDPOINT,
    request,
  )

  return response.data
}

export interface ParseJarvisResolutionResponse {
  resolution: JarvisDianResolution
  warnings: string[]
}

export type SaveJarvisResolutionRequest = Omit<
  JarvisDianResolution,
  'configuredAt'
> & {
  formNumber: string
  technicalKey: string
  dateFrom: string
  dateTo: string
}

export interface SaveJarvisResolutionResponse {
  success: boolean
  resolution: JarvisDianResolution
}

export async function parseJarvisResolution(
  file: File,
): Promise<ParseJarvisResolutionResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<ParseJarvisResolutionResponse>(
    JARVIS_RESOLUTIONS_PARSE_ENDPOINT,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )

  return response.data
}

export async function saveJarvisResolution(
  request: SaveJarvisResolutionRequest,
): Promise<SaveJarvisResolutionResponse> {
  const response = await apiClient.post<SaveJarvisResolutionResponse>(
    JARVIS_RESOLUTIONS_ENDPOINT,
    request,
  )

  return response.data
}

export async function fetchJarvisTerceros(
  search?: string,
): Promise<JarvisTercerosListResponse> {
  const response = await apiClient.get<JarvisTercerosListResponse>(
    JARVIS_TERCEROS_ENDPOINT,
    {
      params: search?.trim() ? { search: search.trim() } : undefined,
    },
  )

  return response.data
}

export async function createJarvisTercero(
  request: CreateJarvisTerceroRequest,
): Promise<CreateJarvisTerceroResponse> {
  const response = await apiClient.post<CreateJarvisTerceroResponse>(
    JARVIS_TERCEROS_ENDPOINT,
    request,
  )

  return response.data
}

export async function lookupJarvisTerceroByNit(
  identificationNumber: string,
  documentType: JarvisDocumentType,
): Promise<LookupJarvisTerceroNitResponse> {
  const response = await apiClient.post<LookupJarvisTerceroNitResponse>(
    `${JARVIS_TERCEROS_ENDPOINT}/lookup-nit`,
    {
      document_type: documentType,
      identification_number: identificationNumber,
    },
  )

  return response.data
}

export async function fetchJarvisCatalogs(): Promise<JarvisCatalogsResponse> {
  const response = await apiClient.get<JarvisCatalogsResponse>(
    JARVIS_CATALOGS_ENDPOINT,
  )

  return response.data
}

export async function createJarvisSupportDocument(
  request: CreateJarvisSupportDocumentRequest,
): Promise<unknown> {
  const response = await apiClient.post(
    JARVIS_SUPPORT_DOCUMENTS_ENDPOINT,
    request,
  )

  return response.data
}

export async function createManualJarvisSupportDocument(
  request: CreateManualJarvisSupportDocumentRequest,
): Promise<CreateManualJarvisSupportDocumentResponse> {
  const response = await apiClient.post<CreateManualJarvisSupportDocumentResponse>(
    `${JARVIS_SUPPORT_DOCUMENTS_ENDPOINT}/manual`,
    request,
  )

  return response.data
}
