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
  expect(html).toContain('Borrador')
  expect(html).toContain('sales-history__status--draft')
  expect(html).toContain('<td data-label="Factura"><span class="sales-history__muted">—</span>')
  expect(html).not.toContain('sales-history__number">Borrador')
  expect(html).not.toContain('Sin número')
  expect(html).toContain('Enviada a DIAN')
  expect(html).toContain('/factura-venta/nueva?borrador=saved-1')
  expect(html).toContain('/factura-venta/saved-1/visualizar?borrador=1')
  expect(html).toContain('/factura-venta/sent-1/visualizar')
  expect(html).not.toContain('>Duplicar</a>')
  expect(html).not.toContain('>Visualizar</a>')
  expect(html).not.toContain('>Editar</a>')
  expect(html).not.toContain('>Eliminar</button>')
  expect(html).toContain('title="Visualizar"')
  expect(html).toContain('aria-label="Editar factura sin enviar"')
  expect(html).not.toContain('?duplicar=saved-1')
  expect(html).not.toContain('Borradores')
  expect(html).not.toContain('No tienes borradores')
})

it('no muestra duplicar como botón independiente en documentos soporte', () => {
  mocks.cached = { items: [{ id: 'support-1', prefix: 'DS', number: '1', status: 'SENT', issueDate: '2026-10-16', customerName: 'Proveedor', customerIdentification: '123', currency: 'COP', total: '100' }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage supportDocument /></MemoryRouter>)
  expect(html).not.toContain('>Duplicar</a>')
  expect(html).not.toContain('sales-history__pagination')
})

it('no añade un bloque de borradores cuando no hay documentos', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html).not.toContain('Borradores')
  expect(html).not.toContain('No tienes borradores')
})

it.each([
  ['NONE', '—'], ['CREDIT_NOTE', 'Con nota crédito'],
  ['DEBIT_NOTE', 'Con nota débito'], ['CREDIT_AND_DEBIT', 'Con nota crédito y débito'],
])('muestra el estado adicional %s conservando el estado de envío', (adjustmentStatus, label) => {
  mocks.cached = { items: [{ id: 'invoice', prefix: 'FE', number: '1', status: 'SENT', adjustmentStatus,
    issueDate: '2026-11-11', customerName: 'Cliente', total: '100' }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html).toContain('Estado de ajuste')
  expect(html).toContain(label)
  if (adjustmentStatus === 'NONE') {
    expect(html).not.toContain('Sin ajustes')
    expect(html).not.toContain('sales-history__status--adjusted')
  }
  expect(html).toContain('Enviada a DIAN')
  expect(html).not.toContain('sales-history__pagination')
})

it('no atribuye ajustes a borradores ni muestra la columna en listados de notas', () => {
  mocks.cached = { items: [{ id: 'saved', prefix: '', number: '', status: 'SAVED', adjustmentStatus: 'CREDIT_NOTE', issueDate: '', total: '0' }], total: 1, page: 1, pageSize: 20 }
  const draft = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(draft).not.toContain('Con nota crédito')
  const notes = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage creditNote /></MemoryRouter>)
  expect(notes).not.toContain('Estado de ajuste')
})

it.each([
  [{ supportDocument: true }, '/documento-soporte'],
  [{ creditNote: true }, '/nota-credito'],
  [{ debitNote: true }, '/nota-debito'],
  [{ adjustmentNote: true }, '/nota-ajuste'],
] as const)('permite visualizar guardados desde el módulo %j', (props, path) => {
  mocks.cached = { items: [{ id: 'saved-1', prefix: '', number: '', status: 'SAVED', issueDate: '', customerName: '', total: '0' }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage {...props} /></MemoryRouter>)
  expect(html).toContain(`${path}/saved-1/visualizar?borrador=1`)
  expect(html).not.toContain('Enviar correo')
  expect(html).not.toContain('sales-history__pagination')
})
