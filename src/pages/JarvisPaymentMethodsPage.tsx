import { useEffect, useState } from 'react'
import Button from '../components/Button'
import CatalogRowActions from '../components/CatalogRowActions'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import JarvisPaymentMethodModal from '../components/JarvisPaymentMethodModal'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { deleteJarvisPaymentMethod, fetchJarvisPaymentMethods, paymentMethodsQueryKey, type JarvisPaymentMethod, type JarvisPaymentMethodsList } from '../services/jarvisPaymentMethodService'
import { peekCachedQuery } from '../services/queryCache'
import './JarvisTaxesPage.css'

export default function JarvisPaymentMethodsPage() {
  const cached = peekCachedQuery<JarvisPaymentMethodsList>(paymentMethodsQueryKey())
  const [items, setItems] = useState<JarvisPaymentMethod[]>(cached?.items ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<JarvisPaymentMethod | null>(null)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<JarvisPaymentMethod | null>(null)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    let active = true
    fetchJarvisPaymentMethods().then(data => { if (active) setItems(data.items) })
      .catch(err => { if (active) setError(getApiErrorMessage(err, 'No se pudieron cargar las formas de pago.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const filtered = items.filter(item => `${item.name} ${item.nextpymeMethodName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const remove = async () => {
    if (!pendingDelete) return
    setDeleting(true); setError(null)
    try {
      await deleteJarvisPaymentMethod(pendingDelete.id)
      setItems(current => current.filter(item => item.id !== pendingDelete.id))
      setPendingDelete(null); setSuccess('Forma de pago eliminada.')
    } catch (err) { setError(getApiErrorMessage(err, 'No se pudo eliminar la forma de pago.')); setPendingDelete(null) }
    finally { setDeleting(false) }
  }
  return <main className="jarvis-taxes-page integration-page">
    <PageHeader title="Formas de pago" description="Configura las formas de pago que usarás en tus facturas de venta y documentos soporte."
      actions={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true); setSuccess(null) }}>Crear forma de pago</Button>} />
    {error && <><ErrorMessage message={error} /><Button variant="outline" onClick={() => { setLoading(true); setError(null); setRevision(value => value + 1) }}>Reintentar</Button></>}
    {success && <SuccessMessage message={success} />}
    <div className="jarvis-taxes-page__filters integration-filters">
      <div className="jarvis-taxes-page__field jarvis-taxes-page__field--grow">
        <label htmlFor="payment-method-search">Buscar</label>
        <input id="payment-method-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre o forma de pago del catálogo" />
      </div>
    </div>
    <section className="jarvis-taxes-page__list integration-card" aria-live="polite">
      <div className="integration-card-header"><h2>Formas de pago</h2><p>{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</p></div>
      {loading ? <LoadingIndicator message="Cargando formas de pago…" /> : !filtered.length ? <div className="jarvis-taxes-page__empty"><p>{search ? 'No encontramos formas de pago con esa búsqueda.' : 'Crea tu primera forma de pago para usarla al emitir documentos.'}</p></div> : <>
        <div className="jarvis-taxes-page__table-wrap"><table className="integration-table">
          <thead><tr><th>Nombre</th><th>Forma de pago del catálogo</th><th>Acciones</th></tr></thead>
          <tbody>{filtered.slice((currentPage - 1) * 10, currentPage * 10).map(item => <tr key={item.id}>
            <td><strong>{item.name}</strong></td><td>{item.nextpymeMethodName}</td>
            <td><CatalogRowActions name={item.name} disabled={deleting} onEdit={() => { setEditing(item); setOpen(true); setSuccess(null) }} onDelete={() => { setPendingDelete(item); setSuccess(null) }} /></td>
          </tr>)}</tbody>
        </table></div>
        {filtered.length > 10 && <div className="jarvis-taxes-page__pagination">
          <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
          <span>{currentPage} / {pages}</span>
          <Button variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
        </div>}
      </>}
    </section>
    {open && <JarvisPaymentMethodModal editing={editing} onClose={() => setOpen(false)} onSaved={item => {
      setItems(current => editing ? current.map(row => row.id === item.id ? item : row) : [...current, item])
      setOpen(false); setError(null); setSuccess('Forma de pago guardada.')
    }} />}
    <ConfirmDialog isOpen={!!pendingDelete} title="Eliminar forma de pago" message={`¿Eliminar «${pendingDelete?.name ?? ''}»? Dejará de estar disponible para nuevos documentos.`} confirmLabel="Eliminar" variant="danger" isBusy={deleting} onConfirm={() => void remove()} onCancel={() => { if (!deleting) setPendingDelete(null) }} />
  </main>
}
