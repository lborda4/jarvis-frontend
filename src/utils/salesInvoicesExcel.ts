import type { JarvisTercero } from '../types/jarvis'
import { createSupportDocumentsTemplate, readSupportDocumentsWorkbook, resolveSupportSuppliers, type SupportImportCatalogs, type SupportImportRow } from './supportDocumentsExcel'

export { SUPPORT_IMPORT_LIMIT as SALES_IMPORT_LIMIT, SUPPORT_IMPORT_MAX_BYTES as SALES_IMPORT_MAX_BYTES, SALES_INVOICE_EXCEL_COLUMNS, supportSupplierKey as salesCustomerKey } from './supportDocumentsExcel'
export type SalesInvoiceImportRow = SupportImportRow
export type SalesInvoiceImportCatalogs = SupportImportCatalogs
export const SALES_TEMPLATE_FILENAME = 'plantilla-facturas-venta-jarvis.xlsx'
export const createSalesInvoicesTemplate = (catalogs?: SalesInvoiceImportCatalogs) => createSupportDocumentsTemplate(catalogs, 'sales')
export const readSalesInvoicesWorkbook = (buffer: ArrayBuffer, catalogs: SalesInvoiceImportCatalogs, customers: JarvisTercero[]) => readSupportDocumentsWorkbook(buffer, catalogs, customers, 'sales')
export const resolveSalesCustomers = (rows: SalesInvoiceImportRow[], customers: JarvisTercero[]) => resolveSupportSuppliers(rows, customers, 'sales')
