import { fetchElectronicDocuments } from './electronicDocumentService'
import { fetchProducts } from './productService'
import { fetchJarvisSalesInvoices, fetchJarvisSupportInvoices, fetchJarvisCreditNotes, fetchJarvisDebitNotes, fetchJarvisSupportCreditNotes, fetchJarvisTerceros, type JarvisSalesInvoice } from './jarvisService'
import { getActiveCompanyId } from './queryCache'

export const SEARCH_CATEGORIES = [
  { id: 'sales', label: 'Facturas de venta', path: '/factura-venta', keywords: 'facturas ventas clientes cufe' },
  { id: 'purchases', label: 'Facturas de compra', path: '/factura-compra', keywords: 'facturas compras gastos proveedores cufe' },
  { id: 'support', label: 'Documentos soporte', path: '/documento-soporte', keywords: 'documentos soportes proveedores cuds' },
  { id: 'credit', label: 'Notas crédito', path: '/nota-credito', keywords: 'notas credito cude' },
  { id: 'debit', label: 'Notas débito', path: '/nota-debito', keywords: 'notas debito cude' },
  { id: 'adjustment', label: 'Notas de ajuste', path: '/nota-ajuste', keywords: 'notas ajustes cuds' },
  { id: 'thirdParties', label: 'Terceros', path: '/terceros', keywords: 'terceros clientes proveedores nit identificacion' },
  { id: 'products', label: 'Productos y servicios', path: '/productos/listar', keywords: 'productos servicios codigo sku catalogo' },
] as const
export type SearchCategory = typeof SEARCH_CATEGORIES[number]['id']
export type SearchScope = SearchCategory | 'all'
export interface SearchAccess {
  companyId: string
  provider: 'JARVIS' | 'SIIGO'
  sales: boolean
  purchases: boolean
  support: boolean
  thirdParties: boolean
  products: boolean
}
export interface SearchHit { id: string; title: string; description: string; to: string }
export interface SearchGroup { category: SearchCategory; items: SearchHit[]; total: number; failed?: boolean }
export function availableSearchCategories(access: SearchAccess) {
  return SEARCH_CATEGORIES.filter(item => item.id === 'products' ? access.products : item.id === 'thirdParties' ? access.thirdParties
    : item.id === 'support' ? access.support : item.id === 'purchases' ? access.purchases
    : item.id === 'adjustment' ? access.provider === 'JARVIS' && access.support : access.provider === 'JARVIS' && access.sales)
}
export function searchListLink(path: string, query: string) { return `${path}?${new URLSearchParams({ buscar: query })}` }

async function searchCategory(category: SearchCategory, query: string, provider: SearchAccess['provider']): Promise<SearchGroup> {
  const config = SEARCH_CATEGORIES.find(item => item.id === category)!
  if (category === 'products') {
    const data = await fetchProducts(query)
    return { category, total: data.total, items: data.items.slice(0, 5).map(item => ({ id: item.id, title: item.name, description: item.sku, to: searchListLink(config.path, item.sku || item.name) })) }
  }
  if (category === 'thirdParties') {
    const data = await fetchJarvisTerceros(query)
    return { category, total: data.total, items: data.items.slice(0, 5).map(item => ({ id: item.id, title: item.name, description: `${item.document_type} ${item.document_number}`, to: searchListLink(config.path, item.document_number) })) }
  }
  if (category === 'purchases' || (category === 'support' && provider === 'SIIGO')) {
    const data = await fetchElectronicDocuments({ provider, search: query, electronicDocumentType: category === 'purchases' ? 'PURCHASE_INVOICE' : 'SUPPORT_DOCUMENT', page: 1, limit: 10 })
    return { category, total: data.total, items: data.items.slice(0, 5).map(item => ({ id: item.id, title: item.invoiceNumber || 'Sin número', description: [item.supplierName, item.supplierNit].filter(Boolean).join(' · '), to: `${config.path}?${new URLSearchParams({ buscar: item.invoiceNumber || item.supplierNit || query, documento: item.id })}` })) }
  }
  const fetcher = category === 'support' ? fetchJarvisSupportInvoices : category === 'credit' ? fetchJarvisCreditNotes : category === 'debit' ? fetchJarvisDebitNotes : category === 'adjustment' ? fetchJarvisSupportCreditNotes : fetchJarvisSalesInvoices
  const data = await fetcher({ search: query, page: 1 })
  return { category, total: data.total, items: data.items.slice(0, 5).map((item: JarvisSalesInvoice) => ({
    id: item.id, title: item.status === 'SAVED' ? 'Borrador' : item.number.startsWith(item.prefix) ? item.number : `${item.prefix}${item.number}`,
    description: [item.customerName, item.customerIdentification].filter(Boolean).join(' · '),
    to: `${config.path}/${encodeURIComponent(item.id)}/visualizar${item.status === 'SAVED' ? '?borrador=1' : ''}`,
  })) }
}

export async function searchGlobally(query: string, scope: SearchScope, access: SearchAccess): Promise<SearchGroup[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2 || getActiveCompanyId() !== access.companyId) return []
  const categories = availableSearchCategories(access).filter(item => scope === 'all' || item.id === scope)
  const results = await Promise.allSettled(categories.map(category => searchCategory(category.id, trimmed, access.provider)))
  if (getActiveCompanyId() !== access.companyId) return []
  return results.map((result, index) => result.status === 'fulfilled' ? result.value : { category: categories[index].id, items: [], total: 0, failed: true })
}
