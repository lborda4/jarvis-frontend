import type {
  BoldBindedTerminalsResponse,
  CreateAdminCompanyRequest,
  CreateAdminCompanyResponse,
  ListAdminCitiesResponse,
  ListAdminCompaniesResponse,
  ListAdminPlansResponse,
  ListBoldCashRegistersResponse,
  LookupAdminCompanyNameResponse,
  ParseRutResponse,
  RegenerateCompanyInviteCodeResponse,
  UpdateCompanyCityRequest,
  UpdateCompanyCityResponse,
  UpdateCompanyDescriptionRequest,
  UpdateCompanyDescriptionResponse,
  UpdateCompanyNextPymeTokenRequest,
  UpdateCompanyNextPymeTokenResponse,
  UpdateIntegrationSubscriptionRequest,
  UpdateIntegrationSubscriptionResponse,
  UpsertBoldCashRegisterRequest,
  UpsertBoldCashRegisterResponse,
} from '../types/admin'
import type { IntegrationProvider } from '../types/admin'
import { apiClient } from './apiClient'

const ADMIN_COMPANIES_ENDPOINT = '/admin/companies'
const ADMIN_PLANS_ENDPOINT = '/admin/plans'
const ADMIN_CITIES_ENDPOINT = '/admin/cities'
const ADMIN_RUT_PARSE_ENDPOINT = '/admin/companies/rut/parse'
const BOLD_BINDED_TERMINALS_ENDPOINT = '/bold/payments/binded-terminals'
const BOLD_CASH_REGISTERS_ENDPOINT = '/bold/cash-registers'

export async function fetchAdminPlans(): Promise<ListAdminPlansResponse> {
  const response = await apiClient.get<ListAdminPlansResponse>(
    ADMIN_PLANS_ENDPOINT,
  )

  return response.data
}

export async function fetchAdminCompanies(): Promise<ListAdminCompaniesResponse> {
  const response = await apiClient.get<ListAdminCompaniesResponse>(
    ADMIN_COMPANIES_ENDPOINT,
  )

  return response.data
}

export async function createAdminCompany(
  request: CreateAdminCompanyRequest,
): Promise<CreateAdminCompanyResponse> {
  const response = await apiClient.post<CreateAdminCompanyResponse>(
    ADMIN_COMPANIES_ENDPOINT,
    request,
  )

  return response.data
}

export async function parseAdminCompanyRut(file: File): Promise<ParseRutResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<ParseRutResponse>(
    ADMIN_RUT_PARSE_ENDPOINT,
    formData,
  )

  return response.data
}

export async function regenerateCompanyInviteCode(
  companyId: string,
): Promise<RegenerateCompanyInviteCodeResponse> {
  const response = await apiClient.post<RegenerateCompanyInviteCodeResponse>(
    `${ADMIN_COMPANIES_ENDPOINT}/${companyId}/invite-code/regenerate`,
  )

  return response.data
}

export async function updateCompanyNextPymeToken(
  companyId: string,
  request: UpdateCompanyNextPymeTokenRequest,
): Promise<UpdateCompanyNextPymeTokenResponse> {
  const response = await apiClient.patch<UpdateCompanyNextPymeTokenResponse>(
    `${ADMIN_COMPANIES_ENDPOINT}/${companyId}/nextpyme-token`,
    request,
  )

  return response.data
}

export async function lookupAdminCompanyName(
  nit: string,
): Promise<LookupAdminCompanyNameResponse> {
  const response = await apiClient.get<LookupAdminCompanyNameResponse>(
    `${ADMIN_COMPANIES_ENDPOINT}/lookup-name`,
    { params: { nit } },
  )

  return response.data
}

export async function fetchAdminCities(): Promise<ListAdminCitiesResponse> {
  const response = await apiClient.get<ListAdminCitiesResponse>(
    ADMIN_CITIES_ENDPOINT,
  )

  return response.data
}

export async function updateCompanyDescription(
  companyId: string,
  request: UpdateCompanyDescriptionRequest,
): Promise<UpdateCompanyDescriptionResponse> {
  const response = await apiClient.patch<UpdateCompanyDescriptionResponse>(
    `${ADMIN_COMPANIES_ENDPOINT}/${companyId}/description`,
    request,
  )

  return response.data
}

export async function updateCompanyCity(
  companyId: string,
  request: UpdateCompanyCityRequest,
): Promise<UpdateCompanyCityResponse> {
  const response = await apiClient.patch<UpdateCompanyCityResponse>(
    `${ADMIN_COMPANIES_ENDPOINT}/${companyId}/city`,
    request,
  )

  return response.data
}

/** La llave de identidad (x-api-key) de Bold no se persiste todavía (ver
 * ensureBoldIntegration en el backend) — viaja en este header en cada
 * llamada, la ingresa el admin a mano en el panel. */
export async function fetchBoldBindedTerminals(
  apiKey: string,
): Promise<BoldBindedTerminalsResponse> {
  const response = await apiClient.get<BoldBindedTerminalsResponse>(
    BOLD_BINDED_TERMINALS_ENDPOINT,
    { headers: { 'x-bold-api-key': apiKey } },
  )

  return response.data
}

export async function fetchBoldCashRegisters(
  companyId: string,
): Promise<ListBoldCashRegistersResponse> {
  const response = await apiClient.get<ListBoldCashRegistersResponse>(
    `${BOLD_CASH_REGISTERS_ENDPOINT}/${companyId}`,
  )

  return response.data
}

export async function saveBoldCashRegister(
  request: UpsertBoldCashRegisterRequest,
): Promise<UpsertBoldCashRegisterResponse> {
  const response = await apiClient.post<UpsertBoldCashRegisterResponse>(
    BOLD_CASH_REGISTERS_ENDPOINT,
    request,
  )

  return response.data
}

export async function updateIntegrationSubscription(
  companyId: string,
  provider: IntegrationProvider,
  request: UpdateIntegrationSubscriptionRequest,
): Promise<UpdateIntegrationSubscriptionResponse> {
  const response =
    await apiClient.patch<UpdateIntegrationSubscriptionResponse>(
      `${ADMIN_COMPANIES_ENDPOINT}/${companyId}/integrations/${provider}/subscription`,
      request,
    )

  return response.data
}
