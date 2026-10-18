import { beforeEach, expect, it, vi } from 'vitest'
import { uploadInvoiceAttachment, fetchInvoiceAttachment, deleteInvoiceAttachment } from './invoiceAttachmentService'
import { apiClient } from './apiClient'

vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn(), get: vi.fn(), delete: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())
it('sube el archivo real como multipart con el tipo de documento', async () => {
  const file = new File(['%PDF-1.7'], 'soporte.pdf', { type: 'application/pdf' })
  const attachment = { name: file.name, mimeType: file.type, size: file.size }
  vi.mocked(apiClient.post).mockResolvedValue({ data: { attachment } })
  expect(await uploadInvoiceAttachment('draft-id', 'ELECTRONIC_INVOICE', file)).toEqual(attachment)
  const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
  expect(url).toBe('/integrations/jarvis/drafts/draft-id/attachment')
  expect(body).toBeInstanceOf(FormData)
  expect((body as FormData).get('documentKind')).toBe('ELECTRONIC_INVOICE')
  expect(await ((body as FormData).get('file') as File).text()).toBe('%PDF-1.7')
})
it.each([true, false])('recupera el contenido binario con la sesión autenticada: borrador=%s', async draft => {
  const blob = new Blob(['contenido'], { type: 'application/pdf' })
  vi.mocked(apiClient.get).mockResolvedValue({ data: blob })
  expect(await fetchInvoiceAttachment('id', draft)).toBe(blob)
  expect(apiClient.get).toHaveBeenCalledWith(`/integrations/jarvis/${draft ? 'drafts' : 'invoices'}/id/attachment`, expect.objectContaining({ responseType: 'blob' }))
})
it('elimina solo el archivo del borrador', async () => {
  await deleteInvoiceAttachment('draft')
  expect(apiClient.delete).toHaveBeenCalledWith('/integrations/jarvis/drafts/draft/attachment')
})
