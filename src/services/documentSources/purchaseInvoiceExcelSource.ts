import { apiClient } from '../apiClient'
import type {
  ImportSupportDocumentsResponse,
  PurchaseInvoiceImportStatus,
  PurchaseInvoiceValidationReport,
  StartPurchaseInvoiceImportResponse,
} from '../../types/supportDocument'
import { adaptSupportDocumentsImportResponse } from '../../utils/normalizeSupportDocumentsResponse'
import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import type { DocumentSourceAdapter } from './types'
import { uploadMultipartFile } from './uploadMultipartFile'
import {
  fetchPurchaseInvoiceImportJobStatus,
  startTracking,
  waitForTerminalStatus,
} from '../realtime/purchaseInvoiceImportJobsStore'

const VALIDATE_ENDPOINT = '/invoices/purchase-invoices/validate'
const IMPORT_ENDPOINT = '/invoices/purchase-invoices/import'
// Cuántos motivos de error se listan en el mensaje — el reporte completo
// puede tener cientos de filas, no tiene sentido mandarlas todas al toast.
const MAX_VALIDATION_ERRORS_IN_MESSAGE = 5

function buildValidationErrorMessage(
  report: PurchaseInvoiceValidationReport,
): string {
  const preview = report.errors
    .slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    .map((error) => `Fila ${error.rowIndex}: ${error.reason}`)
    .join(' — ')
  const remaining = report.errors.length - MAX_VALIDATION_ERRORS_IN_MESSAGE

  return (
    `El Excel tiene ${report.invalidRows} fila(s) inválida(s) de ${report.totalRows}. ` +
    `Corrígelas y vuelve a intentar. ${preview}` +
    (remaining > 0 ? ` (y ${remaining} más)` : '')
  )
}

/** Pasada de validación rápida (sin tocar NextPyme/SIIGO) — campos
 * faltantes, CUFEs duplicados, formato de NIT. Se corre ANTES de confirmar
 * la importación: si hay filas inválidas, se rechaza acá con el detalle en
 * vez de arrancar un job que va a fallar de todos modos. */
async function validatePurchaseInvoiceExcel(
  file: File,
): Promise<PurchaseInvoiceValidationReport> {
  return uploadMultipartFile<PurchaseInvoiceValidationReport>(
    VALIDATE_ENDPOINT,
    file,
  )
}

export async function retryFailedPurchaseInvoiceImportRows(
  jobId: string,
): Promise<PurchaseInvoiceImportStatus> {
  const response = await apiClient.post<PurchaseInvoiceImportStatus>(
    `/invoices/purchase-invoices/import-jobs/${jobId}/retry-failed`,
  )

  // El job vuelve a 'running' en el backend — se retoma el tracking en vivo
  // exactamente igual que un import nuevo, solo que sobre el mismo jobId.
  startTracking(jobId, response.data.totalRows)

  return response.data
}

export const purchaseInvoiceExcelSource: DocumentSourceAdapter = {
  type: DOCUMENT_SOURCE_TYPE.EXCEL,
  label: 'Excel Factura de compra DIAN',
  uploadEndpoint: IMPORT_ENDPOINT,
  upload: async (file) => {
    // 1) VALIDACIÓN PREVIA: antes de tocar NextPyme/SIIGO, se revisa el
    // Excel completo (CUFEs faltantes/duplicados, NIT con formato inválido,
    // nombre de emisor faltante) y se le devuelve el reporte al usuario sin
    // ejecutar nada si hay filas inválidas.
    const validation = await validatePurchaseInvoiceExcel(file)

    if (validation.invalidRows > 0) {
      throw new Error(buildValidationErrorMessage(validation))
    }

    // 2) El job arranca en el backend (estado "pending" → "running") y esta
    // llamada responde de inmediato con el jobId — el procesamiento real
    // corre asíncrono en el servidor, en una cola de trabajos durable (no
    // se pierde si el servidor se reinicia a mitad de camino).
    const { jobId, totalRows } =
      await uploadMultipartFile<StartPurchaseInvoiceImportResponse>(
        IMPORT_ENDPOINT,
        file,
      )

    // Se registra en el store global ANTES de esperar nada más — así el
    // badge persistente (en AppLayout) y cualquier otra pantalla ya lo ven
    // como "en curso" aunque el usuario cierre este modal o navegue a otro
    // lado antes de que termine.
    startTracking(jobId, totalRows)

    // 3) Progreso en vivo por WebSocket (con un refresh REST de respaldo
    // cada tanto, ver waitForTerminalStatus) en vez de un polling fijo cada
    // 2s — esta promesa sigue resolviendo una sola vez al final, para no
    // romper el contrato de DocumentSourceAdapter.upload.
    const jobState = await waitForTerminalStatus(jobId)
    const finalStatus =
      jobState.finalStatus ?? (await fetchPurchaseInvoiceImportJobStatus(jobId))

    if (finalStatus.status === 'error') {
      throw new Error(
        finalStatus.validation
          ? buildValidationErrorMessage(finalStatus.validation)
          : (finalStatus.errorMessage ??
              'No se pudo importar el Excel de Factura de compra.'),
      )
    }

    const response: Partial<ImportSupportDocumentsResponse> = {
      processedRows: finalStatus.processedRows,
      itemsTotal: finalStatus.itemsTotal ?? 0,
      documentsCreated: finalStatus.documentsCreated ?? 0,
      documentIds: finalStatus.documentIds ?? [],
      records: finalStatus.records ?? [],
    }

    const adapted = adaptSupportDocumentsImportResponse(response)

    if (!adapted) {
      throw new Error(
        'No se pudo procesar la respuesta del Excel de Factura de compra.',
      )
    }

    return {
      tableData: adapted,
      rawResponse: {
        ...response,
        jobId,
        errorCount: finalStatus.errorCount,
        successCount: finalStatus.successCount,
        failedRows: finalStatus.failedRows.map((row) => ({
          cufe: row.cufe,
          issuerNit: row.issuerNit,
          issuerName: row.issuerName,
          error: row.errorMessage,
        })),
      },
    }
  },
}
