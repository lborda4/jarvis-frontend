import { useRef, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import ExcelImportLayout from './ExcelImportLayout'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisTerceros } from '../services/jarvisService'
import { downloadTercerosTemplate, fetchTercerosImportCatalogs, saveImportedTerceros } from '../services/jarvisTercerosImportService'
import { getActiveCompanyId } from '../services/queryCache'
import { readTercerosWorkbook, TERCEROS_IMPORT_MAX_BYTES, type TerceroImportRow } from '../utils/jarvisTercerosExcel'
import { shouldShowTablePagination } from '../utils/tablePagination'
import './ImportJarvisTercerosModal.css'

const PAGE_SIZE = 10
const statusLabels: Record<TerceroImportRow['status'], string> = {
  ready: 'Listo para guardar', invalid: 'Revisar', duplicate: 'Omitido', saved: 'Guardado', failed: 'No guardado',
}

export default function ImportJarvisTercerosModal({ onClose, onImported }: { onClose: () => void; onImported: (saved: number) => void }) {
  const [rows, setRows] = useState<TerceroImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [page, setPage] = useState(1)
  const busyRef = useRef(false)
  const previewCompanyRef = useRef<string | null>(null)
  const busy = isReading || isSaving || isDownloading
  const invalid = rows.filter(row => row.status === 'invalid').length
  const pending = rows.filter(row => row.status === 'ready' || row.status === 'failed').length
  const saved = rows.filter(row => row.status === 'saved').length
  const failed = rows.filter(row => row.status === 'failed').length
  const duplicates = rows.filter(row => row.status === 'duplicate').length
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const showPagination = shouldShowTablePagination(rows.length, PAGE_SIZE)
  const visible = showPagination ? rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : rows

  const download = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setIsDownloading(true)
    setError('')
    try { await downloadTercerosTemplate() }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo descargar la plantilla. Vuelve a intentarlo.')) }
    finally { busyRef.current = false; setIsDownloading(false) }
  }

  const readFile = async (file: File) => {
    if (busyRef.current) return
    busyRef.current = true
    setIsReading(true)
    setRows([])
    setPage(1)
    setFileName(file.name)
    setError('')
    const company = getActiveCompanyId()
    previewCompanyRef.current = company
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Selecciona un archivo Excel .xlsx o .xls con el formato de la plantilla.')
      if (file.size > TERCEROS_IMPORT_MAX_BYTES) throw new Error('El archivo no debe superar 5 MB.')
      const [buffer, catalogs, existing] = await Promise.all([
        file.arrayBuffer(), fetchTercerosImportCatalogs(), fetchJarvisTerceros(undefined, { force: true }),
      ])
      if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
      setRows(readTercerosWorkbook(buffer, catalogs, existing.items))
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'No pudimos leer el archivo. Revisa que use el formato de la plantilla.'))
    } finally { busyRef.current = false; setIsReading(false) }
  }

  const save = async () => {
    if (busyRef.current || invalid || !pending) return
    busyRef.current = true
    setIsSaving(true)
    setError('')
    try {
      if (previewCompanyRef.current !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo antes de guardar.')
      const result = await saveImportedTerceros(rows, updated => {
        setRows(current => current.map(row => row.row === updated.row ? updated : row))
      })
      setRows(result)
      const newSaved = result.filter(row => row.status === 'saved').length - saved
      if (newSaved > 0) onImported(newSaved)
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'No se pudo guardar la carga. Puedes reintentar.'))
    } finally { busyRef.current = false; setIsSaving(false) }
  }

  return <ExcelImportLayout
    title="Importar terceros"
    description="Agrega múltiples terceros a tu empresa Jarvis usando un archivo Excel."
    templateDescription={<>Completa la hoja Terceros con tipo de documento, número y nombre / razón social. Puedes incluir datos de contacto y tributarios. Hasta 1.000 terceros.</>}
    reviewDescription="Revisa los terceros válidos y corrige los errores antes de importarlos. Te mostraremos los registros por crear y los que requieren ajuste; los documentos existentes o repetidos se omiten."
    className="terceros-import" fileName={fileName} hasPreview={rows.length > 0}
    busy={busy} downloading={isDownloading}
    status={isReading ? 'Leyendo y validando el Excel…' : isSaving ? `Importando terceros… (${saved} guardados)` : undefined}
    notice={error && <ErrorMessage inline message={error} />}
    importLabel={failed > 0 ? `Reintentar ${pending} pendientes` : `Importar ${pending} terceros`}
    importDisabled={invalid > 0 || pending === 0} finished={pending === 0 && invalid === 0}
    onDownload={() => void download()} onFile={file => void readFile(file)} onImport={() => void save()} onClose={onClose}
  >
    {rows.length > 0 && <>
      <p className="terceros-import__filename">Archivo: <strong>{fileName}</strong></p>
      <p role="status" className="terceros-import__summary">{rows.length} registros · {pending - failed} listos · {saved} guardados · {duplicates} omitidos · {invalid} con errores · {failed} no guardados</p>
      {invalid > 0 && <p role="alert">Corrige las filas con errores en el Excel y vuelve a cargarlo antes de guardar.</p>}
      <div className="terceros-import__table-wrap" tabIndex={0} aria-label="Revisión de terceros del Excel">
        <table className="integration-table">
          <thead><tr><th>Fila</th><th>Documento</th><th>Nombre / razón social</th><th>Resultado</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.row}>
            <td>{row.row}</td><td>{row.documentType} {row.documentNumber}</td><td>{row.name || '—'}</td>
            <td><strong className={`terceros-import__status terceros-import__status--${row.status}`}>{statusLabels[row.status]}</strong>
              {row.errors.length > 0 ? <ul>{row.errors.map(message => <li key={message}>{message}</li>)}</ul> : row.message && <span>{row.message}</span>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {showPagination && <nav className="terceros-import__pagination" aria-label="Páginas de la revisión de terceros">
        <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
        <span>Página {currentPage} de {totalPages}</span>
        <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
      </nav>}
    </>}
  </ExcelImportLayout>
}
