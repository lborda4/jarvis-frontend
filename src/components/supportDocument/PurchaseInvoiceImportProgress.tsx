import { usePurchaseInvoiceImportJob } from '../../hooks/usePurchaseInvoiceImportJobs'
import '../supportDocument/ImportLoadingOverlay.css'
import './PurchaseInvoiceImportProgress.css'

interface PurchaseInvoiceImportProgressProps {
  jobId: string | null
}

/** Reemplaza el loader indefinido (puntos animados) para Factura de compra
 * por un progreso real, alimentado por WebSocket — a diferencia de
 * ImportLoadingOverlay, el proceso sigue corriendo en el backend aunque se
 * cierre esta pantalla, así que el hint ya no advierte "no cierres la
 * pestaña". */
function PurchaseInvoiceImportProgress({
  jobId,
}: PurchaseInvoiceImportProgressProps) {
  const job = usePurchaseInvoiceImportJob(jobId)

  const processedRows = job?.processedRows ?? 0
  const totalRows = job?.totalRows ?? null
  const progressPercent = job?.progressPercent ?? 0
  const successCount = job?.successCount ?? 0
  const errorCount = job?.errorCount ?? 0

  return (
    <div
      className="import-loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="import-loading-overlay__card">
        <span className="import-loading-overlay__spinner" aria-hidden="true" />
        <strong className="import-loading-overlay__title">
          Importando Excel
        </strong>

        <div className="purchase-invoice-import-progress__bar-track">
          <div
            className="purchase-invoice-import-progress__bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="purchase-invoice-import-progress__counter">
          {totalRows != null
            ? `${processedRows} de ${totalRows} documentos procesados`
            : 'Preparando la importación…'}
        </span>

        {(successCount > 0 || errorCount > 0) && (
          <span className="purchase-invoice-import-progress__breakdown">
            {successCount} exitosas
            {errorCount > 0 ? ` · ${errorCount} con error` : ''}
          </span>
        )}

        <p className="import-loading-overlay__hint">
          Puedes cerrar esta pantalla o navegar a otra — la importación sigue
          en el servidor y te avisamos cuando termine.
        </p>
      </div>
    </div>
  )
}

export default PurchaseInvoiceImportProgress
