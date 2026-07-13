import axios from 'axios'
import { apiClient } from '../apiClient'

export async function uploadMultipartFile<TResponse = unknown>(
  endpoint: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<TResponse> {
  const formData = new FormData()
  formData.append('file', file)

  Object.entries(fields).forEach(([key, value]) => {
    if (value.trim()) {
      formData.append(key, value)
    }
  })

  console.log('[Upload] Enviando request:', {
    method: 'POST',
    url: endpoint,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fields,
  })

  try {
    const response = await apiClient.post<TResponse>(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    console.log('[Upload] Respuesta exitosa:', {
      url: endpoint,
      status: response.status,
      data: response.data,
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[Upload] Error en la petición:', {
        url: endpoint,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        fileName: file.name,
      })
    } else {
      console.error('[Upload] Error inesperado:', error)
    }

    throw error
  }
}
