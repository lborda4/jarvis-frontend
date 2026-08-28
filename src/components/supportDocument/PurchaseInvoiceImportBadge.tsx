import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useActivePurchaseInvoiceImportJobs,
  useFinishedPurchaseInvoiceImportJobs,
} from '../../hooks/usePurchaseInvoiceImportJobs'
import { dismissJob } from '../../services/realtime/purchaseInvoiceImportJobsStore'
import './PurchaseInvoiceImportBadge.css'

const PURCHASE_INVOICE_ROUTE_PATH = '/factura-compra'
const AUTO_DISMISS_DELAY_MS = 5000

/** Indicador persistente en el layout (no se desmonta al navegar entre
 * pantallas) de que hay una importación de Factura de compra corriendo en
 * el servidor, y aviso cuando termina — para que el usuario no dependa de
 * quedarse parado en la pantalla de importación esperando. */
function PurchaseInvoiceImportBadge() {
  const navigate = useNavigate()
  const activeJobs = useActivePurchaseInvoiceImportJobs()
  const finishedJobs = useFinishedPurchaseInvoiceImportJobs()
  // jobId -> timer del auto-descarte. En un Map por fuera del efecto (no en
  // el cleanup de este mismo efecto) porque `finishedJobs` cambia de
  // referencia en CADA actualización del store (incluso por el progreso de
  // otro job activo, ver createFilteredJobsSelector) — si el timer se
  // programara y cancelara dentro del mismo efecto, un job con timer ya
  // corriendo lo perdería cada vez que llega cualquier otra actualización,
  // sin llegar nunca a los 5s.
  const dismissTimersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    for (const job of finishedJobs) {
      if (dismissTimersRef.current.has(job.jobId)) {
        continue
      }

      const timerId = window.setTimeout(() => {
        dismissTimersRef.current.delete(job.jobId)
        dismissJob(job.jobId)
      }, AUTO_DISMISS_DELAY_MS)

      dismissTimersRef.current.set(job.jobId, timerId)
    }
  }, [finishedJobs])

  // Limpieza solo al desmontar el badge (no en cada render) — para no
  // cancelar timers de jobs que siguen pendientes de auto-descartar.
  useEffect(() => {
    const timers = dismissTimersRef.current

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId))
      timers.clear()
    }
  }, [])

  if (activeJobs.length === 0 && finishedJobs.length === 0) {
    return null
  }

  return (
    <div className="purchase-invoice-import-badge__container">
      {activeJobs.map((job) => (
        <button
          key={job.jobId}
          type="button"
          className="purchase-invoice-import-badge purchase-invoice-import-badge--active"
          onClick={() => navigate(PURCHASE_INVOICE_ROUTE_PATH)}
        >
          <span
            className="purchase-invoice-import-badge__spinner"
            aria-hidden="true"
          />
          <span>
            Importando facturas: {job.processedRows}
            {job.totalRows != null ? ` de ${job.totalRows}` : ''}
          </span>
        </button>
      ))}

      {finishedJobs.map((job) => (
        <div
          key={job.jobId}
          className={`purchase-invoice-import-badge purchase-invoice-import-badge--${job.status === 'error' ? 'error' : 'done'}`}
        >
          <button
            type="button"
            className="purchase-invoice-import-badge__label"
            onClick={() => navigate(PURCHASE_INVOICE_ROUTE_PATH)}
          >
            {job.status === 'error'
              ? 'La importación de facturas terminó con errores'
              : `Importación finalizada: ${job.successCount} exitosas${job.errorCount > 0 ? `, ${job.errorCount} con error` : ''}`}
          </button>
          <button
            type="button"
            className="purchase-invoice-import-badge__dismiss"
            aria-label="Descartar aviso"
            onClick={() => dismissJob(job.jobId)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default PurchaseInvoiceImportBadge
