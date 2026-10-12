import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { sendJarvisDocumentEmail } from './jarvisService'

vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('reenvía el documento existente con los destinatarios adicionales y el mensaje', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } })
  const request = { additionalEmails: ['contabilidad@empresa.com'], message: 'Hola, adjuntamos la nota.' }
  expect(await sendJarvisDocumentEmail('note-1', request)).toEqual({ success: true })
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/invoices/note-1/send-email', request)
})

it('propaga los errores de envío', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Servicio no disponible'))
  await expect(sendJarvisDocumentEmail('note-1', { additionalEmails: [], message: '' })).rejects.toThrow('Servicio no disponible')
})
