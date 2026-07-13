import { getApiErrorMessage } from './apiClient'

export function getUploadInvoiceErrorMessage(error: unknown): string {
  return getApiErrorMessage(
    error,
    'Ocurrió un error inesperado al procesar el archivo.',
  )
}
