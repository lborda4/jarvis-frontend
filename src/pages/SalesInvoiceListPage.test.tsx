import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SalesInvoiceListPage from './SalesInvoiceListPage'
const mocks = vi.hoisted(() => ({ cached: null as unknown }))
vi.mock('../services/queryCache', () => ({ peekCachedQuery: () => mocks.cached, companyQueryKey: () => 'test', invalidateQueryCache: vi.fn() }))
vi.mock('../components/InvoiceNoteActions', () => ({ default: () => null }))
vi.mock('../components/DateRangeFilter', () => ({ default: () => null }))
beforeEach(() => { mocks.cached = { items: [], total: 0, page: 1, pageSize: 20 } })

it('abre la importación de documentos soporte mediante un enlace a su propia pantalla', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage supportDocument /></MemoryRouter>)
  expect(html).toContain('href="/documento-soporte/importar"')
  expect(html).toContain('Importar documentos soporte</a>')
})

it('abre la importación de ventas desde un botón estándar y no la muestra en notas', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html).toContain('class="btn btn--outline btn--md" href="/factura-venta/importar"')
  expect(html).toContain('Importar facturas de venta</a>')
  for (const props of [{ creditNote: true }, { debitNote: true }, { adjustmentNote: true }]) {
    expect(renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage {...props} /></MemoryRouter>)).not.toContain('Importar facturas de venta')
  }
})

it.each(['CREDIT_NOTE', 'CREDIT_AND_DEBIT'])('abre cada nota crédito vinculada para el estado %s', adjustmentStatus => {
  mocks.cached = { items: [{ id: 'invoice', prefix: 'FE', number: '1', status: 'SENT', adjustmentStatus,
    issueDate: '2026-11-11', total: '100', relatedDebitNotes: [{ id: 'debit/1', prefix: 'ND', number: 'ND1' }], relatedCreditNotes: [
      { id: 'note/1', prefix: 'NC', number: '1' }, { id: 'note2', prefix: 'NC', number: 'NC2' },
      { id: 'note/1', prefix: 'NC', number: '1' },
    ] }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html).toContain('href="/nota-credito/note%2F1/visualizar"')
  expect(html).toContain('href="/nota-credito/note2/visualizar"')
  expect(html).toContain('aria-label="Ver nota crédito NC1"')
  expect(html).toContain('aria-label="Ver nota crédito NC2"')
  expect(html).not.toContain('NCNC2')
  expect(html.match(/Con nota crédito/g)).toHaveLength(1)
  expect(html.match(/href="\/nota-credito\/note%2F1\/visualizar"/g)).toHaveLength(1)
  expect(html).not.toContain('Con nota crédito y débito')
  if (adjustmentStatus === 'CREDIT_AND_DEBIT') {
    expect(html.match(/Con nota débito/g)).toHaveLength(1)
    expect(html).toContain('href="/nota-debito/debit%2F1/visualizar"')
    expect(html).toContain('aria-label="Ver nota débito ND1"')
    expect(html).not.toContain('NDND1')
  }
})

it.each([
  ['CREDIT_NOTE', 'relatedCreditNotes', 'nota-credito', 'crédito', 'NC'],
  ['DEBIT_NOTE', 'relatedDebitNotes', 'nota-debito', 'débito', 'ND'],
])('muestra un único aviso enlazado cuando solo tiene %s', (adjustmentStatus, field, path, label, prefix) => {
  mocks.cached = { items: [{ id: 'invoice', prefix: 'FE', number: '1', status: 'SENT', adjustmentStatus,
    issueDate: '2026-11-11', total: '100', [field]: [{ id: 'note/1', prefix, number: '1' }],
  }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html.match(/sales-history__status--adjusted/g)).toHaveLength(1)
  expect(html).toContain(`href="/${path}/note%2F1/visualizar"`)
  expect(html).toContain(`>Con nota ${label} · ${prefix}1</a>`)
})

it('muestra un enlace de cada tipo cuando la factura tiene ambas notas', () => {
  mocks.cached = { items: [{ id: 'invoice', prefix: 'FE', number: '1', status: 'SENT', adjustmentStatus: 'CREDIT_AND_DEBIT',
    issueDate: '2026-11-11', total: '100',
    relatedCreditNotes: [{ id: 'credit', prefix: 'NC', number: '1' }],
    relatedDebitNotes: [{ id: 'debit', prefix: 'ND', number: '1' }],
  }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html.match(/sales-history__status--adjusted/g)).toHaveLength(2)
  expect(html).toContain('href="/nota-credito/credit/visualizar"')
  expect(html).toContain('href="/nota-debito/debit/visualizar"')
  expect(html.match(/Con nota crédito/g)).toHaveLength(1)
  expect(html.match(/Con nota débito/g)).toHaveLength(1)
  expect(html).not.toContain('Con nota crédito y débito')
})

it.each([{}, { creditNote: true }, { debitNote: true }, { supportDocument: true }, { adjustmentNote: true }])('muestra la hora de envío en Colombia para %j', (props) => {
  mocks.cached = { items: [{ id: 'sent', prefix: 'FE', number: '1', status: 'SENT',
    issueDate: '2026-11-11', sentAt: '2026-11-12T02:34:56Z', total: '100' }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage {...props} /></MemoryRouter>)
  expect(html).toContain('21:34:56 (COL)')
  expect(html).toContain('dateTime="2026-11-12T02:34:56Z"')
})

it.each([
  ['SAVED', '2026-11-12T02:34:56Z'],
  ['SENT', undefined], ['SENT', ''], ['SENT', 'invalid'],
  ['SENT', '2026-11-11'], ['SENT', '2026-11-11T21:34:56'],
])('omite horas de envío desconocidas o de borradores: %s %s', (status, sentAt) => {
  mocks.cached = { items: [{ id: 'invoice', prefix: 'FE', number: '1', status,
    issueDate: '2026-11-11', sentAt, total: '100' }], total: 1, page: 1, pageSize: 20 }
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoiceListPage /></MemoryRouter>)
  expect(html).not.toContain('(COL)')
})

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
  ['DEBIT_NOTE', 'Con nota débito'], ['CREDIT_AND_DEBIT', 'Con nota débito'],
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
