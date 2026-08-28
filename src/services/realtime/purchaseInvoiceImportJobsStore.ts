import { apiClient } from '../apiClient'
import {
  ensurePurchaseInvoiceImportSocketConnected,
  getPurchaseInvoiceImportSocket,
} from './purchaseInvoiceImportSocket'
import type { PurchaseInvoiceImportStatus } from '../../types/supportDocument'
import type {
  PurchaseInvoiceImportJobState,
  PurchaseInvoiceImportProgressEvent,
  PurchaseInvoiceImportRowResultEvent,
} from '../../types/purchaseInvoiceImportRealtime'

const ACTIVE_JOB_ID_STORAGE_KEY = 'purchaseInvoiceImport.activeJobId'

interface StoreState {
  jobs: Record<string, PurchaseInvoiceImportJobState>
  lastStartedJobId: string | null
}

let state: StoreState = { jobs: {}, lastStartedJobId: null }
const listeners = new Set<() => void>()
let socketListenersRegistered = false

function notify(): void {
  for (const listener of listeners) listener()
}

function setState(updater: (current: StoreState) => StoreState): void {
  state = updater(state)
  notify()
}

function buildInitialJobState(
  jobId: string,
  totalRows: number | null,
): PurchaseInvoiceImportJobState {
  return {
    jobId,
    status: 'pending',
    processedRows: 0,
    totalRows,
    successCount: 0,
    errorCount: 0,
    progressPercent: totalRows === 0 ? 100 : null,
    errorMessage: null,
    rowResultsByIndex: {},
    finalStatus: null,
  }
}

function patchJob(
  jobId: string,
  patch: Partial<PurchaseInvoiceImportJobState>,
): void {
  setState((current) => {
    const existing = current.jobs[jobId] ?? buildInitialJobState(jobId, null)

    return {
      ...current,
      jobs: {
        ...current.jobs,
        [jobId]: { ...existing, ...patch },
      },
    }
  })
}

function applyStatusDto(jobId: string, dto: PurchaseInvoiceImportStatus): void {
  patchJob(jobId, {
    status: dto.status,
    processedRows: dto.processedRows,
    totalRows: dto.totalRows,
    successCount: dto.successCount,
    errorCount: dto.errorCount,
    progressPercent: dto.progressPercent,
    errorMessage: dto.errorMessage,
    finalStatus: dto.status === 'completed' || dto.status === 'error' ? dto : null,
  })

  if (dto.status === 'completed' || dto.status === 'error') {
    clearActiveJobIdIfMatches(jobId)
  }
}

function clearActiveJobIdIfMatches(jobId: string): void {
  try {
    if (window.localStorage.getItem(ACTIVE_JOB_ID_STORAGE_KEY) === jobId) {
      window.localStorage.removeItem(ACTIVE_JOB_ID_STORAGE_KEY)
    }
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.) — no es
    // crítico, solo se pierde la persistencia entre recargas.
  }
}

export async function fetchPurchaseInvoiceImportJobStatus(
  jobId: string,
): Promise<PurchaseInvoiceImportStatus> {
  const response = await apiClient.get<PurchaseInvoiceImportStatus>(
    `/invoices/purchase-invoices/import-jobs/${jobId}/status`,
  )
  return response.data
}

function registerSocketListenersOnce(): void {
  if (socketListenersRegistered) {
    return
  }

  socketListenersRegistered = true
  const socket = getPurchaseInvoiceImportSocket()

  socket.on('job_snapshot', (dto: PurchaseInvoiceImportStatus) => {
    if (dto.jobId) applyStatusDto(dto.jobId, dto)
  })

  socket.on('job_progress', (event: PurchaseInvoiceImportProgressEvent) => {
    patchJob(event.jobId, {
      status: 'running',
      processedRows: event.processedRows,
      totalRows: event.totalRows,
      successCount: event.successCount,
      errorCount: event.errorCount,
      progressPercent: event.progressPercent,
    })
  })

  socket.on('job_row_result', (event: PurchaseInvoiceImportRowResultEvent) => {
    setState((current) => {
      const existing = current.jobs[event.jobId]
      if (!existing) return current

      return {
        ...current,
        jobs: {
          ...current.jobs,
          [event.jobId]: {
            ...existing,
            rowResultsByIndex: {
              ...existing.rowResultsByIndex,
              [event.rowIndex]: event,
            },
          },
        },
      }
    })
  })

  socket.on('job_completed', (dto: PurchaseInvoiceImportStatus) => {
    if (dto.jobId) applyStatusDto(dto.jobId, dto)
  })

  socket.on('job_not_found', ({ jobId }: { jobId: string }) => {
    // El job no existe o pertenece a otra empresa (token rotado tras un
    // cambio de empresa activa, por ejemplo) — no tiene sentido seguir
    // mostrándolo como "en curso".
    dismissJob(jobId)
  })

  socket.on('connect', () => {
    // Reconexión (wifi, laptop en suspensión, etc.): se re-suscribe cada
    // job todavía no terminal y además se refresca por REST — lo que
    // llegue primero corrige cualquier evento perdido mientras estuvo
    // desconectado, en vez de dejar la UI mostrando datos viejos.
    for (const job of Object.values(state.jobs)) {
      if (job.status === 'pending' || job.status === 'running') {
        subscribeToJob(job.jobId)
        void refreshFromRest(job.jobId)
      }
    }
  })
}

function subscribeToJob(jobId: string): void {
  const socket = ensurePurchaseInvoiceImportSocketConnected()

  if (socket.connected) {
    socket.emit('subscribe_job', { jobId })
  } else {
    socket.once('connect', () => socket.emit('subscribe_job', { jobId }))
  }
}

async function refreshFromRest(jobId: string): Promise<void> {
  try {
    const dto = await fetchPurchaseInvoiceImportJobStatus(jobId)
    if (dto.jobId) applyStatusDto(dto.jobId, dto)
  } catch {
    // Sin conexión todavía / error transitorio — el próximo reconnect o el
    // propio WebSocket ya activo se encargan de reintentar.
  }
}

export function startTracking(jobId: string, totalRows: number | null): void {
  registerSocketListenersOnce()

  setState((current) => ({
    jobs: { ...current.jobs, [jobId]: buildInitialJobState(jobId, totalRows) },
    lastStartedJobId: jobId,
  }))

  try {
    window.localStorage.setItem(ACTIVE_JOB_ID_STORAGE_KEY, jobId)
  } catch {
    // Ver comentario en clearActiveJobIdIfMatches.
  }

  subscribeToJob(jobId)
}

export function dismissJob(jobId: string): void {
  setState((current) => {
    if (!(jobId in current.jobs)) return current

    const jobs = { ...current.jobs }
    delete jobs[jobId]

    return {
      jobs,
      lastStartedJobId:
        current.lastStartedJobId === jobId ? null : current.lastStartedJobId,
    }
  })

  clearActiveJobIdIfMatches(jobId)
}

/** Espera a que un job trackeado llegue a un estado terminal — usado por
 * purchaseInvoiceExcelSource para que su upload() siga resolviendo una
 * única vez al final, ahora alimentado por WebSocket en vez de polling,
 * con un refresh REST de respaldo por si algún evento se perdiera. */
export function waitForTerminalStatus(
  jobId: string,
): Promise<PurchaseInvoiceImportJobState> {
  const REST_BACKSTOP_INTERVAL_MS = 15_000

  return new Promise((resolve) => {
    const checkAndMaybeResolve = (): boolean => {
      const job = state.jobs[jobId]
      if (job && (job.status === 'completed' || job.status === 'error')) {
        resolve(job)
        return true
      }
      return false
    }

    if (checkAndMaybeResolve()) return

    const unsubscribe = subscribe(() => {
      if (checkAndMaybeResolve()) {
        unsubscribe()
        window.clearInterval(backstopInterval)
      }
    })

    const backstopInterval = window.setInterval(() => {
      void refreshFromRest(jobId)
    }, REST_BACKSTOP_INTERVAL_MS)
  })
}

/** Hidratación al cargar la app: si quedó un job activo persistido de una
 * sesión/pestaña anterior, lo recupera por REST antes de que el socket
 * llegue a conectar — cubre una recarga completa de página. */
function readStoredActiveJobId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_JOB_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

export async function hydrateFromStorage(): Promise<void> {
  const storedJobId = readStoredActiveJobId()

  if (!storedJobId) return

  try {
    const dto = await fetchPurchaseInvoiceImportJobStatus(storedJobId)

    if (!dto.jobId) {
      clearActiveJobIdIfMatches(storedJobId)
      return
    }

    registerSocketListenersOnce()
    setState((current) => ({
      jobs: {
        ...current.jobs,
        [dto.jobId as string]: buildInitialJobState(dto.jobId as string, dto.totalRows),
      },
      lastStartedJobId: dto.jobId,
    }))
    applyStatusDto(dto.jobId, dto)

    if (dto.status === 'pending' || dto.status === 'running') {
      subscribeToJob(dto.jobId)
    }
  } catch {
    // Sin red al cargar la app — se reintentará implícitamente si el
    // usuario entra a la pantalla de Factura de compra y dispara otro
    // flujo; no bloqueamos el arranque de la app por esto.
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): StoreState {
  return state
}

// useSyncExternalStore requires a getSnapshot() that returns a referentially
// stable value when nothing changed — Object.values(...).filter(...) would
// build a new array on every call (even when `state` didn't change) and
// trip React's "getSnapshot should be cached" loop guard. These selectors
// cache their result per `state` reference instead of recomputing it every
// render.
function createFilteredJobsSelector(
  predicate: (job: PurchaseInvoiceImportJobState) => boolean,
): () => PurchaseInvoiceImportJobState[] {
  let lastState: StoreState | null = null
  let lastResult: PurchaseInvoiceImportJobState[] = []

  return () => {
    if (lastState !== state) {
      lastState = state
      lastResult = Object.values(state.jobs).filter(predicate)
    }
    return lastResult
  }
}

export const getActiveJobsSnapshot = createFilteredJobsSelector(
  (job) => job.status === 'pending' || job.status === 'running',
)

export const getFinishedJobsSnapshot = createFilteredJobsSelector(
  (job) => job.status === 'completed' || job.status === 'error',
)
