import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  startTracking: vi.fn(),
  wait: vi.fn(),
  status: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('../apiClient', () => ({
  apiClient: { post: mocks.post },
  API_BASE_URL: '',
}))
vi.mock('../realtime/purchaseInvoiceImportJobsStore', () => ({
  startTracking: mocks.startTracking,
  waitForTerminalStatus: mocks.wait,
  fetchPurchaseInvoiceImportJobStatus: mocks.status,
}))
vi.mock('./uploadMultipartFile', () => ({ uploadMultipartFile: mocks.upload }))
import {
  importPurchaseInvoiceByCufe,
  purchaseInvoiceExcelSource,
} from './purchaseInvoiceExcelSource'
import {
  PURCHASE_INVOICE_WORKSPACE,
  JARVIS_PURCHASE_INVOICE_WORKSPACE,
  SUPPORT_DOCUMENT_WORKSPACE,
} from '../../constants/documentWorkspaceConfig'

const cufe = 'a'.repeat(96)
const completed = {
  status: 'completed',
  processedRows: 1,
  totalRows: 1,
  documentsCreated: 1,
  documentsReused: 0,
  documentIds: ['invoice'],
  records: [],
  itemsTotal: 1,
  successCount: 1,
  errorCount: 0,
  failedRows: [],
}
describe('Importar compras por CUFE o Excel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.post.mockResolvedValue({ data: { jobId: 'job', totalRows: 1 } })
    mocks.wait.mockResolvedValue({ finalStatus: completed })
  })
  it('envía un CUFE normalizado y utiliza el seguimiento común de importación', async () => {
    const result = await importPurchaseInvoiceByCufe(
      ' ' + cufe.toUpperCase() + ' ',
    )
    expect(mocks.post).toHaveBeenCalledWith(
      '/invoices/purchase-invoices/import-cufe',
      { cufe },
    )
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.startTracking).toHaveBeenCalledWith('job', 1)
    expect(result.rawResponse).toEqual(
      expect.objectContaining({
        jobId: 'job',
        documentIds: ['invoice'],
        documentsCreated: 1,
      }),
    )
  })
  it.each(['', 'invalid', 'g'.repeat(96)])(
    'rechaza un CUFE inválido antes de consultar la API',
    async (value) => {
      await expect(importPurchaseInvoiceByCufe(value)).rejects.toThrow(
        'CUFE válido',
      )
      expect(mocks.post).not.toHaveBeenCalled()
    },
  )
  it('conserva errores y el trabajo para reintentar una consulta fallida', async () => {
    mocks.wait.mockResolvedValue({
      finalStatus: {
        ...completed,
        documentsCreated: 0,
        documentIds: [],
        successCount: 0,
        errorCount: 1,
        failedRows: [
          {
            cufe,
            issuerNit: '',
            issuerName: '',
            errorMessage: 'No se encontró la factura',
          },
        ],
      },
    })
    const result = await PURCHASE_INVOICE_WORKSPACE.importCufe!(cufe)
    expect(result).toEqual(
      expect.objectContaining({
        jobId: 'job',
        errorCount: 1,
        documentIds: [],
        documentCount: 0,
        failedRows: [
          expect.objectContaining({ cufe, error: 'No se encontró la factura' }),
        ],
      }),
    )
  })
  it('reporta documentos reutilizados sin perder sus identificadores', async () => {
    mocks.wait.mockResolvedValue({
      finalStatus: { ...completed, documentsCreated: 0, documentsReused: 1 },
    })
    expect(await PURCHASE_INVOICE_WORKSPACE.importCufe!(cufe)).toEqual(
      expect.objectContaining({
        documentCount: 0,
        documentIds: ['invoice'],
        documentsReused: 1,
      }),
    )
  })
  it('ofrece CUFE solo en las compras de SIIGO', () => {
    expect(PURCHASE_INVOICE_WORKSPACE.importCufe).toBeTypeOf('function')
    expect(JARVIS_PURCHASE_INVOICE_WORKSPACE.importCufe).toBeUndefined()
    expect(SUPPORT_DOCUMENT_WORKSPACE.importCufe).toBeUndefined()
  })
  it('el Excel mantiene la validación previa, carga multipart y seguimiento comunes', async () => {
    mocks.upload
      .mockResolvedValueOnce({ invalidRows: 0 })
      .mockResolvedValueOnce({ jobId: 'excel-job', totalRows: 1 })
    await purchaseInvoiceExcelSource.upload({ name: 'facturas.xlsx' } as File, {
      provider: 'SIIGO', electronicDocumentType: 'PURCHASE_INVOICE',
    })
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.upload.mock.calls.map((call) => call[0])).toEqual([
      '/invoices/purchase-invoices/validate',
      '/invoices/purchase-invoices/import',
    ])
    expect(mocks.startTracking).toHaveBeenCalledWith('excel-job', 1)
  })
})
