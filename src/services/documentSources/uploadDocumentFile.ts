import type { DocumentUploadOptions } from '../../types/documentUpload'
import { uploadMultipartFile } from './uploadMultipartFile'

export async function uploadDocumentFile<TResponse = unknown>(
  endpoint: string,
  file: File,
  options: DocumentUploadOptions,
): Promise<TResponse> {
  return uploadMultipartFile<TResponse>(endpoint, file, {
    electronicDocumentType: options.electronicDocumentType,
  })
}
