import { clientFacingError } from '../utils/clientFacingError'
import { shouldShowTablePagination } from '../utils/tablePagination'
import { isAxiosError } from 'axios'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import PageHeader from '../components/PageHeader'
import DateRangeFilter from '../components/DateRangeFilter'
import Button from '../components/Button'
import DocumentSendOverlay from '../components/DocumentSendOverlay'
import ErrorMessage from '../components/ErrorMessage'
import DocumentNotice from '../components/DocumentNotice'
import { useAuth } from '../context/AuthContext'
import { fetchJarvisTypeRejections, type JarvisCatalogItem } from '../services/jarvisService'
import { fetchSavedRadianInvoices, recoverRadianHistory, type RadianStoredEvent, lookupRadianInvoice, processRadianInvoices, type RadianProgress, type RadianDecision, type RadianStatus } from '../services/radianService'
import { isValidCufe, mapRadianInvoices, readRadianWorkbook, suggestRadianMapping, radianFilterColumns, type RadianColumn, type RadianInvoice, type RadianMapping, type RadianSheet } from '../utils/radianExcel'
import { mergeRadianInvoices } from '../utils/radianImport'
import './RadianPage.css'

type Results = Record<string, Partial<Record<number, RadianStatus>>>
type Invoice = RadianInvoice
const labels: Record<RadianColumn, string> = { cufe: 'CUFE', number: 'Número de factura', supplier: 'Proveedor', nit: 'NIT del proveedor', date: 'Fecha de emisión' }
const statusLabels = { sent: 'Enviado', failed: 'Error', unknown: 'Por confirmar', sending: 'Enviando' }
function stored<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }
function save(key: string, data: unknown) { try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* Keep session state if storage is unavailable. */ } }
function readResults(key: string): Results {
  try { return Object.fromEntries(Object.entries(stored<Results>(key, {})).map(([cufe, events]) => [cufe, Object.fromEntries(Object.entries(events).filter(([, state]) => ['sent', 'failed', 'unknown', 'sending'].includes(state ?? '')).map(([id, state]) => [id, state === 'sending' ? 'unknown' : state]))])) } catch { return {} }
}
function readInvoices(key: string): Invoice[] {
  const rows = stored<Invoice[]>(key, [])
  return Array.isArray(rows) ? rows.filter(row => row && typeof row.cufe === 'string' && typeof row.number === 'string' && typeof row.supplier === 'string' && typeof row.nit === 'string' && typeof row.date === 'string').map(row => ({ ...row, valid: isValidCufe(row.cufe) })) : []
}

export default function RadianPage() {
  const { user } = useAuth()
  const companyId = user?.company?.id ?? ''
  return <RadianWorkspace key={companyId} companyId={companyId} />
}

function RadianWorkspace({ companyId }: { companyId: string }) {
  const storageKey = `jarvis:radian:${companyId}`
  const fileInput = useRef<HTMLInputElement>(null)
  const [invoices, setInvoices] = useState<Invoice[]>(() => readInvoices(`${storageKey}:invoices`))
  const invoiceRef = useRef(invoices)
  const [results, setResults] = useState<Results>(() => readResults(storageKey))
  const resultsRef = useRef(results)
  const [eventDetails, setEventDetails] = useState<Record<string, RadianStoredEvent[]>>({})
  const [decisions, setDecisions] = useState<Record<string, RadianDecision>>({})
  const [reasons, setReasons] = useState<JarvisCatalogItem[]>([])
  const [loadingReasons, setLoadingReasons] = useState(false)
  const [sheets, setSheets] = useState<RadianSheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<RadianMapping>({ cufe: '', number: '', supplier: '', nit: '', date: '' })
  const [cufeInput, setCufeInput] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [importSummary, setImportSummary] = useState<{ added: Invoice[]; repeated: Invoice[] } | null>(null)
  const [success, setSuccess] = useState('')
  const [progress, setProgress] = useState<RadianProgress | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [activity, setActivity] = useState('')
  const busy = Boolean(activity) || loadingSaved
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    if (!companyId) return
    setLoadingSaved(true)
    fetchSavedRadianInvoices().then(saved => {
      if (cancelled) return
      const current = new Map(invoiceRef.current.map(invoice => [invoice.cufe, invoice]))
      const nextResults = { ...resultsRef.current }
      const details: Record<string, RadianStoredEvent[]> = {}
      const restored: Record<string, RadianDecision> = {}
      for (const invoice of saved) {
        const cached = current.get(invoice.cufe)
        const { events, ...row } = invoice
        current.set(invoice.cufe, { ...row, number: row.number || cached?.number || '', supplier: row.supplier || cached?.supplier || '', nit: row.nit || cached?.nit || '', date: row.date || cached?.date || '' })
        nextResults[invoice.cufe] = { ...nextResults[invoice.cufe], ...Object.fromEntries(events.map(event => [event.eventId, event.status])) }
        details[invoice.cufe] = events
        const final = events.find(event => [2,4].includes(event.eventId))
        if (final) restored[invoice.cufe] = { eventId: final.eventId as 2 | 4, typeRejectionId: final.typeRejectionId ?? undefined }
      }
      const rows = [...current.values()]
      invoiceRef.current = rows; resultsRef.current = nextResults
      save(storageKey + ':invoices', rows); save(storageKey, nextResults)
      setInvoices(rows); setResults(nextResults); setEventDetails(details); setDecisions(current => ({ ...current, ...restored }))
    }).catch(() => { if (!cancelled) setError('No pudimos recuperar los RADIAN guardados. Se conserva la lista local; vuelve a entrar para intentar la carga.') })
      .finally(() => { if (!cancelled) setLoadingSaved(false) })
    return () => { cancelled = true }
  }, [companyId, storageKey])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const sheet = sheets[sheetIndex]
  const missingFilterColumns = sheet && Object.values(radianFilterColumns(sheet.headers)).some(column => !column)
  const imported = sheet && mapping.cufe ? mapRadianInvoices(sheet, mapping, false) : []
  const decision = (cufe: string): RadianDecision => decisions[cufe] ?? { eventId: results[cufe]?.[2] ? 2 : 4 }
  const complete = (cufe: string) => results[cufe]?.[1] === 'sent' && results[cufe]?.[3] === 'sent' && (results[cufe]?.[4] === 'sent' || results[cufe]?.[2] === 'sent')
  const hasAttempt = (cufe: string) => Object.keys(results[cufe] ?? {}).length > 0 || eventDetails[cufe] !== undefined
  const uncertain = (cufe: string) => [1, 2, 3, 4].some(id => ['unknown', 'sending'].includes(results[cufe]?.[id] ?? ''))
  const finalLocked = (cufe: string) => [2, 4].some(id => results[cufe]?.[id] === 'sent' || ['unknown', 'sending'].includes(results[cufe]?.[id] ?? ''))
  const filtered = invoices.filter(invoice => {
    const text = `${invoice.number} ${invoice.supplier} ${invoice.nit} ${invoice.cufe}`.toLowerCase()
    return (!showRecent || recent.includes(invoice.cufe)) && text.includes(search.toLowerCase()) && (!from || invoice.date >= from) && (!to || invoice.date <= to) && (stateFilter === 'all' || (stateFilter === 'sent' ? complete(invoice.cufe) : stateFilter === 'unknown' ? uncertain(invoice.cufe) : !complete(invoice.cufe) && !uncertain(invoice.cufe)))
  })
  const showPagination = shouldShowTablePagination(filtered.length)
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = showPagination ? Math.min(page, pages) : 1
  const displayed = showPagination ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) : filtered
  const selectable = filtered.filter(invoice => invoice.valid && !complete(invoice.cufe) && !uncertain(invoice.cufe)).map(invoice => invoice.cufe)

  function addRows(rows: RadianInvoice[]) {
    if (!rows.length) return
    const summary = mergeRadianInvoices(invoiceRef.current, rows)
    const next = summary.invoices
    invoiceRef.current = next; save(`${storageKey}:invoices`, next); setInvoices(next)
    setImportSummary(summary)
    setShowRecent(false); setPage(1)
    setNotice(`${summary.added.length} factura(s) nuevas y ${summary.repeated.length} repetidas.`)

  }

  async function addCufe(event: FormEvent) {
    event.preventDefault()
    const cufe = cufeInput.trim().toLowerCase()
    if (!isValidCufe(cufe)) { setError('Ingresa un CUFE válido de 96 caracteres.'); return }
    if (busy || running.current) return
    setError('')
    running.current = true; setActivity('Consultando factura...'); setNotice(''); setSuccess('')
    try {
      const invoice = await lookupRadianInvoice(cufe)
      if (mounted.current) { addRows([invoice]); setCufeInput('') }
    } catch (error) {
      const message = isAxiosError(error) && error.response?.status === 400 ? error.response.data?.message : undefined
      if (mounted.current) setError(typeof message === 'string' && message.trim() ? message : 'No pudimos consultar la factura. Inténtalo más tarde o comunícate con soporte.')
    }
    finally { running.current = false; if (mounted.current) { setActivity(''); setProgress(null) } }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || running.current) return
    running.current = true; setActivity('Leyendo Excel...'); setError(''); setNotice(''); setSuccess('')
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('Tamaño inválido')
      const importedSheets = readRadianWorkbook(await file.arrayBuffer())
      if (!importedSheets.length) throw new Error('Sin registros')
      if (!mounted.current) return
      const index = Math.max(0, importedSheets.findIndex(item => Object.values(radianFilterColumns(item.headers)).every(Boolean)))
      const chosen = importedSheets[index]
      const columns = suggestRadianMapping(chosen.headers)
      setSheets(importedSheets); setSheetIndex(index); setMapping(columns); setSelected([])
      if (Object.values(radianFilterColumns(chosen.headers)).some(column => !column)) setError('El Excel debe incluir Tipo de documento, Forma de Pago y Grupo.')
      else if (!columns.cufe) setError('Selecciona la columna CUFE para agregar las facturas.')
      else { const rows = mapRadianInvoices(chosen, columns, false); if (!rows.length) setNotice('No hay registros que cumplan los criterios de importación RADIAN.'); else addRows(rows) }
    } catch { if (mounted.current) setError('No pudimos leer el Excel. Revisa el archivo y que no supere los 15 MB.') }
    finally { running.current = false; if (mounted.current) setActivity(''); input.value = '' }
  }

  function updateResult(cufe: string, eventId: number, status: RadianStatus) {
    const next = { ...resultsRef.current, [cufe]: { ...resultsRef.current[cufe], [eventId]: status } }
    resultsRef.current = next; save(storageKey, next)
    if (mounted.current) setResults(next)
  }

  async function choose(cufe: string, eventId: 2 | 4) {
    setDecisions(current => ({ ...current, [cufe]: { eventId } }))
    if (eventId === 2 && !reasons.length) {
      setLoadingReasons(true)
      try { const items = await fetchJarvisTypeRejections(); if (mounted.current) setReasons(items) }
      catch { if (mounted.current) setError('No pudimos consultar los motivos de reclamo. Inténtalo más tarde o comunícate con soporte.') }
      finally { if (mounted.current) setLoadingReasons(false) }
    }
  }

  async function send(cufes: string[] = selected) {
    if (running.current || busy || !cufes.length) return
    const eligible = cufes.filter(cufe => invoices.some(row => row.cufe === cufe && row.valid) && !uncertain(cufe) && !complete(cufe))
    if (!eligible.length) return
    if (eligible.some(cufe => decision(cufe).eventId === 2 && !decision(cufe).typeRejectionId)) { setError('Selecciona el motivo de reclamo para cada factura marcada con Reclamo.'); return }
    setProgress({ current: 1, total: eligible.length, cufe: eligible[0] ?? '' }); running.current = true; setActivity('Enviando eventos...'); setError(''); setNotice(''); setSuccess('')
    try {
      const { sent, interrupted } = await processRadianInvoices(eligible, (cufe, id) => resultsRef.current[cufe]?.[id], updateResult, () => mounted.current, decision, setProgress)
      if (mounted.current) {
        setRecent(eligible); setShowRecent(true); setPage(1); setSelected(eligible); setSearch(''); setFrom(''); setTo(''); setStateFilter('all')
        if (sent > 0) setSuccess(sent === 1 ? 'Los eventos RADIAN se enviaron exitosamente.' : `Los eventos RADIAN de ${sent} facturas se enviaron exitosamente.`)
        if (interrupted) setNotice(`${interrupted} factura(s) requieren revisión. Inténtalo más tarde o comunícate con soporte.`)
      }
    } catch { if (mounted.current) setError('No pudimos completar el envío. Inténtalo más tarde o comunícate con soporte.') }
    finally { running.current = false; if (mounted.current) { setActivity(''); setProgress(null) } }
  }

  async function retryInvoice(invoice: Invoice) {
    if (busy || running.current || !invoice.valid || complete(invoice.cufe)) return
    setProgress({ current: 1, total: 1, cufe: invoice.cufe }); running.current = true; setActivity('Verificando y reintentando eventos...'); setError(''); setNotice(''); setSuccess('')
    try {
      const events = await recoverRadianHistory(invoice.cufe)
      if (!mounted.current) return
      setEventDetails(current => ({ ...current, [invoice.cufe]: events }))
      const restored = { ...resultsRef.current, [invoice.cufe]: Object.fromEntries(events.map(event => [event.eventId, event.status])) }
      resultsRef.current = restored; setResults(restored); save(storageKey, restored)
      const savedFinal = events.find(event => [2,4].includes(event.eventId) && event.status !== 'failed')
        ?? events.find(event => [2,4].includes(event.eventId))
      const resumeDecision = savedFinal && (savedFinal.status !== 'failed' || !decisions[invoice.cufe])
        ? { eventId: savedFinal.eventId as 2 | 4, typeRejectionId: savedFinal.typeRejectionId ?? undefined }
        : decision(invoice.cufe)
      setDecisions(current => ({ ...current, [invoice.cufe]: resumeDecision }))
      if (uncertainFromStored(invoice.cufe)) {
        setNotice('El proveedor aún no confirma el resultado. Puedes volver a pulsar Reintentar para verificarlo de nuevo.')
        return
      }
      if ([1, 3, resumeDecision.eventId].every(id => resultsRef.current[invoice.cufe]?.[id] === 'sent')) {
        setSuccess('Los eventos RADIAN de esta factura ya están enviados.')
        return
      }
      if (resumeDecision.eventId === 2 && !resumeDecision.typeRejectionId) {
        setError('Selecciona el motivo de reclamo antes de reintentar.')
        return
      }
      const { sent } = await processRadianInvoices([invoice.cufe], (cufe, id) => resultsRef.current[cufe]?.[id], updateResult, () => mounted.current, () => resumeDecision, setProgress)
      if (mounted.current) {
        if (sent) setSuccess('Los eventos RADIAN se enviaron exitosamente.')
        else setNotice('No se pudo confirmar el envío. Revisa el estado de los eventos antes de continuar.')
      }
    } catch { if (mounted.current) setError('No pudimos completar el reintento. Intenta de nuevo más tarde.') }
    finally { running.current = false; if (mounted.current) { setActivity(''); setProgress(null) } }
  }

  function uncertainFromStored(cufe: string) {
    return [1,2,3,4].some(id => ['unknown', 'sending'].includes(resultsRef.current[cufe]?.[id] ?? ''))
  }

  function badge(cufe: string, id: number) {
    const status = results[cufe]?.[id]
    return <span className={`radian-status radian-status--${status ?? 'empty'}`}>{status ? statusLabels[status] : 'Sin enviar'}</span>
  }

  return <main className="radian-page integration-page">
    <DocumentSendOverlay open={Boolean(activity) && progress !== null} documentTitle="eventos RADIAN" detail={progress ? `Factura ${progress.current} de ${progress.total}${progress.eventId ? ' \u00b7 ' + ({ 1: '030 Acuse', 3: '032 Recepci\u00f3n', 4: '033 Aceptaci\u00f3n', 2: '031 Reclamo' }[progress.eventId]) : ' \u00b7 Verificando eventos'}` : undefined} />
    <p className="radian-page__breadcrumb">Documentos electrónicos › Eventos RADIAN</p>
    <PageHeader title="Procesar eventos RADIAN" description="Selecciona las facturas y registra sus eventos electrónicos ante la DIAN de forma masiva." actions={<Button disabled={busy} onClick={() => fileInput.current?.click()}>▤ Importar Excel de la DIAN</Button>} />
    <input ref={fileInput} hidden type="file" accept=".xlsx,.xls" onChange={event => void upload(event)} />
    <section className="integration-card radian-page__lookup"><h2>Agregar factura por CUFE</h2><p>Ingresa el CUFE para consultar los datos de la factura y registrar sus eventos.</p><form onSubmit={event => void addCufe(event)}><input aria-label="CUFE de la factura" value={cufeInput} onChange={event => setCufeInput(event.target.value)} placeholder="Ingresa el CUFE de la factura" disabled={busy} /><Button type="submit" disabled={busy || !cufeInput.trim()}>Consultar</Button></form></section>
    {importSummary && <div className="radian-page__notice" role="status">
      <strong>{importSummary.added.length} nuevas · {importSummary.repeated.length} repetidas</strong>
      {(['added', 'repeated'] as const).map(kind => importSummary[kind].length > 0 && <details key={kind}><summary>{kind === 'added' ? 'Ver facturas nuevas' : 'Ver facturas repetidas'}</summary><ul>{importSummary[kind].map((invoice, index) => <li key={index}>{invoice.number || invoice.cufe || 'Sin CUFE'}{invoice.supplier ? ' · ' + invoice.supplier : ''}</li>)}</ul></details>)}
    </div>}
    {sheet && <details className="radian-page__upload integration-card"><summary>Columnas del Excel · {imported.length} registros elegibles</summary><p>Tipo de documento: Factura electrónica · Forma de Pago: 2 · Grupo: Recibido.</p>{missingFilterColumns && <ErrorMessage inline message="La hoja debe incluir Tipo de documento, Forma de Pago y Grupo." />}<div className="radian-page__mapping"><label>Hoja<select disabled={busy} value={sheetIndex} onChange={event => { const index = Number(event.target.value); setSheetIndex(index); setMapping(suggestRadianMapping(sheets[index].headers)) }}>{sheets.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label>{(Object.keys(labels) as RadianColumn[]).map(field => <label key={field}>{labels[field]}<select disabled={busy} value={mapping[field]} onChange={event => setMapping(current => ({ ...current, [field]: event.target.value }))}><option value="">Selecciona una columna</option>{sheet.headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div><Button disabled={busy || !imported.length} onClick={() => addRows(imported)}>Agregar facturas del Excel</Button></details>}
    {success && <DocumentNotice variant="success" title="Envío exitoso" message={success} onDismiss={() => setSuccess('')} />}{loadingSaved && <p role="status">Recuperando RADIAN guardados...</p>}{error && <ErrorMessage message={error} />}{(activity || notice) && <p role="status" className="radian-page__notice">{activity || notice}</p>}
    <section className="integration-card radian-page__list">
      <div className="integration-card-header radian-page__heading"><div><h2>Facturas recibidas <span>{invoices.length}</span></h2><p>Selecciona una o varias facturas para procesar los eventos.</p></div><div className="radian-page__actions"><Button disabled={busy || loadingReasons || !selected.some(cufe => selectable.includes(cufe))} onClick={() => void send()}>Enviar eventos{selected.length ? ` (${selected.length})` : ''}</Button></div></div>
      {recent.length > 0 && <div className="radian-page__recent"><label><input type="checkbox" checked={showRecent} onChange={event => { setShowRecent(event.target.checked); setPage(1) }} />Mostrar solo los que acabo de enviar</label>{showRecent && <Button variant="ghost" onClick={() => setShowRecent(false)}>Mostrar todo</Button>}</div>}
      <div className="radian-page__filters"><label>Buscar factura<input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Número, proveedor, NIT o CUFE" /></label><label>Estado eventos<select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="sent">Completados</option><option value="unknown">Por confirmar</option></select></label><DateRangeFilter from={from} to={to} onApply={range => { setFrom(range.dateFrom ?? ''); setTo(range.dateTo ?? ''); setPage(1) }} /></div>
      <div className="radian-page__table"><table className="integration-table"><colgroup>{[3, 12, 10, 22, 8, 8, 15, 12, 10].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr><th rowSpan={2}><input type="checkbox" aria-label="Seleccionar facturas filtradas" disabled={busy || !selectable.length} checked={selectable.length > 0 && selectable.every(cufe => selected.includes(cufe))} onChange={event => setSelected(event.target.checked ? [...new Set([...selected, ...selectable])] : selected.filter(cufe => !selectable.includes(cufe)))} /></th><th rowSpan={2}>Factura</th><th rowSpan={2}>Fecha de emisión</th><th rowSpan={2}>Proveedor</th><th colSpan={3}>Eventos RADIAN</th><th rowSpan={2}>Estado general</th><th rowSpan={2} className="radian-page__row-actions">Acciones</th></tr><tr><th>030<br />Acuse</th><th>032<br />Recepción</th><th>Aceptación /<br />Reclamo</th></tr></thead><tbody>{displayed.map((invoice, index) => <tr key={invoice.cufe || index}><td><input type="checkbox" aria-label={`Seleccionar factura ${invoice.number || invoice.cufe}`} disabled={busy || !invoice.valid || complete(invoice.cufe) || uncertain(invoice.cufe)} checked={selected.includes(invoice.cufe)} onChange={event => setSelected(current => event.target.checked ? [...current, invoice.cufe] : current.filter(cufe => cufe !== invoice.cufe))} /></td><td><strong>{invoice.number || 'Sin número'}</strong><details><summary>Ver CUFE</summary><small className="radian-page__cufe">{invoice.cufe || 'Sin CUFE'}</small></details>{eventDetails[invoice.cufe]?.map(event => <details key={event.eventId}><summary>Evento {event.eventId} · {statusLabels[event.status]}</summary>{event.cude && <small className="radian-page__cufe">CUDE: {event.cude}</small>}{event.message && <p>{clientFacingError(event.message)}</p>}</details>)}</td><td>{invoice.date ? invoice.date.split('-').reverse().join('/') : '—'}</td><td><strong>{invoice.supplier || 'Sin proveedor'}</strong><small>{invoice.nit}</small></td><td>{badge(invoice.cufe, 1)}</td><td>{badge(invoice.cufe, 3)}</td><td><div className="radian-page__decision"><select aria-label={`Aceptación o reclamo de ${invoice.number}`} value={decision(invoice.cufe).eventId} disabled={busy || finalLocked(invoice.cufe)} onChange={event => void choose(invoice.cufe, Number(event.target.value) as 2 | 4)}><option value={4}>033 · Aceptación</option><option value={2}>031 · Reclamo</option></select>{decision(invoice.cufe).eventId === 2 && !finalLocked(invoice.cufe) && <select aria-label={`Motivo de reclamo de ${invoice.number}`} disabled={busy || loadingReasons} value={decision(invoice.cufe).typeRejectionId ?? ''} onChange={event => setDecisions(current => ({ ...current, [invoice.cufe]: { eventId: 2, typeRejectionId: event.target.value ? Number(event.target.value) : undefined } }))}><option value="">{loadingReasons ? 'Consultando motivos...' : 'Selecciona el motivo'}</option>{reasons.map(reason => <option key={reason.id} value={reason.id}>{reason.name}</option>)}</select>}{badge(invoice.cufe, decision(invoice.cufe).eventId)}</div></td><td><span className={`radian-status radian-status--${complete(invoice.cufe) ? 'sent' : 'empty'}`}>{!invoice.valid ? 'CUFE inválido' : complete(invoice.cufe) ? 'Completado' : uncertain(invoice.cufe) ? 'Por confirmar' : [1, 2, 3, 4].some(id => results[invoice.cufe]?.[id]) ? 'En proceso' : 'Pendiente'}</span></td><td className="radian-page__row-actions">{invoice.valid && !complete(invoice.cufe) && <Button variant="outline" size="sm" className="radian-page__retry" disabled={busy} onClick={() => void (hasAttempt(invoice.cufe) ? retryInvoice(invoice) : send([invoice.cufe]))} aria-label={`${hasAttempt(invoice.cufe) ? 'Reintentar' : 'Enviar'} eventos de ${invoice.number || invoice.cufe}`}>{hasAttempt(invoice.cufe) ? 'Reintentar' : 'Enviar'}</Button>}</td></tr>)}</tbody></table>{!displayed.length && <p className="radian-page__empty">No hay facturas en esta vista. Agrega un CUFE o importa un Excel de la DIAN.</p>}</div>
      {showPagination && <footer className="radian-page__pagination"><span>{filtered.length} facturas · {selected.length} seleccionadas</span><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button><select aria-label="Facturas por página" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option>5</option><option>10</option><option>25</option></select></footer>}
    </section>
  </main>
}
