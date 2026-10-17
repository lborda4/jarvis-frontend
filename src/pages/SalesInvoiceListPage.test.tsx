import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SalesInvoiceListPage from './SalesInvoiceListPage'
const mocks = vi.hoisted(() => ({ cached: null as unknown }))
vi.mock('../services/queryCache', () => ({ peekCachedQuery: () => mocks.cached, companyQueryKey: () => 'test', invalidateQueryCache: vi.fn() }))
vi.mock('../components/InvoiceNoteActions', () => ({ default: () => null }))
vi.mock('../components/DateRangeFilter', () => ({ default: () => null }))
beforeEach(() => { mocks.cached = { items: [], total: 0, page: 1, pageSize: 20 } })

it('muestra guardados y enviados en una sola tabla sin avisos de borradores', () => {
  const common = { providerId: '', prefix: '', issueDate: '2026-10-16', customerName: 'Cliente', customerIdentification: '900123', currency: 'COP', total: '100', cufe: null, sentAt: '2026-10-16' }
  mocks.cached = { items: [
    { ...common, id: 'saved-1', number: '', status: 'SAVED' },
    { ...common, id: 'sent-1', number: '1', prefix: 'FV', status: 'SENT' },
  ], total: 2, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html.match(/<table/g)).toHaveLength(1)
  expect(html).toContain('Guardado')
  expect(html).toContain('Enviada a DIAN')
  expect(html).toContain('/factura-venta/nueva?borrador=saved-1')
  expect(html).toContain('/factura-venta/sent-1/visualizar')
  expect(html).not.toContain('Borradores')
  expect(html).not.toContain('No tienes borradores')
})

it('no añade un bloque de borradores cuando no hay documentos', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html).not.toContain('Borradores')
  expect(html).not.toContain('No tienes borradores')
})
