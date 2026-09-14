import type {
  ImportSupportDocumentsResponse,
  SupportDocumentValidationReport,
} from '../../types/supportDocument'
import { adaptSupportDocumentsImportResponse } from '../../utils/normalizeSupportDocumentsResponse'
import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import type { DocumentSourceAdapter } from './types'
import { uploadMultipartFile } from './uploadMultipartFile'

const VALIDATE_ENDPOINT = '/invoices/support-documents/validate'
const IMPORT_ENDPOINT = '/invoices/support-documents/import'
// Cuántos motivos de error se listan en el mensaje — el reporte completo
// puede tener muchos documentos, no tiene sentido mandarlos todos al toast.
const MAX_VALIDATION_ERRORS_IN_MESSAGE = 5

function buildValidationErrorMessage(
  report: SupportDocumentValidationReport,
): string {
  const preview = report.errors
    .slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    .map((error) => `${error.reference}: ${error.reason}`)
    .join(' — ')
  const remaining = report.errors.length - MAX_VALIDATION_ERRORS_IN_MESSAGE

  return (
    `El Excel tiene ${report.invalidGroups} documento(s) inválido(s) de ${report.totalGroups}. ` +
    `Corrígelos y vuelve a intentar. ${preview}` +
    (remaining > 0 ? ` (y ${remaining} más)` : '')
  )
}

/** Pasada de validación rápida (sin tocar NextPyme/SIIGO) — tipo de
 * documento inválido, centro de costos que no existe en SIIGO. Se corre
 * ANTES de confirmar la importación: si hay documentos inválidos, se
 * rechaza acá con el detalle en vez de crear documentos que van a quedar
 * mal armados. */
async function validateSupportDocumentExcel(
  file: File,
): Promise<SupportDocumentValidationReport> {
  return uploadMultipartFile<SupportDocumentValidationReport>(
    VALIDATE_ENDPOINT,
    file,
  )
}

export const supportDocumentExcelSource: DocumentSourceAdapter = {
  type: DOCUMENT_SOURCE_TYPE.EXCEL,
  label: 'Excel Documento soporte',
  uploadEndpoint: IMPORT_ENDPOINT,
  upload: async (file, _options) => {
    const validation = await validateSupportDocumentExcel(file)

    if (validation.invalidGroups > 0) {
      throw new Error(buildValidationErrorMessage(validation))
    }

    const response = await uploadMultipartFile<ImportSupportDocumentsResponse>(
      IMPORT_ENDPOINT,
      file,
    )

    const adapted = adaptSupportDocumentsImportResponse(response)

    if (!adapted) {
      throw new Error(
        'No se pudo procesar la respuesta del archivo Excel de Documento soporte.',
      )
    }

    return {
      tableData: adapted,
      rawResponse: response,
    }
  },
}
