import axios from 'axios'
import type {
  CreateSiigoPurchaseRequest,
  CreateSiigoPurchaseResponse,
  CreateSiigoPurchaseSendRequest,
  CreateSiigoPurchaseSendResponse,
  CreateSiigoSupportDocumentRequest,
  CreateSiigoSupportDocumentResponse,
  DeleteSiigoPurchaseResponse,
  DeleteSiigoSupportDocumentResponse,
  CreateSiigoSupplierRequest,
  CreateSiigoSupplierResponse,
  ListAutoCreatedSuppliersResponse,
  ListAccountMappingRulesResponse,
  SaveAccountMappingRequest,
  SaveAccountMappingResponse,
  UpdateAccountMappingRuleRequest,
  UpdateAccountMappingRuleResponse,
  ValidateAccountMappingRequest,
  ValidateAccountMappingResponse,
  ValidateSiigoImportRequest,
  ValidateSiigoImportResponse,
  ImportBalanceTrialResponse,
  SaveSiigoCredentialsRequest,
  SaveSiigoCredentialsResponse,
  SaveSiigoDocumentTypesRequest,
  SaveSiigoDocumentTypesResponse,
  SiigoCredentialsStatusResponse,
  SiigoDocumentTypeCatalogItem,
  SiigoAccountCatalogItem,
  SiigoCostCenterCatalogItem,
  SiigoProductCatalogItem,
  SiigoPaymentMethodCatalogItem,
  SiigoTaxCatalogItem,
} from '../types/siigo'
import { API_BASE_URL, apiClient } from './apiClient'
import {
  cachedQuery,
  companyQueryKey,
  invalidateQueryCache,
  QUERY_STALE_MS,
} from './queryCache'

const SIIGO_IMPORT_ENDPOINT = '/integrations/siigo/import'
const SIIGO_SUPPLIERS_ENDPOINT = '/integrations/siigo/suppliers'
const SIIGO_AUTO_CREATED_SUPPLIERS_ENDPOINT =
  '/integrations/siigo/suppliers/auto-created'
const SIIGO_ACCOUNT_MAPPINGS_VALIDATE_ENDPOINT =
  '/integrations/siigo/account-mappings/validate'
const SIIGO_ACCOUNT_MAPPINGS_ENDPOINT = '/integrations/siigo/account-mappings'
const SIIGO_ACCOUNT_MAPPING_RULES_ENDPOINT =
  '/integrations/siigo/account-mappings/rules'
const SIIGO_ACCOUNT_MAPPING_RULE_ITEM_ENDPOINT =
  '/integrations/siigo/account-mappings/rules/item'
const SIIGO_PURCHASES_ENDPOINT = '/integrations/siigo/purchases'
const SIIGO_PURCHASES_SEND_ENDPOINT = '/integrations/siigo/purchases/send'
const SIIGO_SUPPORT_DOCUMENTS_ENDPOINT = '/integrations/siigo/support-documents'
const SIIGO_ACCOUNTS_ENDPOINT = '/integrations/siigo/accounts'
const SIIGO_PAYMENT_TYPES_ENDPOINT = '/integrations/siigo/payment-types'
const SIIGO_TAXES_ENDPOINT = '/integrations/siigo/taxes'
const SIIGO_COST_CENTERS_ENDPOINT = '/integrations/siigo/cost-centers'
const SIIGO_PRODUCTS_ENDPOINT = '/integrations/siigo/products'
const SIIGO_BALANCE_TRIAL_IMPORT_ENDPOINT =
  '/integrations/siigo/balance-trial/import'
const SIIGO_CREDENTIALS_STATUS_ENDPOINT = '/integrations/siigo/credentials/status'
const SIIGO_CREDENTIALS_ENDPOINT = '/integrations/siigo/credentials'
const SIIGO_DOCUMENT_TYPES_ENDPOINT = '/integrations/siigo/document-types'
const SIIGO_DOCUMENT_TYPES_SELECTION_ENDPOINT =
  '/integrations/siigo/document-types/selection'
const SIIGO_CATALOG_SYNC_ENDPOINT = '/integrations/siigo/catalog/sync'
const SIIGO_PURCHASE_HISTORY_SYNC_ENDPOINT =
  '/integrations/siigo/purchases-history/sync'
const SIIGO_PURCHASE_HISTORY_SYNC_STATUS_ENDPOINT =
  '/integrations/siigo/purchases-history/sync-status'

export async function syncSiigoCatalogs(): Promise<void> {
  await apiClient.post(SIIGO_CATALOG_SYNC_ENDPOINT)
}

export interface StartPurchaseHistorySyncResponse {
  jobId: string
}

export interface PurchaseHistorySyncStatusResponse {
  status: 'running' | 'completed' | 'error' | null
  syncedCount: number
  totalCount: number | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}

export async function startSiigoPurchaseHistorySync(): Promise<StartPurchaseHistorySyncResponse> {
  const response = await apiClient.post<StartPurchaseHistorySyncResponse>(
    SIIGO_PURCHASE_HISTORY_SYNC_ENDPOINT,
  )
  return response.data
}

export async function fetchSiigoPurchaseHistorySyncStatus(): Promise<PurchaseHistorySyncStatusResponse> {
  const response = await apiClient.get<PurchaseHistorySyncStatusResponse>(
    SIIGO_PURCHASE_HISTORY_SYNC_STATUS_ENDPOINT,
  )
  return response.data
}

const PURCHASE_HISTORY_SYNC_POLL_INTERVAL_MS = 2000
const PURCHASE_HISTORY_SYNC_POLL_MAX_ATTEMPTS = 900 // ~30 min tope de seguridad

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Arranca (si hace falta) y espera a que termine la sincronización del
 * historial de facturas de compra — pensada para correr en paralelo con
 * syncSiigoSuppliers (Balance de Prueba) durante el paso "Cuentas contables"
 * de la configuración, en vez de dejarla para cuando el usuario entre a
 * Factura de compra por primera vez. Nunca lanza por un status 'error' del
 * job en sí (se resuelve igual, con ese status) — solo lanza si se agota el
 * tope de reintentos de polling. */
export async function runSiigoPurchaseHistorySyncToCompletion(): Promise<PurchaseHistorySyncStatusResponse> {
  const initial = await fetchSiigoPurchaseHistorySyncStatus()

  if (initial.status === 'completed' || initial.status === 'error') {
    return initial
  }

  if (initial.status !== 'running') {
    await startSiigoPurchaseHistorySync()
  }

  for (
    let attempt = 0;
    attempt < PURCHASE_HISTORY_SYNC_POLL_MAX_ATTEMPTS;
    attempt += 1
  ) {
    await sleep(PURCHASE_HISTORY_SYNC_POLL_INTERVAL_MS)
    const next = await fetchSiigoPurchaseHistorySyncStatus()

    if (next.status === 'completed' || next.status === 'error') {
      return next
    }
  }

  throw new Error(
    'Tiempo de espera agotado sincronizando el historial de facturas de compra.',
  )
}

export async function fetchSiigoAccounts(): Promise<SiigoAccountCatalogItem[]> {
  const response = await apiClient.get<SiigoAccountCatalogItem[]>(
    SIIGO_ACCOUNTS_ENDPOINT,
  )
  return response.data
}

export async function fetchSiigoPaymentMethods(
  documentType = 'DS',
): Promise<SiigoPaymentMethodCatalogItem[]> {
  const response = await apiClient.get<SiigoPaymentMethodCatalogItem[]>(
    SIIGO_PAYMENT_TYPES_ENDPOINT,
    {
      params: {
        documentType,
      },
    },
  )
  return response.data
}

export async function fetchSiigoTaxes(
  type: string,
): Promise<SiigoTaxCatalogItem[]> {
  const response = await apiClient.get<SiigoTaxCatalogItem[]>(
    SIIGO_TAXES_ENDPOINT,
    {
      params: {
        type,
      },
    },
  )
  return response.data
}

export async function fetchSiigoCostCenters(): Promise<SiigoCostCenterCatalogItem[]> {
  const response = await apiClient.get<SiigoCostCenterCatalogItem[]>(
    SIIGO_COST_CENTERS_ENDPOINT,
  )

  return response.data
}

export async function fetchSiigoProducts(): Promise<SiigoProductCatalogItem[]> {
  const response = await apiClient.get<SiigoProductCatalogItem[]>(
    SIIGO_PRODUCTS_ENDPOINT,
  )

  return response.data
}

export async function validateSiigoImport(
  request: ValidateSiigoImportRequest,
): Promise<ValidateSiigoImportResponse> {
  console.log('[SIIGO Import] Enviando request:', {
    method: 'POST',
    url: SIIGO_IMPORT_ENDPOINT,
    body: request,
  })
  try {
    const response = await apiClient.post<ValidateSiigoImportResponse>(
      SIIGO_IMPORT_ENDPOINT,
      request,
    )

    console.log('[SIIGO Import] Respuesta exitosa:', {
      status: response.status,
      data: response.data,
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[SIIGO Import] Error en la petición:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        request: {
          method: 'POST',
          url: SIIGO_IMPORT_ENDPOINT,
          body: request,
        },
      })
    } else {
      console.error('[SIIGO Import] Error inesperado:', error)
    }

    throw error
  }
}

export async function createSiigoSupplier(
  request: CreateSiigoSupplierRequest,
): Promise<CreateSiigoSupplierResponse> {
  const url = `${API_BASE_URL}${SIIGO_SUPPLIERS_ENDPOINT}`

  console.log('[SIIGO Supplier] ANTES — consumiendo servicio:', {
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/json' },
    body: request,
    bodyJson: JSON.stringify(request),
  })

  try {
    const response = await apiClient.post<CreateSiigoSupplierResponse>(
      SIIGO_SUPPLIERS_ENDPOINT,
      request,
    )

    console.log('[SIIGO Supplier] DESPUÉS — respuesta exitosa:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      dataJson: JSON.stringify(response.data),
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[SIIGO Supplier] DESPUÉS — error en la petición:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        responseDataJson: JSON.stringify(error.response?.data ?? null),
        request: {
          method: 'POST',
          url,
          body: request,
          bodyJson: JSON.stringify(request),
        },
      })
    } else {
      console.error('[SIIGO Supplier] DESPUÉS — error inesperado:', error)
    }

    throw error
  }
}

/** Terceros creados AUTOMÁTICAMENTE en SIIGO (sin que el usuario clickeara
 * "Crear tercero") desde `sinceIso` — se consulta justo después de un
 * import para avisarle al usuario cuántos y cuáles se crearon solos. */
export async function fetchAutoCreatedSuppliers(
  sinceIso: string,
): Promise<ListAutoCreatedSuppliersResponse> {
  const response = await apiClient.get<ListAutoCreatedSuppliersResponse>(
    SIIGO_AUTO_CREATED_SUPPLIERS_ENDPOINT,
    { params: { since: sinceIso } },
  )

  return response.data
}

export async function validateAccountMapping(
  request: ValidateAccountMappingRequest,
): Promise<ValidateAccountMappingResponse> {
  const url = `${API_BASE_URL}${SIIGO_ACCOUNT_MAPPINGS_VALIDATE_ENDPOINT}`

  console.log('[SIIGO Account Mapping] ANTES — validar cuenta:', {
    method: 'POST',
    url,
    body: request,
    bodyJson: JSON.stringify(request),
  })

  try {
    const response = await apiClient.post<ValidateAccountMappingResponse>(
      SIIGO_ACCOUNT_MAPPINGS_VALIDATE_ENDPOINT,
      request,
    )

    console.log('[SIIGO Account Mapping] DESPUÉS — validación exitosa:', {
      status: response.status,
      data: response.data,
      dataJson: JSON.stringify(response.data),
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[SIIGO Account Mapping] DESPUÉS — error al validar:', {
        status: error.response?.status,
        responseData: error.response?.data,
        request: {
          method: 'POST',
          url,
          body: request,
        },
      })
    } else {
      console.error('[SIIGO Account Mapping] Error inesperado al validar:', error)
    }

    throw error
  }
}

export async function saveAccountMapping(
  request: SaveAccountMappingRequest,
): Promise<SaveAccountMappingResponse> {
  const url = `${API_BASE_URL}${SIIGO_ACCOUNT_MAPPINGS_ENDPOINT}`

  console.log('[SIIGO Account Mapping] ANTES — guardar cuenta:', {
    method: 'POST',
    url,
    body: request,
    bodyJson: JSON.stringify(request),
  })

  try {
    const response = await apiClient.post<SaveAccountMappingResponse>(
      SIIGO_ACCOUNT_MAPPINGS_ENDPOINT,
      request,
    )

    console.log('[SIIGO Account Mapping] DESPUÉS — guardado exitoso:', {
      status: response.status,
      data: response.data,
      dataJson: JSON.stringify(response.data),
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[SIIGO Account Mapping] DESPUÉS — error al guardar:', {
        status: error.response?.status,
        responseData: error.response?.data,
        request: {
          method: 'POST',
          url,
          body: request,
        },
      })
    } else {
      console.error('[SIIGO Account Mapping] Error inesperado al guardar:', error)
    }

    throw error
  }
}

export async function listAccountMappingRules(): Promise<ListAccountMappingRulesResponse> {
  const response = await apiClient.get<ListAccountMappingRulesResponse>(
    SIIGO_ACCOUNT_MAPPING_RULES_ENDPOINT,
  )

  return response.data
}

export async function updateAccountMappingRule(
  request: UpdateAccountMappingRuleRequest,
): Promise<UpdateAccountMappingRuleResponse> {
  const response = await apiClient.patch<UpdateAccountMappingRuleResponse>(
    SIIGO_ACCOUNT_MAPPING_RULE_ITEM_ENDPOINT,
    request,
  )

  return response.data
}

export async function createSiigoPurchase(
  request: CreateSiigoPurchaseRequest,
): Promise<CreateSiigoPurchaseResponse> {
  const url = `${API_BASE_URL}${SIIGO_PURCHASES_ENDPOINT}`

  console.log('[SIIGO Purchase] ANTES — crear factura:', {
    method: 'POST',
    url,
    body: request,
    bodyJson: JSON.stringify(request),
  })

  try {
    const response = await apiClient.post<CreateSiigoPurchaseResponse>(
      SIIGO_PURCHASES_ENDPOINT,
      request,
    )

    console.log('[SIIGO Purchase] DESPUÉS — factura creada:', {
      status: response.status,
      data: response.data,
      dataJson: JSON.stringify(response.data),
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[SIIGO Purchase] DESPUÉS — error al crear factura:', {
        status: error.response?.status,
        responseData: error.response?.data,
        request: {
          method: 'POST',
          url,
          body: request,
        },
      })
    } else {
      console.error('[SIIGO Purchase] Error inesperado al crear factura:', error)
    }

    throw error
  }
}

export async function createSiigoSupportDocument(
  request: CreateSiigoSupportDocumentRequest,
): Promise<CreateSiigoSupportDocumentResponse> {
  const url = `${API_BASE_URL}${SIIGO_SUPPORT_DOCUMENTS_ENDPOINT}`

  console.log('[SIIGO Support Document] ANTES — crear documento soporte:', {
    method: 'POST',
    url,
    body: request,
    bodyJson: JSON.stringify(request),
  })

  try {
    const response = await apiClient.post<CreateSiigoSupportDocumentResponse>(
      SIIGO_SUPPORT_DOCUMENTS_ENDPOINT,
      request,
    )

    console.log('[SIIGO Support Document] DESPUÉS — documento creado:', {
      status: response.status,
      data: response.data,
      dataJson: JSON.stringify(response.data),
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[SIIGO Support Document] DESPUÉS — error al crear:', {
        status: error.response?.status,
        responseData: error.response?.data,
        request: {
          method: 'POST',
          url,
          body: request,
        },
      })
    } else {
      console.error(
        '[SIIGO Support Document] Error inesperado al crear documento:',
        error,
      )
    }

    throw error
  }
}

export async function deleteSiigoSupportDocument(
  documentId: string,
): Promise<DeleteSiigoSupportDocumentResponse> {
  const response = await apiClient.delete<DeleteSiigoSupportDocumentResponse>(
    `${SIIGO_SUPPORT_DOCUMENTS_ENDPOINT}/${encodeURIComponent(documentId)}`,
  )

  return response.data
}

export async function deleteSiigoPurchase(
  documentId: string,
): Promise<DeleteSiigoPurchaseResponse> {
  const response = await apiClient.delete<DeleteSiigoPurchaseResponse>(
    `${SIIGO_PURCHASES_ENDPOINT}/${encodeURIComponent(documentId)}`,
  )

  return response.data
}

export async function createSiigoPurchaseSend(
  request: CreateSiigoPurchaseSendRequest,
): Promise<CreateSiigoPurchaseSendResponse> {
  const response = await apiClient.post<CreateSiigoPurchaseSendResponse>(
    SIIGO_PURCHASES_SEND_ENDPOINT,
    request,
  )

  return response.data
}

export async function fetchSiigoCredentialsStatus(options?: {
  force?: boolean
}): Promise<SiigoCredentialsStatusResponse> {
  const key = companyQueryKey(['siigo', 'credentials-status'])

  if (options?.force) {
    invalidateQueryCache(key)
  }

  return cachedQuery(
    key,
    QUERY_STALE_MS.credentials,
    async () => {
      const response = await apiClient.get<SiigoCredentialsStatusResponse>(
        SIIGO_CREDENTIALS_STATUS_ENDPOINT,
      )
      return response.data
    },
    options,
  )
}

export async function fetchSiigoCredentialsConfigured(): Promise<boolean> {
  const status = await fetchSiigoCredentialsStatus()
  return Boolean(
    status.configured &&
      status.hasAccounts &&
      status.documentTypesConfigured,
  )
}

export async function fetchSiigoDocumentTypes(
  type: 'DS' | 'FC',
): Promise<SiigoDocumentTypeCatalogItem[]> {
  const response = await apiClient.get<SiigoDocumentTypeCatalogItem[]>(
    SIIGO_DOCUMENT_TYPES_ENDPOINT,
    { params: { type } },
  )

  return response.data
}

export async function saveSiigoDocumentTypes(
  request: SaveSiigoDocumentTypesRequest,
): Promise<SaveSiigoDocumentTypesResponse> {
  const response = await apiClient.put<SaveSiigoDocumentTypesResponse>(
    SIIGO_DOCUMENT_TYPES_SELECTION_ENDPOINT,
    request,
  )

  invalidateQueryCache(companyQueryKey(['siigo', 'credentials-status']))

  return response.data
}

export async function saveSiigoCredentials(
  request: SaveSiigoCredentialsRequest,
): Promise<SaveSiigoCredentialsResponse> {
  const response = await apiClient.post<SaveSiigoCredentialsResponse>(
    SIIGO_CREDENTIALS_ENDPOINT,
    request,
  )

  invalidateQueryCache(companyQueryKey(['siigo', 'credentials-status']))

  return response.data
}

export async function syncSiigoSuppliers(): Promise<ImportBalanceTrialResponse> {
  const response = await apiClient.post<ImportBalanceTrialResponse>(
    SIIGO_BALANCE_TRIAL_IMPORT_ENDPOINT,
    undefined,
    {
      // La sincronización consulta el Balance de Prueba en SIIGO.
      timeout: 10 * 60 * 1000,
    },
  )

  // Tras guardar cuentas, el status debe reconsultar hasAccounts.
  invalidateQueryCache(companyQueryKey(['siigo', 'credentials-status']))
  invalidateQueryCache(companyQueryKey(['siigo', 'catalog-bundle']))

  return response.data
}
