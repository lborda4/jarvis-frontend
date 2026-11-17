import { apiClient } from './apiClient'
import { cachedQuery, companyQueryKey, invalidateQueryCache, peekCachedQuery, QUERY_STALE_MS, setCachedQuery } from './queryCache'
import type { PayrollLine } from '../utils/payrollDomain'
import type {
  CreatePayrollPeriodRequest,
  PayrollPeriodicity,
} from '../utils/payrollPeriod'
export interface Employee {
  id: string
  /** Consecutivo asignado por el servidor al guardar; se conserva al editar. */
  workerCode?: string
  identification: string
  documentTypeId: number
  firstName: string
  secondName: string
  surname: string
  secondSurname: string
  /** Opcional para mantener compatibles los empleados guardados antes de solicitar correo. */
  email?: string
  address?: string
  municipalityId?: number
  typeWorkerId: number
  subTypeWorkerId: number
  contractType: string
  typeContractId?: number
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
  readonly prefix: string
  enabled: boolean
}
export interface PayrollState {
  notes?: string
  headNote?: string
  footNote?: string
  epsTypeLawDeductionsId?: number
  pensionTypeLawDeductionsId?: number
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
  adjustmentTargetId?: string | null
  adjustment?: { id: string; status: string; noteType: number; number: string | null; prefix: string | null }
  sourceVersion?: string
  sourceStatus?: string
  monthlySubmission?: { id: string; status: string; cune: string | null; number: string | null; prefix: string | null }
  submissionErrors?: string[]
  id: string
  canDelete?: boolean
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
  updated_at?: string
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
export interface PayrollPayslipRecipient {
  id: string
  name: string
  identification: string
  email: string
  canEmail: boolean
}
export interface PayrollBootstrap {
  employees: Employee[]
  positions: Position[]
  parameters: { id: string; validFrom: string; data: Parameters }[]
  settings: PayrollSettings
  nextNumber: string
}
export interface PayrollWorkerCatalogs {
  contractTypes?: { key: string; id: number; name: string; code?: string | null }[]
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
  overtimeSurcharges: async () =>
    (await apiClient.get<{ id: number; name: string; code?: string | null }[]>(`${root}/overtime-surcharges`)).data,
  disabilityTypes: async () =>
    (await apiClient.get<{ id: number; name: string; code?: string | null }[]>(`${root}/disability-types`)).data,
  lawDeductions: async () =>
    (await apiClient.get<{ id: number; name: string; code?: string | null }[]>(`${root}/law-deductions`)).data,
  bootstrap: async () =>
    (await apiClient.get<PayrollBootstrap>(`${root}/bootstrap`)).data,
  employees: async (employee: Employee) =>
    (await apiClient.put(`${root}/employees/${employee.id}`, { ...employee, highRiskPension: false })).data,
  position: async (position: Position) =>
    (await apiClient.put(`${root}/positions/${position.id}`, position)).data,
  deletePosition: async (id: string) =>
    (await apiClient.delete(`${root}/positions/${id}`)).data,
  parameters: async (parameters: Parameters) =>
    (await apiClient.post(`${root}/parameters`, parameters)).data,
  list: async (period?: string) =>
    (
      await apiClient.get<PayrollDocument[]>(`${root}/documents`, {
        params: { period },
      })
    ).data,
  get: async (id: string) =>
    (await apiClient.get<PayrollDetail>(`${root}/documents/${id}`)).data,
  prepareAdjustment: async (originalId: string, id: string, request: {
    noteType: 1 | 2; state: PayrollState; originalUpdatedAt: string; updatedAt?: string
  }) => (await apiClient.put<PayrollDetail>(`${root}/documents/${originalId}/adjustments/${id}`, request, { timeout: 90_000 })).data,
  deleteDocument: async (id: string) =>
    (await apiClient.delete(`${root}/documents/${id}`)).data,
  save: async (id: string, state: PayrollState, options?: { validation: 'provider' }) =>
    (await apiClient.put(`${root}/documents/${id}`, state, options ? { params: options } : undefined)).data,
  saveBatch: async (documents: Array<{ id: string; state: PayrollState; updatedAt: string }>) =>
    (await apiClient.put(`${root}/documents`, { documents }, { timeout: 120_000 })).data,
  payslipRecipients: async (ids: string[]) =>
    (await apiClient.post<PayrollPayslipRecipient[]>(`${root}/payslips/recipients`, { ids })).data,
  payslipPdf: async (id: string) =>
    (await apiClient.get<Blob>(`${root}/payslips/${encodeURIComponent(id)}/pdf`, { responseType: 'blob', timeout: 120_000 })).data,
  payslipZip: async (ids: string[]) =>
    (await apiClient.post<Blob>(`${root}/payslips/zip`, { ids }, { responseType: 'blob', timeout: 120_000 })).data,
  emailPayslip: async (id: string, requestId: string) =>
    (await apiClient.post<{ sent: boolean }>(`${root}/payslips/${encodeURIComponent(id)}/email`, { requestId }, { timeout: 30_000 })).data,
  send: async (id: string) =>
    (await apiClient.post<PayrollDetail>(`${root}/documents/${id}/send`)).data,
  sendMonthlyEmployee: async (month: string, employeeId: string, documents: PayrollDocument[]) =>
    (await apiClient.post<PayrollDetail>(`${root}/months/${month}/employees/${employeeId}/send`, {
      sources: documents.map(document => ({ id: document.id, updatedAt: document.updatedAt, ...(document.sourceVersion ? { version: document.sourceVersion } : {}) })),
    }, { timeout: 90_000 })).data,
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
