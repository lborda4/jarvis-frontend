import { useEffect, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { getApiErrorMessage } from '../services/apiClient'
import { createDemoInvoice, fetchDemoInvoices, type DemoInvoice, type DemoInvoiceInput } from '../services/advisorDemoInvoiceService'
import { shouldShowTablePagination } from '../utils/tablePagination'

const money = (value: string) => {
  const [whole, fraction = '00'] = value.split('.')
  return `$ ${BigInt(whole).toLocaleString('es-CO')},${fraction.padEnd(2, '0')}`
}

export default function AdvisorDemoInvoices() {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<{ items: DemoInvoice[]; total: number; pageSize: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<DemoInvoice | null>(null)

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      setLoading(true); setError('')
      return fetchDemoInvoices(page)
    }).then(result => {
      if (!active || !result) return
      const last = Math.max(1, Math.ceil(result.total / result.pageSize))
      if (page > last) { setPage(last); return }
      setData(result)
    }).catch(failure => {
      if (active) setError(getApiErrorMessage(failure, 'No se pudieron cargar las facturas demo.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, revision])

  if (formOpen) return <DemoInvoiceForm onCancel={() => setFormOpen(false)} onCreated={invoice => {
    setFormOpen(false); setSelected(invoice); setPage(1); setRevision(value => value + 1)
  }} />

  if (selected) return <section className="admin-card advisor-demo__welcome">
    <h2>Factura simulada DEMO-{selected.number}</h2>
    <p>Este documento es una simulación y no tiene validez ante la DIAN.</p>
    <p><strong>Cliente:</strong> {selected.customerName} · {selected.customerIdentification}</p>
    <p><strong>Producto o servicio:</strong> {selected.description}</p>
    <p><strong>Cantidad:</strong> {selected.quantity} · <strong>Valor unitario:</strong> {money(selected.unitValue)}</p>
    <p><strong>Total:</strong> {money(selected.total)}</p>
    <Button variant="outline" onClick={() => setSelected(null)}>Volver a facturas</Button>
  </section>

  return <section className="admin-card advisor-demo__welcome">
    <div className="advisor-demo__heading"><h2>Facturas de venta simuladas</h2><Button onClick={() => setFormOpen(true)}>+ Nueva factura</Button></div>
    <p>Solo se muestran facturas creadas en esta demo compartida.</p>
    {error && <><ErrorMessage inline message={error} /><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar</Button></>}
    {loading ? <LoadingIndicator message="Cargando facturas demo…" /> : data && <div className="advisor-demo__table-wrap">
      <table className="advisor-demo__table">
        <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{data.items.map(invoice => <tr key={invoice.id}>
          <td>DEMO-{invoice.number}</td><td>{invoice.customerName}</td><td>{money(invoice.total)}</td><td>Simulada</td>
          <td><Button variant="outline" onClick={() => setSelected(invoice)}>Ver</Button></td>
        </tr>)}{!data.items.length && <tr><td colSpan={5}>Todavía no hay facturas simuladas.</td></tr>}</tbody>
      </table>
      {shouldShowTablePagination(data.total, data.pageSize) && <div className="advisor-demo__pagination">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(current => current - 1)}>Anterior</Button>
        <span>{page} / {Math.ceil(data.total / data.pageSize)}</span>
        <Button variant="outline" disabled={page >= Math.ceil(data.total / data.pageSize)} onClick={() => setPage(current => current + 1)}>Siguiente</Button>
      </div>}
    </div>}
  </section>
}

function DemoInvoiceForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (invoice: DemoInvoice) => void }) {
  const [customerName, setCustomerName] = useState('')
  const [customerIdentification, setCustomerIdentification] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitValue, setUnitValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const request = useRef<DemoInvoiceInput | null>(null)

  const changed = () => { request.current = null }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const input = request.current ?? {
      id: crypto.randomUUID(), customerName, customerIdentification, description,
      quantity: Number(quantity), unitValue: Number(unitValue),
    }
    request.current = input
    setBusy(true); setError('')
    try { onCreated(await createDemoInvoice(input)) }
    catch (failure) {
      const definitive = axios.isAxiosError(failure) && [400, 409, 422].includes(failure.response?.status ?? 0)
      setUncertain(!definitive)
      setError(definitive ? getApiErrorMessage(failure, 'Revisa los datos de la factura.') : 'No se pudo confirmar el resultado. Reintenta sin cambiar los datos o vuelve al listado para verificar si se guardó.')
    }
    finally { setBusy(false) }
  }
  return <section className="admin-card advisor-demo__welcome">
    <h2>Nueva factura simulada</h2>
    <p>Esta primera versión admite un producto o servicio, sin impuestos ni pagos. No realiza envíos reales.</p>
    <form className="admin-form" onSubmit={submit}>
      <label className="admin-form__field">Nombre del cliente<input required maxLength={200} value={customerName} disabled={busy || uncertain} onChange={event => { changed(); setCustomerName(event.target.value) }} /></label>
      <label className="admin-form__field">Identificación del cliente<input required maxLength={100} value={customerIdentification} disabled={busy || uncertain} onChange={event => { changed(); setCustomerIdentification(event.target.value) }} /></label>
      <label className="admin-form__field">Producto o servicio<input required maxLength={500} value={description} disabled={busy || uncertain} onChange={event => { changed(); setDescription(event.target.value) }} /></label>
      <div className="admin-form__grid">
        <label className="admin-form__field">Cantidad<input type="number" required min="0.01" max="99999999" step="0.01" value={quantity} disabled={busy || uncertain} onChange={event => { changed(); setQuantity(event.target.value) }} /></label>
        <label className="admin-form__field">Valor unitario<input type="number" required min="0.01" max="99999999" step="0.01" value={unitValue} disabled={busy || uncertain} onChange={event => { changed(); setUnitValue(event.target.value) }} /></label>
      </div>
      {error && <ErrorMessage inline message={error} />}
      <div className="advisor-demo__actions"><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Simular emisión'}</Button><Button variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
    </form>
  </section>
}
