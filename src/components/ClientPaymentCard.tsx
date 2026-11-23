import { useEffect, useRef, useState } from 'react'
import type { AdminCommercialActivity, AdminCompanyListItem } from '../types/admin'
import type { AdvisorSale, CommissionReportData } from '../types/advisor'
import { fetchCommissionReport, registerAdvisorSalePayment } from '../services/advisorService'
import { getApiErrorMessage } from '../services/apiClient'
import { formatCop } from '../utils/adminPlan'
import Button from './Button'
import ErrorMessage from './ErrorMessage'

const monthNow = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).format(new Date())
const dateLabel = (date: string) => new Date(date).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })

export function ClientPaymentSummary({ activity, pending, paid = [], busy = false, onPay }: {
  activity: AdminCommercialActivity[]; pending: AdvisorSale[]; paid?: AdvisorSale[]; busy?: boolean; onPay?: (id: string) => void
}) {
  const last = activity.filter(item => item.kind === 'PAYMENT').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const latestSale = [...paid].sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0]
  const amount = last?.amountCop ?? latestSale?.priceCop
  const paidAt = last?.createdAt ?? latestSale?.paidAt
  return <>
    <div className="client-detail__section-heading"><h2>Último pago</h2><span className={`client-detail__payment-state${pending.length ? ' client-detail__payment-state--pending' : ''}`}>{pending.length ? 'Verificar pago' : paidAt ? 'Pagado' : 'Verificar pago'}</span></div>
    <strong className="client-detail__payment-amount">{amount != null ? formatCop(amount) : 'Sin pagos registrados'}</strong>
    {paidAt && <p>Pagado el {dateLabel(paidAt)}</p>}
    {pending.map(sale => <div className="client-detail__pending-sale" key={sale.id}>
      <span><strong>{sale.productName}</strong><small>Verificar pago · {formatCop(sale.priceCop)}</small><small>Comisión al pagar: {formatCop(sale.commissionCop)}</small></span>
      <Button disabled={busy} onClick={() => onPay?.(sale.id)}>{busy ? 'Registrando…' : 'Ya pagó'}</Button>
    </div>)}
  </>
}

export default function ClientPaymentCard({ company, activity, onPaid }: { company: AdminCompanyListItem; activity: AdminCommercialActivity[]; onPaid: (message: string) => void }) {
  const [data, setData] = useState<CommissionReportData | null>(null)
  const [loading, setLoading] = useState(Boolean(company.advisorId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [confirmed, setConfirmed] = useState<string[]>([])
  const busyRef = useRef(false)
  useEffect(() => {
    if (!company.advisorId) return
    let active = true
    void fetchCommissionReport(monthNow(), true, { companyId: company.id }).then(report => { if (active) setData(report) })
      .catch(failure => { if (active) setError(getApiErrorMessage(failure, 'No se pudieron consultar los pagos pendientes.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [company.id, company.advisorId, activity, revision])
  const pay = async (id: string) => {
    if (busyRef.current || confirmed.includes(id)) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      const result = await registerAdvisorSalePayment(id)
      setConfirmed(current => [...current, id])
      onPaid(result.message)
      setRevision(current => current + 1)
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo registrar el pago.')) }
    finally { busyRef.current = false; setBusy(false) }
  }
  return <section className="admin-card" aria-label="Pagos del cliente">
    <ClientPaymentSummary activity={activity} pending={(data?.pending ?? []).filter(sale => !confirmed.includes(sale.id))} paid={data?.paid} busy={busy} onPay={id => void pay(id)} />
    {loading && <p role="status">Consultando pagos…</p>}
    {error && <><ErrorMessage inline message={error} /><Button variant="outline" disabled={busy} onClick={() => { setError(''); setLoading(true); setRevision(value => value + 1) }}>Reintentar</Button></>}
  </section>
}
