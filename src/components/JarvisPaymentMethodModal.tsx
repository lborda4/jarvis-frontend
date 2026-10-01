import { useEffect, useState, type FormEvent } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisCatalogs, type JarvisCatalogItem } from '../services/jarvisService'
import { saveJarvisPaymentMethod, type JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import '../pages/TercerosPage.css'

// El padre monta una instancia nueva cada vez que se abre el formulario.
export default function JarvisPaymentMethodModal({ editing, onClose, onSaved }: {
  editing?: JarvisPaymentMethod | null
  onClose: () => void
  onSaved: (item: JarvisPaymentMethod) => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [methodId, setMethodId] = useState(String(editing?.nextpymeMethodId ?? ''))
  const [catalog, setCatalog] = useState<JarvisCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    fetchJarvisCatalogs().then(data => { if (active) setCatalog(data.paymentMethods) })
      .catch(err => { if (active) setError(getApiErrorMessage(err, 'No se pudo cargar el catálogo de formas de pago.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim() || !catalog.some(item => String(item.id) === methodId)) {
      setError('Escribe un nombre y selecciona una forma de pago del catálogo.'); return
    }
    setSaving(true)
    try { onSaved(await saveJarvisPaymentMethod({ name: name.trim(), nextpymeMethodId: Number(methodId) }, editing?.id)) }
    catch (err) { setError(getApiErrorMessage(err, 'No se pudo guardar la forma de pago.')) }
    finally { setSaving(false) }
  }
  return <Modal isOpen onClose={onClose} busy={saving} labelledBy="payment-method-title" className="terceros-page__dialog">
    <h2 id="payment-method-title" className="modal-dialog__title">{editing ? 'Editar forma de pago' : 'Crear forma de pago'}</h2>
    {error && <ErrorMessage message={error} />}
    <form onSubmit={submit}>
      <div className="terceros-page__form-grid">
        <div className="terceros-page__field">
          <label htmlFor="payment-method-name">Nombre *</label>
          <input id="payment-method-name" value={name} onChange={event => setName(event.target.value)} maxLength={120} required disabled={saving} placeholder="Ej. Transferencia Bancolombia" />
        </div>
        <div className="terceros-page__field">
          <label htmlFor="payment-method-master">Forma de pago del catálogo *</label>
          <select id="payment-method-master" value={methodId} onChange={event => setMethodId(event.target.value)} required disabled={loading || saving}>
            <option value="">{loading ? 'Cargando catálogo…' : 'Selecciona una forma de pago'}</option>
            {catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <small>Relaciona tu forma de pago con una del catálogo de NextPyme.</small>
        </div>
      </div>
      {!loading && !catalog.length && <Button type="button" variant="outline" onClick={() => { setLoading(true); setError(null); setRevision(value => value + 1) }}>Reintentar catálogo</Button>}
      <div className="modal-dialog__actions">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={saving || loading || !catalog.length}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  </Modal>
}
