import { useRef, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import ExcelImportLayout from './ExcelImportLayout'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisTerceros } from '../services/jarvisService'
import { getActiveCompanyId } from '../services/queryCache'
import { assignSalesDraftIds, downloadSalesImportTemplate, fetchSalesImportCatalogs, MissingSalesCustomersError, saveImportedSalesInvoices } from '../services/salesInvoicesImportService'
import { readSalesInvoicesWorkbook, resolveSalesCustomers, SALES_IMPORT_MAX_BYTES, salesCustomerKey, type SalesInvoiceImportRow } from '../utils/salesInvoicesExcel'
import { shouldShowTablePagination } from '../utils/tablePagination'
import './ImportSalesInvoicesModal.css'

const PAGE_SIZE = 10
const labels: Record<SalesInvoiceImportRow['status'], string> = { ready: 'Listo', invalid: 'Revisar Excel', missing_supplier: 'Crear tercero primero', saved: 'Guardado', duplicate: 'Omitido', failed: 'No guardado' }

export default function ImportSalesInvoicesModal({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const [rows, setRows] = useState<SalesInvoiceImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [page, setPage] = useState(1)
  const busyRef = useRef(false)
  const previewCompanyRef = useRef<string | null>(null)
  const invalid = rows.filter(row => row.errors.length).length
  const missing = [...new Map(rows.filter(row => row.status === 'missing_supplier').map(row => [salesCustomerKey(row.documentType, row.identification), row])).values()]
  const saved = rows.filter(row => row.status === 'saved').length
  const failed = rows.filter(row => row.status === 'failed').length
  const pending = rows.filter(row => row.status === 'ready' || row.status === 'failed').length
  const omitted = rows.filter(row => row.status === 'duplicate').length
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const showPagination = shouldShowTablePagination(rows.length, PAGE_SIZE)
  const visible = showPagination ? rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : rows

  const run = async (label: string, action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(label)
    setError('')
    try { await action() }
    catch (failure) {
      if (failure instanceof MissingSalesCustomersError) setRows(failure.rows)
      setError(getApiErrorMessage(failure, 'No se pudo completar la operación. Puedes reintentar.'))
    } finally { busyRef.current = false; setBusy('') }
  }
  const readFile = (file: File) => {
    void run('Leyendo y validando el Excel…', async () => {
      setRows([]); setPage(1); setFileName(file.name)
      const company = getActiveCompanyId()
      previewCompanyRef.current = company
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Selecciona un Excel .xlsx o .xls con el formato de la plantilla.')
      if (file.size > SALES_IMPORT_MAX_BYTES) throw new Error('El archivo no debe superar 5 MB.')
      const [buffer, catalogs, suppliers] = await Promise.all([file.arrayBuffer(), fetchSalesImportCatalogs(), fetchJarvisTerceros(undefined, { force: true })])
      const parsed = await assignSalesDraftIds(readSalesInvoicesWorkbook(buffer, catalogs, suppliers.items), company)
      if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
      setRows(parsed)
    })
  }
  const revalidate = () => void run('Validando terceros…', async () => {
    if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
    const suppliers = await fetchJarvisTerceros(undefined, { force: true })
    if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
    setRows(current => resolveSalesCustomers(current, suppliers.items))
  })
  const save = () => {
    if (invalid || missing.length || !pending) return
    void run('Guardando facturas de venta…', async () => {
      if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
      const result = await saveImportedSalesInvoices(rows, update => setRows(current => current.map(row => row.row === update.row ? update : row)))
      setRows(result)
      const created = result.filter(row => row.status === 'saved').length - saved
      if (created > 0) onImported(created)
    })
  }

  return <ExcelImportLayout
    title="Importar facturas de venta"
    description="Crea múltiples facturas de venta en Jarvis usando un archivo Excel."
    templateDescription={<>Completa referencia, fecha, tipo de documento, NIT / identificación, descripción, cantidad, valor unitario y forma de pago. Repite la referencia para agrupar ítems. Hasta 1.000 filas.</>}
    reviewDescription="Revisa las facturas y corrige los errores antes de importarlas. Los clientes deben existir en Terceros. Quedarán guardadas para revisar y enviar a DIAN; las referencias ya guardadas se omiten."
    className="sales-import" fileName={fileName} hasPreview={rows.length > 0}
    busy={Boolean(busy)} downloading={busy === 'Descargando plantilla…'} status={busy || undefined}
    importLabel={failed > 0 ? `Reintentar ${pending} pendientes` : `Importar ${pending} facturas`}
    importDisabled={Boolean(invalid) || missing.length > 0 || !pending} finished={!pending && !invalid && !missing.length}
    onDownload={() => void run('Descargando plantilla…', downloadSalesImportTemplate)}
    onFile={readFile} onImport={save} onClose={onClose}
    notice={<>
    {error && <ErrorMessage inline message={error} />}
    {missing.length > 0 && <div className="sales-import__missing" role="alert">
      <strong>Debes crear primero estos clientes en Terceros.</strong>
      <p>La carga está bloqueada hasta que todos existan en Jarvis. Los enlaces abren Terceros en otra pestaña para conservar tu Excel.</p>
      <ul>{missing.map(row => <li key={salesCustomerKey(row.documentType, row.identification)}>{row.documentType} {row.identification}{' '}
        <a href={`/terceros?create=1&document_type=${encodeURIComponent(row.documentType)}&document_number=${encodeURIComponent(row.identification)}`} target="_blank" rel="noopener noreferrer">Crear tercero</a>
      </li>)}</ul>
      <Button variant="outline" disabled={Boolean(busy)} onClick={revalidate}>Volver a validar terceros</Button>
    </div>}
    </>}
  >
    {rows.length > 0 && <>
      <p className="sales-import__filename">Archivo: <strong>{fileName}</strong></p>
      <p role="status" className="sales-import__summary">{rows.length} facturas · {pending - failed} listas · {saved} guardadas · {omitted} omitidas · {invalid} con errores · {missing.length} clientes faltantes · {failed} no guardadas</p>
      {invalid > 0 && <p role="alert">Corrige los errores indicados y vuelve a cargar el Excel.</p>}
      <div className="sales-import__table-wrap" tabIndex={0} aria-label="Revisión de facturas de venta">
        <table className="integration-table"><thead><tr><th>Referencia / filas</th><th>Cliente</th><th>Ítems</th><th>Total</th><th>Resultado</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.row}>
            <td><strong>{row.reference || 'Sin referencia'}</strong><span>Filas {row.sourceRows.join(', ')}</span></td>
            <td>{row.documentType} {row.identification}<span>{row.state.selectedCustomer?.name}</span></td>
            <td>{row.state.lines.length}</td><td>{row.state.documentTotal?.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.state.currency}</td>
            <td><strong className={`sales-import__status sales-import__status--${row.status}`}>{labels[row.status]}</strong>
              {row.errors.length > 0 ? <ul>{row.errors.map((message, i) => <li key={i}>{message}</li>)}</ul> : row.message && <span>{row.message}</span>}
              {row.draftId && (row.status === 'saved' || row.status === 'duplicate') && <a href={`/factura-venta/nueva?borrador=${encodeURIComponent(row.draftId)}`} target="_blank" rel="noopener noreferrer">Abrir factura</a>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {showPagination && <nav className="sales-import__pagination" aria-label="Páginas de la revisión de facturas de venta">
        <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>Página {currentPage} de {pages}</span>
        <Button variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
      </nav>}
    </>}
  </ExcelImportLayout>
}
