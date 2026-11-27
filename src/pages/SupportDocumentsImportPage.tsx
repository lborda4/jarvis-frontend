import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ExcelImportLayout from '../components/ExcelImportLayout'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import CreateTercerosBulkModal, { type PendingSupplierRow } from '../components/CreateTercerosBulkModal'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisMunicipalities, fetchJarvisTerceros } from '../services/jarvisService'
import { getActiveCompanyId } from '../services/queryCache'
import { assignSupportDraftIds, downloadSupportImportTemplate, fetchSupportImportCatalogs, MissingSupportSuppliersError } from '../services/supportDocumentsImportService'
import { sendImportedSupportDocuments } from '../services/supportDocumentsBulkSendService'
import { createSupportImportSuppliers } from '../services/supportImportSuppliersService'
import { JARVIS_DOCUMENT_TYPE_OPTIONS, type JarvisMunicipality, type JarvisTercero } from '../types/jarvis'
import { readSupportDocumentsWorkbook, resolveSupportSuppliers, SUPPORT_IMPORT_MAX_BYTES, supportSupplierKey, type InvoiceImportKind, type SupportImportRow } from '../utils/supportDocumentsExcel'
import { shouldShowTablePagination } from '../utils/tablePagination'
import './SupportDocumentsImportPage.css'

const PAGE_SIZE = 10
const labels: Record<SupportImportRow['status'], string> = { ready: 'Listo', invalid: 'Revisar Excel', missing_supplier: 'NIT sin registrar', saved: 'Guardado', duplicate: 'Omitido', failed: 'No guardado' }

export default function SupportDocumentsImportPage({ kind = 'support' }: { kind?: InvoiceImportKind }) {
  const sales = kind === 'sales'
  const listPath = sales ? '/factura-venta' : '/documento-soporte'
  const newPath = sales ? '/factura-venta/nueva' : '/documento-soporte/nuevo'
  const documentLabel = sales ? 'facturas de venta' : 'documentos soporte'
  const navigate = useNavigate()
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState<SupportImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState<SupportImportRow | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSuppliers, setBulkSuppliers] = useState<PendingSupplierRow[]>([])
  const [municipalities, setMunicipalities] = useState<JarvisMunicipality[]>([])
  const [products, setProducts] = useState<Array<{ sku: string; name?: string }>>([])
  const busyRef = useRef(false)
  const previewCompanyRef = useRef<string | null>(null)
  const invalid = rows.filter(row => row.errors.length).length
  const missing = useMemo(() => [...new Map(rows.filter(row => !row.state.selectedCustomer && !row.delivery && row.status !== 'duplicate'
    && JARVIS_DOCUMENT_TYPE_OPTIONS.some(option => option.value === row.documentType)
    && (['NIT', 'CC'].includes(row.documentType) ? /^\d+$/ : /^[a-z\d]+$/i).test(row.identification))
    .map(row => [supportSupplierKey(row.documentType, row.identification), row])).values()], [rows])
  const pendingSuppliers = useMemo<PendingSupplierRow[]>(() => missing.map(row => ({ document_id: supportSupplierKey(row.documentType, row.identification),
    document_type: row.documentType, document_number: row.identification, name: null, email: null })), [missing])
  const saved = rows.filter(row => row.status === 'saved' && !row.delivery).length
  const failed = rows.filter(row => row.status === 'failed').length
  const pending = rows.filter(row => !row.delivery && ['ready', 'failed', 'saved'].includes(row.status)).length
  const sent = rows.filter(row => row.delivery === 'sent').length
  const uncertain = rows.filter(row => row.delivery === 'uncertain').length
  const omitted = rows.filter(row => row.status === 'duplicate').length
  const summary = [
    `${sales ? 'Facturas' : 'Documentos'}: ${rows.length}`,
    ...[
      ['Pendientes', pending], ['Enviados', sent], ['Por confirmar', uncertain], ['Guardados', saved],
      ['Omitidos', omitted], ['Con errores', invalid], ['Terceros faltantes', missing.length], ['No guardados', failed],
    ].filter(([, count]) => Number(count) > 0).map(([label, count]) => `${label}: ${count}`),
  ].join(' · ')
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const showPagination = shouldShowTablePagination(rows.length, PAGE_SIZE)
  const visible = showPagination ? rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : rows
  const actionsDisabled = Boolean(busy) || Boolean(creating) || bulkOpen
  const updateRows = (updates: SupportImportRow[]) => {
    const byRow = new Map(updates.map(row => [row.row, row]))
    setRows(current => current.map(row => byRow.get(row.row) ?? row))
  }

  const run = async (label: string, action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(label)
    setError('')
    try { await action() }
    catch (failure) {
      if (failure instanceof MissingSupportSuppliersError) updateRows(failure.rows)
      setError(getApiErrorMessage(failure, 'No se pudo completar la operación. Puedes reintentar.'))
    } finally { busyRef.current = false; setBusy('') }
  }
  const readFile = (file: File) => {
    void run('Leyendo y validando el Excel…', async () => {
      setRows([]); setPage(1); setFileName(file.name); setSuccess('')
      const company = getActiveCompanyId()
      previewCompanyRef.current = company
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Selecciona un Excel .xlsx o .xls con el formato de la plantilla.')
      if (file.size > SUPPORT_IMPORT_MAX_BYTES) throw new Error('El archivo no debe superar 5 MB.')
      const [buffer, catalogs, suppliers] = await Promise.all([file.arrayBuffer(), fetchSupportImportCatalogs(kind), fetchJarvisTerceros(undefined, { force: true })])
      const parsed = await assignSupportDraftIds(readSupportDocumentsWorkbook(buffer, catalogs, suppliers.items, kind), company, kind)
      if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
      setRows(parsed)
      setProducts(catalogs.products ?? [])
    })
  }
  const revalidate = () => void run('Validando terceros…', async () => {
    if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
    const suppliers = await fetchJarvisTerceros(undefined, { force: true })
    if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
    setRows(current => resolveSupportSuppliers(current, suppliers.items, kind))
  })
  const createSelectedSuppliers = async (selected: PendingSupplierRow[]) => {
    if (busyRef.current) throw new Error('Espera a que termine la operación actual.')
    if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
    if (selected.some(row => !municipalities.some(city => city.id === row.municipality_id))) throw new Error('Selecciona la ciudad de cada tercero.')
    busyRef.current = true
    setBusy('Creando terceros…'); setError('')
    try {
      const { suppliers, failures } = await createSupportImportSuppliers(selected, previewCompanyRef.current)
      setRows(current => resolveSupportSuppliers(current, suppliers, kind))
      if (failures.length) throw new Error(failures.join(' · '))
    } finally { busyRef.current = false; setBusy('') }
  }
  const handleCreated = (supplier: JarvisTercero) => {
    setCreating(null)
    if (previewCompanyRef.current !== getActiveCompanyId()) { setError('La empresa activa cambió. Vuelve a cargar el archivo.'); return }
    setRows(current => resolveSupportSuppliers(current, [...current.flatMap(row => row.state.selectedCustomer ? [row.state.selectedCustomer as JarvisTercero] : []), supplier], kind))
  }
  const send = (selectedRows: SupportImportRow[] = rows) => {
    if (selectedRows.some(row => row.errors.length || !row.state.selectedCustomer)
      || !selectedRows.some(row => !row.delivery && ['ready', 'failed', 'saved'].includes(row.status))) return
    void run(selectedRows.length === 1 ? 'Enviando documento a DIAN…' : 'Guardando y enviando documentos a DIAN…', async () => {
      if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
      const attempted = new Set<number>()
      const completed = new Set<number>()
      const result = await sendImportedSupportDocuments(selectedRows, update => {
        if (update.delivery === 'sending') attempted.add(update.row)
        if (update.delivery === 'sent' && attempted.has(update.row)) completed.add(update.row)
        updateRows([update])
      }, kind)
      updateRows(result)
      if (completed.size > 0) setSuccess(`Enviados a DIAN: ${completed.size}.`)
    })
  }

  return <><ExcelImportLayout
    presentation="page"
    title={`Importar ${documentLabel}`}
    reviewTitle={sales ? 'Facturas' : 'Documentos'}
    className="support-import" fileName={fileName} hasPreview={rows.length > 0}
    autoReview busy={actionsDisabled} downloading={busy === 'Descargando plantilla…'} status={busy || undefined}
    importLabel={pending ? `Enviar a DIAN (${pending})` : 'Enviar a DIAN'}
    importDisabled={Boolean(invalid) || missing.length > 0 || !pending} finished={!pending && !invalid && !missing.length}
    onDownload={() => void run('Descargando plantilla…', () => downloadSupportImportTemplate(kind))}
    onFile={readFile} onImport={() => send()} onClose={() => navigate(listPath)}
    notice={<>{error && <ErrorMessage inline message={error} />}{success && <SuccessMessage message={success} />}</>}
  >
    {sales && <p>Usa un grupo único para cada factura, incluso entre archivos, y repítelo en sus ítems. Las facturas se emiten con la fecha actual de Colombia; usa esa fecha en el Excel. Si un envío queda por confirmar, revisa el historial antes de intentar nuevamente.</p>}
    {rows.length > 0 && <>
      <p role="status" className="support-import__summary">{summary}</p>
      {uncertain > 0 && <p role="alert">Envíos por confirmar. Revisa el historial antes de reenviar.</p>}
      {invalid > 0 && <p role="alert">Corrige los errores y vuelve a subir el Excel.</p>}
      {missing.length > 0 && <div className="support-import__file-actions" role="group" aria-label="Acciones de terceros">
        <Button variant="outline" disabled={actionsDisabled} onClick={() => void run('Cargando ciudades…', async () => {
          if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
          const result = await fetchJarvisMunicipalities()
          if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
          setMunicipalities(result.items); setBulkSuppliers(pendingSuppliers); setBulkOpen(true)
        })}>Crear varios terceros ({missing.length})</Button>
        <Button variant="ghost" disabled={actionsDisabled} onClick={revalidate}>Validar terceros</Button>
      </div>}
      <div className="support-import__table-wrap" tabIndex={0} aria-label={`Revisión de ${documentLabel}`}>
        <table className="integration-table">
          <colgroup>
            <col className="support-import__col--reference" /><col className="support-import__col--identification" />
            <col className="support-import__col--company" /><col className="support-import__col--product" />
            <col className="support-import__col--code" /><col className="support-import__col--total" />
            <col className="support-import__col--status" /><col className="support-import__col--actions" />
          </colgroup>
          <thead><tr><th>Referencia</th><th>NIT / ID</th><th>{sales ? 'Cliente' : 'Empresa'}</th><th>Producto</th><th>Código</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{visible.flatMap(row => row.state.lines.map((line, index) => <tr key={`${row.row}-${line.id}`}>
            {index === 0 && <>
              <td rowSpan={row.state.lines.length}><strong>{row.reference || 'Sin referencia'}</strong><span>Filas {row.sourceRows.join(', ')}</span></td>
              <td rowSpan={row.state.lines.length}>{row.documentType} {row.identification}</td>
              <td rowSpan={row.state.lines.length}>{row.state.selectedCustomer?.name || 'Tercero sin crear'}</td>
            </>}
            <td className="support-import__product"><strong>{products.find(product => product.sku === line.code)?.name || line.description}</strong>
              {products.find(product => product.sku === line.code)?.name && <span>{line.description}</span>}</td>
            <td>{line.code || 'Automático al emitir'}</td>
            {index === 0 && <>
            <td rowSpan={row.state.lines.length} className="support-import__amount">{row.state.documentTotal?.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span>{row.state.currency}</span></td>
            <td rowSpan={row.state.lines.length} className="support-import__result"><strong className={`support-import__status support-import__status--${row.delivery || row.status}`}>{row.delivery === 'sent' ? 'Enviado a DIAN' : row.delivery === 'sending' ? 'Enviando…' : row.delivery === 'uncertain' ? 'Por confirmar' : labels[row.status]}</strong>
              {row.errors.length > 0 ? <ul>{row.errors.map((message, i) => <li key={i}>{message}</li>)}</ul> : row.status !== 'missing_supplier' && row.message && <span>{row.message}</span>}
              {row.draftId && !row.delivery && (row.status === 'saved' || row.status === 'duplicate') && <a href={`${newPath}?borrador=${encodeURIComponent(row.draftId)}`} target="_blank" rel="noopener noreferrer">{sales ? 'Abrir factura' : 'Abrir documento'}</a>}
              {row.delivery && <a href={row.invoiceId ? `${listPath}/${encodeURIComponent(row.invoiceId)}/visualizar` : listPath} target="_blank" rel="noopener noreferrer">Ver en historial</a>}
            </td>
            <td rowSpan={row.state.lines.length} className="support-import__row-actions">
              {missing.some(supplier => supportSupplierKey(supplier.documentType, supplier.identification) === supportSupplierKey(row.documentType, row.identification))
                ? <Button variant="outline" size="sm" disabled={actionsDisabled} onClick={() => setCreating(row)} aria-label={`Crear tercero ${row.identification}`}>Crear tercero</Button>
                : row.state.selectedCustomer && !row.delivery && row.status !== 'duplicate'
                  ? <Button size="sm" disabled={actionsDisabled || row.errors.length > 0} onClick={() => send([row])}
                    title={row.errors.length ? 'Corrige los errores del Excel antes de enviar.' : 'Enviar este documento a DIAN'}
                    aria-label={`Enviar ${row.reference} a DIAN`}>Enviar</Button>
                  : '—'}
            </td>
            </>}
          </tr>))}</tbody>
        </table>
      </div>
      {showPagination && <nav className="support-import__pagination" aria-label={`Páginas de la revisión de ${documentLabel}`}>
        <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>Página {currentPage} de {pages}</span>
        <Button variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
      </nav>}
    </>}
  </ExcelImportLayout>
  {creating && createPortal(<CreateJarvisTerceroModal isOpen expectedCompanyId={previewCompanyRef.current} initialDocumentType={creating.documentType} initialDocumentNumber={creating.identification}
    onClose={() => setCreating(null)} onCreated={handleCreated} />, document.body)}
  {bulkOpen && createPortal(<CreateTercerosBulkModal isOpen onClose={() => setBulkOpen(false)} suppliers={bulkSuppliers} municipalities={municipalities}
    title="Crear terceros del Excel" descriptionLines={['Selecciona los terceros y completa sus datos.']} onSubmit={createSelectedSuppliers} />, document.body)}
  </>
}
