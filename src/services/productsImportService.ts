import * as XLSX from 'xlsx'
import { getApiErrorMessage } from './apiClient'
import { ensureDefaultProductIva, fetchJarvisTaxes } from './jarvisService'
import { createProduct, fetchProductCategories, fetchProducts, fetchUnitMeasures } from './productService'
import { getActiveCompanyId } from './queryCache'
import { DEFAULT_PRODUCT_IVA_ID } from '../utils/productTaxes'
import { createProductsTemplate, PRODUCTS_TEMPLATE_FILENAME, productImportKey, type ProductImportRow, type ProductsImportCatalogs } from '../utils/productsExcel'

export async function fetchProductsImportCatalogs(): Promise<ProductsImportCatalogs> {
  const [units, categories, taxes] = await Promise.all([fetchUnitMeasures(), fetchProductCategories(), fetchJarvisTaxes()])
  return { units: units.some(item => item.code === '94') ? units : [{ code: '94', name: 'Unidad' }, ...units], categories, taxes: taxes.items }
}

export async function downloadProductsTemplate(): Promise<void> {
  const company = getActiveCompanyId()
  const catalogs = await fetchProductsImportCatalogs()
  if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Descarga la plantilla de nuevo.')
  XLSX.writeFile(createProductsTemplate(catalogs), PRODUCTS_TEMPLATE_FILENAME, { compression: true })
}

export async function saveImportedProducts(rows: ProductImportRow[], onProgress: (row: ProductImportRow) => void): Promise<ProductImportRow[]> {
  if (rows.some(row => row.errors.length || row.status === 'invalid')) throw new Error('Corrige los errores del archivo antes de guardar.')
  const company = getActiveCompanyId()
  const existing = await fetchProducts(undefined, { force: true })
  if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
  const seen = new Set(existing.items.map(item => productImportKey(item.sku)))
  const result = rows.map(row => ({ ...row }))
  let defaultIva: ReturnType<typeof ensureDefaultProductIva> | undefined
  let next = 0
  async function worker() {
    while (next < result.length) {
      const index = next++
      const row = result[index]
      if (row.status !== 'ready' && row.status !== 'failed') continue
      const key = productImportKey(row.sku)
      let update: ProductImportRow
      if (seen.has(key)) {
        update = { ...row, status: 'duplicate', message: 'El SKU ya existe en Jarvis.' }
      } else {
        seen.add(key)
        try {
          if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo antes de guardar.')
          if (!row.payload) throw new Error('Vuelve a cargar el archivo para validar esta fila.')
          const payload = { ...row.payload, taxIds: [...(row.payload.taxIds ?? [])] }
          if (payload.taxIds.includes(DEFAULT_PRODUCT_IVA_ID)) {
            const tax = await (defaultIva ??= ensureDefaultProductIva())
            if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo antes de guardar.')
            payload.taxIds = [...new Set(payload.taxIds.map(id => id === DEFAULT_PRODUCT_IVA_ID ? tax.id : id))]
          }
          const response = await createProduct(payload)
          if (!response.success || !response.product?.id) throw new Error('Jarvis no confirmó el guardado. Reintenta para comprobar el resultado.')
          update = { ...row, status: 'saved', message: 'Guardado en Jarvis.' }
        } catch (error) {
          update = { ...row, status: 'failed', message: getApiErrorMessage(error, 'No se pudo guardar el producto. Puedes reintentar.') }
        }
      }
      result[index] = update
      onProgress(update)
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, () => worker()))
  return result
}
