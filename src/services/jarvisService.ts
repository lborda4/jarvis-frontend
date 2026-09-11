import type {
  CreateJarvisTerceroRequest,
  CreateJarvisTerceroResponse,
  CreateJarvisTercerosBulkRequestItem,
  CreateJarvisTercerosBulkResponse,
  JarvisCredentialsStatusResponse,
  JarvisDianResolution,
  JarvisDocumentType,
  JarvisTercerosListResponse,
  ListJarvisAvailableResolutionsResponse,
  ListPendingJarvisSuppliersResponse,
  LookupJarvisTerceroNitResponse,
  SaveJarvisCredentialsRequest,
  SaveJarvisCredentialsResponse,
} from '../types/jarvis'
import { apiClient } from './apiClient'
import {
  cachedQuery,
  companyQueryKey,
  invalidateQueryCache,
  QUERY_STALE_MS,
} from './queryCache'

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
const JARVIS_INVOICES_ENDPOINT = '/integrations/jarvis/invoices'

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

export interface CreateJarvisInvoiceItem {
  description: string
  quantity: number
  unitValue: number
  discount?: number
  taxAmount?: number
  code?: string
  notes?: string
}

export interface CreateJarvisInvoiceRequest {
  issueDate: string
  customerDocumentType: string
  customerIdentification: string
  customerName?: string
  currency?: string
  observations?: string
  headNote?: string
  footNote?: string
  items: CreateJarvisInvoiceItem[]
  discountAmount?: number
  retentions?: Array<{ id: number; type?: string; percentage?: number }>
  payment?: {
    id: number
    payment_form_id?: number
    due_date?: string
  }
}

export interface CreateJarvisInvoiceResponse {
  success: boolean
  invoice: {
    id: string
    number?: number | string
    consecutive?: string
    prefix?: string
    date: string
    cufe?: string | null
  }
}

export async function fetchJarvisCredentialsStatus(): Promise<JarvisCredentialsStatusResponse> {
  return cachedQuery(
    companyQueryKey(['jarvis', 'credentials-status']),
    QUERY_STALE_MS.credentials,
    async () => {
      const response = await apiClient.get<JarvisCredentialsStatusResponse>(
        JARVIS_CREDENTIALS_STATUS_ENDPOINT,
      )
      return response.data
    },
  )
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

  invalidateQueryCache(companyQueryKey(['jarvis', 'credentials-status']))

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
  /** Opcional: solo factura electrónica lleva clave técnica. */
  technicalKey?: string
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

  invalidateQueryCache(companyQueryKey(['jarvis', 'credentials-status']))

  return response.data
}

/** Resoluciones vigentes en la DIAN (GET /reports/resolutions de NextPyme).
 * Sin caché: son pocas, cambian cuando el contador habilita una nueva, y
 * mostrar una lista vieja acá lleva a configurar una resolución que ya no
 * está autorizada. */
export async function fetchJarvisAvailableResolutions(): Promise<ListJarvisAvailableResolutionsResponse> {
  const response = await apiClient.get<ListJarvisAvailableResolutionsResponse>(
    `${JARVIS_RESOLUTIONS_ENDPOINT}/available`,
  )

  return response.data
}

export async function fetchJarvisTerceros(
  search?: string,
): Promise<JarvisTercerosListResponse> {
  const trimmedSearch = search?.trim()

  // Búsquedas tipadas no se cachean; la lista completa sí.
  if (trimmedSearch) {
    const response = await apiClient.get<JarvisTercerosListResponse>(
      JARVIS_TERCEROS_ENDPOINT,
      {
        params: { search: trimmedSearch },
      },
    )
    return response.data
  }

  return cachedQuery(
    companyQueryKey(['jarvis', 'terceros']),
    QUERY_STALE_MS.terceros,
    async () => {
      const response = await apiClient.get<JarvisTercerosListResponse>(
        JARVIS_TERCEROS_ENDPOINT,
      )
      return response.data
    },
  )
}

export async function createJarvisTercero(
  request: CreateJarvisTerceroRequest,
): Promise<CreateJarvisTerceroResponse> {
  const response = await apiClient.post<CreateJarvisTerceroResponse>(
    JARVIS_TERCEROS_ENDPOINT,
    request,
  )

  invalidateQueryCache(companyQueryKey(['jarvis', 'terceros']))

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

/** Proveedores distintos que aparecen en documentos "Requiere proveedor" y no
 * existen todavía como tercero Jarvis — ya vienen enriquecidos con la
 * consulta a NextPyme del lado del backend (mismo autocompletado que el
 * modal uno por uno), para el modal de creación masiva. */
export async function fetchPendingJarvisTerceros(): Promise<ListPendingJarvisSuppliersResponse> {
  const response = await apiClient.get<ListPendingJarvisSuppliersResponse>(
    `${JARVIS_TERCEROS_ENDPOINT}/pending`,
  )

  return response.data
}

export async function createJarvisTercerosBulk(
  suppliers: CreateJarvisTercerosBulkRequestItem[],
): Promise<CreateJarvisTercerosBulkResponse> {
  const response = await apiClient.post<CreateJarvisTercerosBulkResponse>(
    `${JARVIS_TERCEROS_ENDPOINT}/bulk`,
    { suppliers },
  )

  invalidateQueryCache(companyQueryKey(['jarvis', 'terceros']))

  return response.data
}

export async function fetchJarvisCatalogs(): Promise<JarvisCatalogsResponse> {
  return cachedQuery(
    companyQueryKey(['jarvis', 'catalogs']),
    QUERY_STALE_MS.catalogs,
    async () => {
      const response = await apiClient.get<JarvisCatalogsResponse>(
        JARVIS_CATALOGS_ENDPOINT,
      )
      return response.data
    },
  )
}

export async function createJarvisSupportDocument(
  request: CreateJarvisSupportDocumentRequest,
): Promise<unknown> {
  const response = await apiClient.post(
    JARVIS_SUPPORT_DOCUMENTS_ENDPOINT,
    request,
  )

  // Sin esto, la lista y el filtro de Estado de Factura de compra/Documento
  // soporte seguían sirviendo la respuesta cacheada con el estado de ANTES
  // de enviar (bug real reportado: "LISTA" aparecía como opción del filtro,
  // o marcado, sin que quedara ningún documento así) hasta que venciera la
  // caché por su cuenta.
  invalidateQueryCache(companyQueryKey(['electronic-documents']))

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

export async function createJarvisInvoice(
  request: CreateJarvisInvoiceRequest,
): Promise<CreateJarvisInvoiceResponse> {
  const response = await apiClient.post<CreateJarvisInvoiceResponse>(
    JARVIS_INVOICES_ENDPOINT,
    request,
  )

  return response.data
}
