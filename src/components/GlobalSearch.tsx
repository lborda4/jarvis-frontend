import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { companyJarvisModules } from '../types/companyModules'
import { availableSearchCategories, searchGlobally, searchListLink, type SearchAccess, type SearchGroup, type SearchScope } from '../services/globalSearchService'
import { SearchIcon } from './icons/SidebarIcons'
import Button from './Button'
import './GlobalSearch.css'

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function GlobalSearch() {
  const { user, isSwitchingCompany } = useAuth()
  const setup = useIntegrationSetup()
  const billing = !setup.isJarvisCompany || companyJarvisModules(user?.company?.jarvisModules).includes('BILLING')
  const access: SearchAccess = { companyId: user?.company?.id ?? '', provider: setup.integrationProviders.includes('JARVIS') ? 'JARVIS' : 'SIIGO',
    sales: billing && setup.isSalesInvoiceEnabled, purchases: billing && setup.isPurchaseInvoiceEnabled, support: billing && setup.isSupportDocumentEnabled,
    thirdParties: billing && setup.isJarvisCompany && setup.isConfigured, products: billing }
  return <SearchBox key={`${access.companyId}:${setup.integrationMode}`} access={access} disabled={isSwitchingCompany || setup.isCheckingSetup || !access.companyId} />
}

export function SearchBox({ access, disabled }: { access: SearchAccess; disabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const id = useId()
  const [text, setText] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [openAt, setOpenAt] = useState<string | null>(null)
  const setOpen = (value: boolean) => setOpenAt(value ? location.key : null)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; groups: SearchGroup[] } | null>(null)
  const categories = availableSearchCategories(access)
  const selectedScope = scope === 'all' || categories.some(item => item.id === scope) ? scope : 'all'
  const query = text.trim()
  const accessKey = JSON.stringify(access)
  const key = `${accessKey}:${selectedScope}:${query}:${attempt}`
  const current = result?.key === key ? result.groups : null
  const show = openAt === location.key && !disabled
  const loading = show && query.length >= 2 && !current
  const navigation = query.length < 2 ? [] : categories.filter(item => (selectedScope === 'all' || selectedScope === item.id) && normalize(`${item.label} ${item.keywords}`).includes(normalize(query)))

  useEffect(() => {
    if (!show || query.length < 2) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchGlobally(query, selectedScope, JSON.parse(accessKey) as SearchAccess).then(groups => { if (!cancelled) setResult({ key, groups }) })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [show, query, selectedScope, accessKey, key])
  useEffect(() => {
    if (!show) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpenAt(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [show])

  const runSearch = () => { setOpen(true); setAttempt(value => value + 1); input.current?.focus() }
  const submit = (event: FormEvent) => { event.preventDefault(); runSearch() }
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); input.current?.focus(); setOpen(false); return }
    if (event.target instanceof HTMLSelectElement || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
    if (!show && event.target === input.current) { event.preventDefault(); setOpen(true); return }
    const links = [...(root.current?.querySelectorAll<HTMLAnchorElement>('.global-search__results a') ?? [])]
    if (!links.length) return
    const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement)
    event.preventDefault()
    const next = currentIndex + (event.key === 'ArrowDown' ? 1 : -1)
    if (next < 0) input.current?.focus()
    else links[Math.min(next, links.length - 1)]?.focus()
  }

  return <div className="global-search-bar"><div className="global-search" ref={root} onKeyDown={keyDown} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <form className="global-search__form" role="search" aria-label="Búsqueda general" onSubmit={submit}>
      <select aria-label="Tipo de registro" value={selectedScope} disabled={disabled} onChange={event => { setScope(event.target.value as SearchScope); setOpen(true) }}><option value="all">Todos</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <input ref={input} type="search" aria-label="Buscar en la empresa" placeholder="Buscar por número, nombre, NIT o código" value={text} disabled={disabled} maxLength={150} autoComplete="off" aria-controls={show ? `${id}-results` : undefined} onFocus={() => setOpen(true)} onChange={event => { setText(event.target.value); setOpen(true) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); runSearch() } }} />
      <Button type="button" variant="primary" disabled={disabled || query.length < 2} onClick={runSearch} aria-label="Buscar"><SearchIcon /></Button>
    </form>
    {show && <div id={`${id}-results`} className="global-search__results" role="region" aria-label="Resultados de búsqueda" aria-busy={loading}>
      {query.length < 2 ? <p className="global-search__message">Escribe al menos 2 caracteres.</p> : <>
        {navigation.length > 0 && <div className="global-search__navigation">{navigation.map(item => <Link key={item.id} to={item.path}>Ir a {item.label.toLowerCase()} <span aria-hidden="true">→</span></Link>)}</div>}
        {loading && <p className="global-search__message" role="status">Buscando…</p>}
        {current?.map(group => {
          const category = categories.find(item => item.id === group.category)
          if (!category || (!group.items.length && !group.failed)) return null
          return <section className="global-search__group" key={group.category}><div className="global-search__group-title"><h2>{category.label}</h2>{!group.failed && <span>{group.total}</span>}</div>
            {group.failed ? <p className="global-search__message">No se pudo consultar esta categoría. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></p> : <>
              {group.items.map(item => <Link className="global-search__hit" key={item.id} to={item.to}><strong>{item.title}</strong><span>{item.description}</span></Link>)}
              {group.total > group.items.length && <Link className="global-search__more" to={searchListLink(category.path, query)}>Ver todos ({group.total}) →</Link>}
            </>}
          </section>
        })}
        {current && !current.some(group => group.items.length || group.failed) && !navigation.length && <p className="global-search__message" role="status">No se encontraron resultados.</p>}
      </>}
    </div>}
  </div></div>
}
