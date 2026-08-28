import { useCallback, useSyncExternalStore } from 'react'
import {
  getActiveJobsSnapshot,
  getFinishedJobsSnapshot,
  getSnapshot,
  subscribe,
} from '../services/realtime/purchaseInvoiceImportJobsStore'
import type { PurchaseInvoiceImportJobState } from '../types/purchaseInvoiceImportRealtime'

/** Estado en vivo de un job puntual — null si todavía no se conoce (por
 * ejemplo, antes de que importPurchaseInvoicesFromExcel devuelva el jobId). */
export function usePurchaseInvoiceImportJob(
  jobId: string | null,
): PurchaseInvoiceImportJobState | null {
  const getJobSnapshot = useCallback(
    () => (jobId ? (getSnapshot().jobs[jobId] ?? null) : null),
    [jobId],
  )

  return useSyncExternalStore(subscribe, getJobSnapshot)
}

/** Job más reciente que arrancó `startTracking` — usado por la pantalla de
 * Factura de compra para mostrar progreso en vivo mientras
 * config.importFile(file) sigue pendiente, ya que el jobId recién se
 * conoce a mitad de esa promesa (después del POST de import), no al
 * arrancar el upload. */
export function useLatestPurchaseInvoiceImportJob(): PurchaseInvoiceImportJobState | null {
  const getLatestJobSnapshot = useCallback(() => {
    const { lastStartedJobId, jobs } = getSnapshot()
    return lastStartedJobId ? (jobs[lastStartedJobId] ?? null) : null
  }, [])

  return useSyncExternalStore(subscribe, getLatestJobSnapshot)
}

/** Jobs todavía activos (pending/running) — para el badge persistente del
 * layout, que debe verse sin importar en qué pantalla esté el usuario. */
export function useActivePurchaseInvoiceImportJobs(): PurchaseInvoiceImportJobState[] {
  return useSyncExternalStore(subscribe, getActiveJobsSnapshot)
}

/** Jobs que acaban de terminar (completed/error) y siguen sin descartar —
 * para mostrar un aviso "Importación finalizada" aunque el usuario ya esté
 * en otra pantalla. */
export function useFinishedPurchaseInvoiceImportJobs(): PurchaseInvoiceImportJobState[] {
  return useSyncExternalStore(subscribe, getFinishedJobsSnapshot)
}
