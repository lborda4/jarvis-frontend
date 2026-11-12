import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { fetchJarvisSalesInvoices, type JarvisSalesInvoice } from '../services/jarvisService'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (invoice: JarvisSalesInvoice) => void
  readOnly: boolean
  invalid?: boolean
}

export default function InvoiceReferenceSearch({ value, onChange, onSelect, readOnly, invalid }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ query: string; items: JarvisSalesInvoice[]; total: number; failed: boolean } | null>(null)
  const [highlighted, setHighlighted] = useState(0)
  const query = value.trim()
  const current = result?.query === query ? result : null
  const items = current?.items ?? []
  const loading = Boolean(query && !current && !readOnly)
  const show = open && Boolean(query) && !readOnly
  const activeIndex = Math.min(highlighted, Math.max(0, items.length - 1))

  useEffect(() => {
    if (readOnly || !query) return
    let active = true
    // Sin mínimo de caracteres ni espera: cada cambio consulta el consecutivo actual.
    void fetchJarvisSalesInvoices({ number: query, page: 1 }).then(data => {
      if (active) setResult({ query, items: data.items.filter(item => item.status === 'SENT' && Boolean(item.cufe?.trim())), total: data.total, failed: false })
    }).catch(() => {
      if (active) setResult({ query, items: [], total: 0, failed: true })
    })
    return () => { active = false }
  }, [query, readOnly])

  const select = (invoice: JarvisSalesInvoice) => { setOpen(false); onSelect(invoice) }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setHighlighted(Math.max(0, Math.min(items.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter' && show) {
      event.preventDefault()
      if (items[activeIndex]) select(items[activeIndex])
    } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
  }

  return <div className="ds-individual__search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <input value={value} readOnly={readOnly} role="combobox" aria-label="Número de factura" autoComplete="off" maxLength={100}
      aria-expanded={show} aria-controls={`${id}-options`} aria-autocomplete="list" aria-invalid={invalid || undefined}
      aria-activedescendant={show && items.length ? `${id}-option-${activeIndex}` : undefined}
      placeholder="Busca por prefijo o consecutivo" onFocus={() => setOpen(true)} onKeyDown={keyDown}
      onChange={event => { onChange(event.target.value); setOpen(true); setHighlighted(0); setResult(null) }} />
    {show && <ul className="ds-individual__supplier-list" id={`${id}-options`} role="listbox" aria-label="Facturas encontradas" aria-busy={loading}>
      {items.map((invoice, index) => <li key={invoice.id} id={`${id}-option-${index}`} role="option" aria-selected={activeIndex === index}>
        <button type="button" className={`ds-individual__supplier-option${activeIndex === index ? ' is-selected' : ''}`}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => select(invoice)}>
          <strong>{invoice.number.startsWith(invoice.prefix) ? invoice.number : `${invoice.prefix}${invoice.number}`}</strong>
          <span>{invoice.customerName} · {invoice.issueDate}</span>
        </button>
      </li>)}
      {!items.length && <li className="ds-individual__supplier-empty" role="status">{loading ? 'Buscando facturas…' : current?.failed ? 'No se pudieron consultar las facturas. Vuelve a escribir para reintentar.' : 'No se encontraron facturas con ese consecutivo.'}</li>}
      {current && current.total > items.length && <li className="ds-individual__supplier-empty">Hay más coincidencias. Escribe más caracteres para precisar la búsqueda.</li>}
    </ul>}
  </div>
}
