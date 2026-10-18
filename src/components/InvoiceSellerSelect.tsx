import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createJarvisSeller, fetchJarvisSellers, type JarvisSeller } from '../services/jarvisSellerService'
import { getApiErrorMessage } from '../services/apiClient'
import { SearchIcon } from './icons/SidebarIcons'
import './InvoiceSellerSelect.css'

export default function InvoiceSellerSelect({ value, onChange, disabled = false }: { value: JarvisSeller[]; onChange: (value: JarvisSeller[]) => void; disabled?: boolean }) {
  const { user } = useAuth()
  const companyId = user?.company?.id
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const control = useRef<HTMLButtonElement>(null)
  const [items, setItems] = useState<JarvisSeller[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftError, setDraftError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  function closePanel() {
    setOpen(false)
    setQuery('')
    setCreating(false)
    setDraftName('')
    setDraftError('')
  }
  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      try {
        const data = await fetchJarvisSellers()
        if (active) { setItems(data); setError('') }
      } catch (err) {
        if (active) setError(getApiErrorMessage(err, 'No se pudieron cargar los vendedores.'))
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [companyId, attempt])
  useEffect(() => {
    if (!open || saving) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) closePanel() }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open, saving])
  useEffect(() => {
    if (open && !creating) searchInput.current?.focus()
  }, [open, creating])
  const filtered = items.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  async function create() {
    if (saving || disabled || !creating) return
    const name = draftName.trim().replace(/\s+/g, ' ')
    if (!name) { setDraftError('El nombre es obligatorio.'); return }
    if (items.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setDraftError('Ya existe un vendedor con ese nombre.')
      return
    }
    setSaving(true); setDraftError('')
    try {
      const seller = await createJarvisSeller(name)
      setItems(current => current.some(item => item.id === seller.id) ? current : [...current, seller].sort((a, b) => a.name.localeCompare(b.name)))
      if (!value.some(item => item.id === seller.id)) onChange([...value, seller])
      closePanel()
      control.current?.focus()
    } catch (err) { setDraftError(getApiErrorMessage(err, 'No se pudo crear el vendedor.')) }
    finally { setSaving(false) }
  }
  return <div className="invoice-sellers ds-individual__field" ref={root} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); if (!saving) { closePanel(); control.current?.focus() } } }}>
    <span id={`${panelId}-label`}>Vendedores (opcional)</span>
    <div className="invoice-sellers__body">
    <div className="invoice-sellers__selected">{value.map(seller => <span key={seller.id}>{seller.name}<button type="button" disabled={disabled || saving} aria-label={`Quitar vendedor ${seller.name}`} onClick={() => onChange(value.filter(item => item.id !== seller.id))}>×</button></span>)}</div>
    <button ref={control} type="button" className="invoice-sellers__control" disabled={disabled || saving} aria-labelledby={`${panelId}-label`} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => open ? closePanel() : setOpen(true)}>Seleccionar vendedores <span aria-hidden="true">▾</span></button>
    {open && <div className="invoice-sellers__panel" id={panelId}>
      {creating ? <div className="invoice-sellers__editor" role="group" aria-labelledby={`${panelId}-title`}>
        <h3 id={`${panelId}-title`}>Nuevo vendedor</h3>
        <label className="invoice-sellers__editor-field">
          <span>Nombre <span aria-hidden="true">*</span></span>
          <input autoFocus aria-required="true" aria-invalid={Boolean(draftError)} aria-describedby={draftError ? `${panelId}-error` : undefined} placeholder="Nombre del vendedor" value={draftName} maxLength={150} disabled={saving || disabled} onChange={event => { setDraftName(event.target.value); setDraftError('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void create() } }} />
        </label>
        {draftError && <p className="invoice-sellers__error" id={`${panelId}-error`} role="alert">{draftError}</p>}
        <div className="invoice-sellers__editor-actions">
          <button type="button" className="invoice-sellers__editor-button" disabled={saving || disabled} onClick={() => { setCreating(false); setDraftName(''); setDraftError('') }}>Cancelar</button>
          <button type="button" className="invoice-sellers__editor-button invoice-sellers__editor-button--primary" disabled={saving || disabled} onClick={() => void create()}>{saving ? 'Guardando...' : 'Crear'}</button>
        </div>
      </div> : <>
      <div className="invoice-sellers__search">
        <SearchIcon />
        <input ref={searchInput} aria-label="Buscar vendedor" placeholder="Buscar por nombre..." value={query} maxLength={150} disabled={disabled} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation() } }} />
      </div>
      {loading ? <p className="invoice-sellers__empty" role="status">Cargando vendedores...</p> : <div className="invoice-sellers__options" role="group" aria-label="Vendedores disponibles">
        {filtered.map(seller => <label key={seller.id}><input type="checkbox" disabled={disabled || saving} checked={value.some(item => item.id === seller.id)} onChange={event => {
          onChange(event.target.checked ? [...value, seller] : value.filter(item => item.id !== seller.id))
          closePanel()
          control.current?.focus()
        }} />{seller.name}</label>)}
        {!filtered.length && !error && <p className="invoice-sellers__empty">No hay vendedores que coincidan.</p>}
      </div>}
      {error && <div className="invoice-sellers__load-error" role="alert"><p>{error}</p><button type="button" disabled={loading || saving || disabled} onClick={() => setAttempt(current => current + 1)}>Reintentar</button></div>}
      <button type="button" className="invoice-sellers__create" disabled={disabled || loading} onClick={() => { setDraftName(''); setDraftError(''); setCreating(true) }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        Crear nuevo vendedor
      </button>
      </>}
    </div>}
    </div>
  </div>
}
