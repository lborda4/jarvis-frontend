import { assignSupportDraftIds, downloadSupportImportTemplate, fetchSupportImportCatalogs, saveImportedSupportDocuments } from './supportDocumentsImportService'
import type { SalesInvoiceImportRow } from '../utils/salesInvoicesExcel'

export { MissingSupportSuppliersError as MissingSalesCustomersError } from './supportDocumentsImportService'
export const fetchSalesImportCatalogs = () => fetchSupportImportCatalogs('sales')
export const downloadSalesImportTemplate = () => downloadSupportImportTemplate('sales')
export const assignSalesDraftIds = (rows: SalesInvoiceImportRow[], company: string | null) => assignSupportDraftIds(rows, company, 'sales')
export const saveImportedSalesInvoices = (rows: SalesInvoiceImportRow[], onProgress: (row: SalesInvoiceImportRow) => void) => saveImportedSupportDocuments(rows, onProgress, 'sales')
