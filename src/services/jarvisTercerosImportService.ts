import * as XLSX from 'xlsx'
import { getApiErrorMessage } from './apiClient'
import { getActiveCompanyId } from './queryCache'
import { createJarvisTercero, fetchJarvisMunicipalities, fetchJarvisTerceros, fetchJarvisTypeLiabilities, fetchJarvisTypeRegimes } from './jarvisService'
import { createTercerosTemplate, TERCEROS_TEMPLATE_FILENAME, terceroImportKey, type TerceroImportRow, type TercerosImportCatalogs } from '../utils/jarvisTercerosExcel'

export async function fetchTercerosImportCatalogs(): Promise<TercerosImportCatalogs> {
  const [municipalities, liabilities, regimes] = await Promise.all([
    fetchJarvisMunicipalities(), fetchJarvisTypeLiabilities(), fetchJarvisTypeRegimes(),
  ])
  return { municipalities: municipalities.items, liabilities: liabilities.items, regimes: regimes.items }
}

export async function downloadTercerosTemplate(): Promise<void> {
  const company = getActiveCompanyId()
  const catalogs = await fetchTercerosImportCatalogs()
  if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Descarga la plantilla de nuevo.')
  XLSX.writeFile(createTercerosTemplate(catalogs), TERCEROS_TEMPLATE_FILENAME, { compression: true })
}

/** Use the existing full tercero creation endpoint: /bulk is for suppliers tied to pending documents. */
export async function saveImportedTerceros(
  rows: TerceroImportRow[],
  onProgress: (row: TerceroImportRow) => void,
): Promise<TerceroImportRow[]> {
  if (rows.some(row => row.errors.length || row.status === 'invalid')) throw new Error('Corrige los errores del archivo antes de guardar.')
  const company = getActiveCompanyId()
  const existing = await fetchJarvisTerceros(undefined, { force: true })
  if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
  const seen = new Set(existing.items.map(item => terceroImportKey(item.document_type, item.document_number)))
  const result = rows.map(row => ({ ...row }))
  let next = 0
  async function worker() {
    while (next < result.length) {
      const index = next++
      const row = result[index]
      if (row.status !== 'ready' && row.status !== 'failed') continue
      const key = terceroImportKey(row.documentType, row.documentNumber)
      let update: TerceroImportRow
      if (seen.has(key)) {
        update = { ...row, status: 'duplicate', message: 'El tercero ya existe en Jarvis.' }
      } else {
        seen.add(key)
        try {
          if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo antes de guardar.')
          if (!row.payload) throw new Error('Vuelve a cargar el archivo para validar esta fila.')
          const response = await createJarvisTercero(row.payload)
          if (!response.success || !response.tercero?.id) throw new Error('Jarvis no confirmó el guardado. Reintenta para comprobar el resultado.')
          update = { ...row, status: 'saved', message: 'Guardado en Jarvis.' }
        } catch (error) {
          update = { ...row, status: 'failed', message: getApiErrorMessage(error, 'No se pudo guardar el tercero. Puedes reintentar.') }
        }
      }
      result[index] = update
      onProgress(update)
    }
  }
  // Bound simultaneous requests and retain a result for every row, including partial failures.
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, () => worker()))
  return result
}
