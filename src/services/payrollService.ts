import { apiClient } from './apiClient'
import { cachedQuery, companyQueryKey, invalidateQueryCache, peekCachedQuery, QUERY_STALE_MS, setCachedQuery } from './queryCache'
import type { PayrollLine } from '../utils/payrollDomain'
import type {
  CreatePayrollPeriodRequest,
  PayrollPeriodicity,
} from '../utils/payrollPeriod'
export interface Employee {
  id: string
  identification: string
  documentTypeId: number
  firstName: string
  secondName: string
  surname: string
  secondSurname: string
  typeWorkerId: number
  subTypeWorkerId: number
  contractType: string
  positionId: string
  admittanceDate: string
  retirementDate: string
  salary: string
  integralSalary: boolean
  highRiskPension: boolean
  active: boolean
  paymentMethodId: number
  jarvisPaymentMethodId?: string
  paymentMethodName?: string
  bankName: string
  accountType: string
  accountNumber: string
  apprenticeMode: string
  apprenticeStage: string
  universityStudent: boolean
  stageStart: string
  stageEnd: string
}
export interface Concept {
  code: string
  name: string
  kind: 'accrued' | 'deduction'
  category: string
  factor: string
  percentage: string
  base: string
  salaried: boolean
  active: boolean
  calculationMode?: 'total' | 'additional'
}
export interface Parameters {
  validFrom: string
  minimumSalary: string
  transportAllowance: string
  weeklyHours: string
  monthlyHours: string
  monthlyDays: string
  nightStart: string
  paymentMethodId: number
  jarvisPaymentMethodId?: string
  paymentMethodName?: string
  concepts: Concept[]
}
export interface Position {
  id: string
  code: string
  name: string
  salary: string
  active: boolean
}
export interface PayrollSettings {
  environment: number
  prefix: string
  enabled: boolean
}
export interface PayrollState {
  payrollName?: string
  payrollGroupId?: string
  periodicity?: PayrollPeriodicity
  employeeId: string
  period: string
  startDate: string
  endDate: string
  issueDate: string
  workedDays: string
  paymentDates: string[]
  lines: PayrollLine[]
  originalId?: string
  noteType?: number
}
export interface PayrollDocument {
  id: string
  employeeId: string
  originalId: string | null
  state: PayrollState
  employee: Employee
  status: string
  number: string | null
  prefix: string | null
  cune: string | null
  accrued: string
  deductions: string
  net: string
  updatedAt: string
}
export interface PayrollDetail {
  id: string
  state: PayrollState
  status: string
  employee_snapshot: Employee
  parameter_snapshot: Parameters
  cune: string | null
  number: string | null
  prefix: string | null
  files: { kind: 'pdf' | 'xml'; filename: string }[]
  transmissions: {
    id: string
    request: unknown
    response: unknown
    validation: unknown
    error: string | null
    created_at: string
  }[]
}
export interface PayrollBootstrap {
  employees: Employee[]
  positions: Position[]
  parameters: { id: string; validFrom: string; data: Parameters }[]
  settings: PayrollSettings
  nextNumber: string
}
export interface PayrollWorkerCatalogs {
  workerTypes: { id: number; name: string; code?: string }[]
  workerSubtypes: { id: number; name: string; code?: string }[]
  paymentMethods?: { id: number; name: string; code?: string }[]
  identifications?: { id: number; name: string; code?: string }[]
}
export interface PayrollPaymentMethod {
  id: string
  name: string
  nextpymeMethodId: number
  nextpymeMethodName: string
  systemKey: 'cash' | 'transfer' | null
}
export interface PayrollPaymentMethodsList { items: PayrollPaymentMethod[]; total: number }
export const payrollPaymentMethodsQueryKey = () => companyQueryKey(['payroll', 'payment-methods'])
export const peekPayrollPaymentMethods = () => peekCachedQuery<PayrollPaymentMethodsList>(payrollPaymentMethodsQueryKey())
const root = '/integrations/jarvis/payroll'
export const payrollService = {
  paymentMethods: (options?: { force?: boolean }) => cachedQuery(payrollPaymentMethodsQueryKey(), QUERY_STALE_MS.catalogs,
    async () => (await apiClient.get<PayrollPaymentMethodsList>(`${root}/payment-methods`)).data, options),
  createPaymentMethod: async (request: { name: string; base: 'cash' | 'transfer' }) => {
    const key = payrollPaymentMethodsQueryKey()
    const created = (await apiClient.post<{ paymentMethod: PayrollPaymentMethod }>(`${root}/payment-methods`, request)).data.paymentMethod
    const previous = peekCachedQuery<PayrollPaymentMethodsList>(key)
    if (previous) {
      const items = [...previous.items.filter(method => method.id !== created.id), created]
      setCachedQuery(key, { items, total: items.length })
    } else invalidateQueryCache(key)
    return created
  },
  createPeriod: async (id: string, request: CreatePayrollPeriodRequest) =>
    (
      await apiClient.put<{ id: string; key: string; documentIds: string[] }>(
        `${root}/periods/${id}`,
        request,
      )
    ).data,
  workerCatalogs: async () =>
    (await apiClient.get<PayrollWorkerCatalogs>(`${root}/catalogs`)).data,
  bootstrap: async () =>
    (await apiClient.get<PayrollBootstrap>(`${root}/bootstrap`)).data,
  employees: async (employee: Employee) =>
    (await apiClient.put(`${root}/employees/${employee.id}`, employee)).data,
  position: async (position: Position) =>
    (await apiClient.put(`${root}/positions/${position.id}`, position)).data,
  parameters: async (parameters: Parameters) =>
    (await apiClient.post(`${root}/parameters`, parameters)).data,
  settings: async (settings: PayrollSettings) =>
    (await apiClient.put(`${root}/settings`, settings)).data,
  environment: async () => (await apiClient.post(`${root}/environment`)).data,
  list: async (period?: string) =>
    (
      await apiClient.get<PayrollDocument[]>(`${root}/documents`, {
        params: { period },
      })
    ).data,
  get: async (id: string) =>
    (await apiClient.get<PayrollDetail>(`${root}/documents/${id}`)).data,
  save: async (id: string, state: PayrollState) =>
    (await apiClient.put(`${root}/documents/${id}`, state)).data,
  validate: async (id: string) =>
    (
      await apiClient.post<{ valid: boolean; errors: string[] }>(
        `${root}/documents/${id}/validate`,
      )
    ).data,
  send: async (id: string) =>
    (await apiClient.post<PayrollDetail>(`${root}/documents/${id}/send`)).data,
  status: async (id: string) =>
    (await apiClient.post<PayrollDetail>(`${root}/documents/${id}/status`))
      .data,
  download: async (id: string, kind: 'pdf' | 'xml') =>
    (
      await apiClient.get<Blob>(`${root}/documents/${id}/files/${kind}`, {
        responseType: 'blob',
      })
    ).data,
}
