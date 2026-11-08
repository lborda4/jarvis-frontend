import { useRef, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import ExcelImportLayout from './ExcelImportLayout'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchProducts } from '../services/productService'
import { downloadProductsTemplate, fetchProductsImportCatalogs, saveImportedProducts } from '../services/productsImportService'
import { getActiveCompanyId } from '../services/queryCache'
import { readProductsWorkbook, PRODUCTS_IMPORT_MAX_BYTES, type ProductImportRow } from '../utils/productsExcel'
import { shouldShowTablePagination } from '../utils/tablePagination'
import './ImportProductsModal.css'

const PAGE_SIZE = 10
const statusLabels: Record<ProductImportRow['status'], string> = {
  ready: 'Listo para guardar', invalid: 'Revisar', duplicate: 'Omitido', saved: 'Guardado', failed: 'No guardado',
}

export default function ImportProductsModal({ onClose, onImported }: { onClose: () => void; onImported: (saved: number) => void }) {
  const [rows, setRows] = useState<ProductImportRow[]>([])
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
    try { await downloadProductsTemplate() }
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
      if (file.size > PRODUCTS_IMPORT_MAX_BYTES) throw new Error('El archivo no debe superar 5 MB.')
      const [buffer, catalogs, existing] = await Promise.all([
        file.arrayBuffer(), fetchProductsImportCatalogs(), fetchProducts(undefined, { force: true }),
      ])
      if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
      setRows(readProductsWorkbook(buffer, catalogs, existing.items))
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
      const result = await saveImportedProducts(rows, updated => {
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
    title="Importar productos"
    description="Agrega múltiples productos o servicios a tu catálogo usando un archivo Excel."
    templateDescription={<>Completa la hoja Productos con código / SKU, nombre, tipo, unidad DIAN y precio. Puedes incluir categoría, impuestos y listas de precios. Hasta 1.000 productos.</>}
    reviewDescription="Revisa los productos válidos y corrige los errores antes de importarlos. Te mostraremos los registros por crear y los que requieren ajuste; los SKU existentes o repetidos se omiten."
    className="productos-import" fileName={fileName} hasPreview={rows.length > 0}
    busy={busy} downloading={isDownloading}
    status={isReading ? 'Leyendo y validando el Excel…' : isSaving ? `Importando productos… (${saved} guardados)` : undefined}
    notice={error && <ErrorMessage inline message={error} />}
    importLabel={failed > 0 ? `Reintentar ${pending} pendientes` : `Importar ${pending} productos`}
    importDisabled={invalid > 0 || pending === 0} finished={pending === 0 && invalid === 0}
    onDownload={() => void download()} onFile={file => void readFile(file)} onImport={() => void save()} onClose={onClose}
  >
    {rows.length > 0 && <>
      <p className="productos-import__filename">Archivo: <strong>{fileName}</strong></p>
      <p role="status" className="productos-import__summary">{rows.length} registros · {pending - failed} listos · {saved} guardados · {duplicates} omitidos · {invalid} con errores · {failed} no guardados</p>
      {invalid > 0 && <p role="alert">Corrige las filas con errores en el Excel y vuelve a cargarlo antes de guardar.</p>}
      <div className="productos-import__table-wrap" tabIndex={0} aria-label="Revisión de productos del Excel">
        <table className="integration-table">
          <thead><tr><th>Fila</th><th>Código / SKU</th><th>Nombre</th><th>Precio de venta</th><th>Resultado</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.row}>
            <td>{row.row}</td><td>{row.sku}</td><td>{row.name || '—'}</td>
            <td>{row.payload?.priceLists[0]?.price.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</td>
            <td><strong className={`productos-import__status productos-import__status--${row.status}`}>{statusLabels[row.status]}</strong>
              {row.errors.length > 0 ? <ul>{row.errors.map(message => <li key={message}>{message}</li>)}</ul> : row.message && <span>{row.message}</span>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {showPagination && <nav className="productos-import__pagination" aria-label="Páginas de la revisión de productos">
        <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
        <span>Página {currentPage} de {totalPages}</span>
        <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
      </nav>}
    </>}
  </ExcelImportLayout>
}
