import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createJarvisSeller, fetchJarvisSellers, type JarvisSeller } from '../services/jarvisSellerService'
import { getApiErrorMessage } from '../services/apiClient'
import './InvoiceSellerSelect.css'

export default function InvoiceSellerSelect({ value, onChange, disabled = false }: { value: JarvisSeller[]; onChange: (value: JarvisSeller[]) => void; disabled?: boolean }) {
  const { user } = useAuth()
  const companyId = user?.company?.id
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<JarvisSeller[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchJarvisSellers().then(data => { if (active) { setItems(data); setError('') } })
      .catch(err => { if (active) setError(getApiErrorMessage(err, 'No se pudieron cargar los vendedores.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [companyId, attempt])
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const normalized = query.trim().replace(/\s+/g, ' ')
  const filtered = items.filter(item => item.name.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()))
  const existing = items.find(item => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
  async function create() {
    if (!normalized || saving) return
    setSaving(true); setError('')
    try {
      const seller = existing ?? await createJarvisSeller(normalized)
      setItems(current => current.some(item => item.id === seller.id) ? current : [...current, seller].sort((a, b) => a.name.localeCompare(b.name)))
      if (!value.some(item => item.id === seller.id)) onChange([...value, seller])
      setQuery('')
    } catch (err) { setError(getApiErrorMessage(err, 'No se pudo crear el vendedor.')) }
    finally { setSaving(false) }
  }
  return <div className="invoice-sellers ds-individual__field" ref={root} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }}>
    <span id={`${panelId}-label`}>Vendedores (opcional)</span>
    <div className="invoice-sellers__body">
    <div className="invoice-sellers__selected">{value.map(seller => <span key={seller.id}>{seller.name}<button type="button" disabled={disabled || saving} aria-label={`Quitar vendedor ${seller.name}`} onClick={() => onChange(value.filter(item => item.id !== seller.id))}>×</button></span>)}</div>
    <button type="button" className="invoice-sellers__control" disabled={disabled} aria-labelledby={`${panelId}-label`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(current => !current)}>Seleccionar vendedores <span aria-hidden="true">▾</span></button>
    {open && <div className="invoice-sellers__panel" id={panelId}>
      <input aria-label="Buscar o crear vendedor" placeholder="Buscar o escribir un nuevo vendedor" value={query} maxLength={150} disabled={saving || disabled} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (normalized) void create() } }} />
      {loading ? <p role="status">Cargando vendedores...</p> : <div className="invoice-sellers__options" role="group" aria-label="Vendedores disponibles">
        {filtered.map(seller => <label key={seller.id}><input type="checkbox" disabled={disabled || saving} checked={value.some(item => item.id === seller.id)} onChange={event => onChange(event.target.checked ? [...value, seller] : value.filter(item => item.id !== seller.id))} />{seller.name}</label>)}
        {!filtered.length && <p>No hay vendedores que coincidan.</p>}
      </div>}
      <button type="button" className="invoice-sellers__create" disabled={disabled || saving || loading || !normalized} onClick={() => void create()}>{saving ? 'Guardando...' : existing ? `Seleccionar ${existing.name}` : normalized ? `＋ Agregar vendedor «${normalized}»` : 'Escribe un nombre para agregar un vendedor'}</button>
      {error && <div role="alert"><p>{error}</p><button type="button" disabled={loading || saving} onClick={() => setAttempt(current => current + 1)}>Reintentar</button></div>}
    </div>}
    </div>
  </div>
}
