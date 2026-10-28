import { apiClient } from './apiClient'

export type JarvisReportType = 'sales' | 'customers' | 'products' | 'sellers' | 'taxes'
export interface JarvisReportFilters {
  report: JarvisReportType
  view: 'summary' | 'detail'
  from: string
  to: string
  customer: string
  search?: string
  seller: string
  product: string
  kind: string
  currency: string
  page: number
  pageSize: number
}
export type JarvisReportRow = Record<string, string | number | null>
export interface JarvisReportColumn { key: string; label: string; format: 'text' | 'money' | 'number' | 'percent' }
export interface JarvisReportResult {
  filters: JarvisReportFilters
  columns: JarvisReportColumn[]
  items: JarvisReportRow[]
  total: number
  page: number
  pageSize: number
  totals: JarvisReportRow[]
  warnings: string[]
}
const endpoint = '/integrations/jarvis/reports'
export async function fetchJarvisReport(filters: JarvisReportFilters, signal?: AbortSignal): Promise<JarvisReportResult> {
  return (await apiClient.get<JarvisReportResult>(endpoint, { params: filters, signal, timeout: 120000 })).data
}
export async function exportJarvisReport(filters: JarvisReportFilters): Promise<Blob> {
  const params = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'page' && key !== 'pageSize'))
  return (await apiClient.get<Blob>(`${endpoint}/export`, { params, responseType: 'blob', timeout: 180000 })).data
}
