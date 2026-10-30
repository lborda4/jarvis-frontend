import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useIntegrationSetup } from '../../context/IntegrationSetupContext'
import PageHeader from '../../components/PageHeader'
import LoadingIndicator from '../../components/LoadingIndicator'
import { getApiErrorMessage } from '../../services/apiClient'
import {
  payrollService,
  type PayrollBootstrap,
} from '../../services/payrollService'
import PayrollEmployees from './PayrollEmployees'
import PayrollSettingsPage from './PayrollSettingsPage'
import PayrollDocuments from './PayrollDocuments'
import PayrollCreatePage from './PayrollCreatePage'
import './Payroll.css'
export interface PayrollContext {
  data: PayrollBootstrap
  reload: () => Promise<void>
  run: (action: () => Promise<unknown>, message?: string) => Promise<boolean>
  busy: boolean
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  )
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    root?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab' || !root) return
      const focusable = [
        ...root.querySelectorAll<HTMLElement>(
          'button,input,select,a[href],[tabindex="0"]',
        ),
      ].filter((el) => !el.hasAttribute('disabled'))
      const first = focusable[0],
        last = focusable.at(-1)
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [])
  return (
    <div className="payroll__modal-backdrop">
      <div
        className="payroll__modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="payroll__footer" style={{ padding: 0 }}>
          <h2>{title}</h2>
          <button
            className="payroll__button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {subtitle && <p className="payroll__muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
function PayrollWorkspace() {
  const location = useLocation()
  const [data, setData] = useState<PayrollBootstrap | null>(null)
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  const reload = useCallback(async () => {
    const result = await payrollService.bootstrap()
    if (mounted.current) setData(result)
  }, [])
  useEffect(() => {
    mounted.current = true
    void reload().catch((e) => {
      if (mounted.current)
        setError(getApiErrorMessage(e, 'No se pudo cargar la nómina.'))
    })
    return () => {
      mounted.current = false
    }
  }, [reload])
  const run = async (
    action: () => Promise<unknown>,
    success = 'Cambios guardados.',
  ) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await reload()
      if (mounted.current) setMessage(success)
      return true
    } catch (e) {
      if (mounted.current)
        setError(getApiErrorMessage(e, 'No se pudo completar la operación.'))
      return false
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  const view = location.pathname.endsWith('/empleados')
    ? 'employees'
    : location.pathname.endsWith('/configuracion')
      ? 'settings'
      : location.pathname.endsWith('/nueva')
        ? 'new'
        : 'documents'
  return (
    <main className="payroll">
      <div className="payroll__muted" style={{ marginBottom: 18 }}>
        Nómina electrónica ›{' '}
        {view === 'employees'
          ? 'Empleados'
          : view === 'settings'
            ? 'Configuración'
            : view === 'new'
              ? 'Nueva nómina'
              : 'Nóminas'}
      </div>
      {error && (
        <div role="alert" className="payroll__notice payroll__notice--error">
          {error}{' '}
          <button
            type="button"
            className="payroll__link"
            onClick={() => void run(reload, 'Información actualizada.')}
          >
            Reintentar
          </button>
        </div>
      )}
      {message && (
        <div role="status" className="payroll__notice payroll__notice--success">
          {message}
        </div>
      )}
      {!data ? (
        <p>Cargando información de nómina…</p>
      ) : view === 'new' ? (
        <PayrollCreatePage data={data} reload={reload} run={run} busy={busy} />
      ) : view === 'employees' ? (
        <PayrollEmployees key={location.key} data={data} reload={reload} run={run} busy={busy} />
      ) : view === 'settings' ? (
        <PayrollSettingsPage
          data={data}
          reload={reload}
          run={run}
          busy={busy}
        />
      ) : (
        <PayrollDocuments data={data} reload={reload} run={run} busy={busy} />
      )}
    </main>
  )
}
export default function PayrollPage() {
  const { user } = useAuth()
  const { isJarvisCompany, isCheckingSetup } = useIntegrationSetup()
  if (isCheckingSetup)
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando nómina…" />
      </div>
    )
  if (!isJarvisCompany) return <Navigate to="/inicio" replace />
  return <PayrollWorkspace key={user?.company?.id} />
}
export function PayrollHeading({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <PageHeader
      title={title}
      description={description}
      actions={
        actions ?? (
          <Link className="payroll__button" to="/nomina">
            Volver a nóminas
          </Link>
        )
      }
    />
  )
}
