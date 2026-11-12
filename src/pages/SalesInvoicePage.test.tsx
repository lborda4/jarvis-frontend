import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SalesInvoicePage from './SalesInvoicePage'

vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({ isSiigoCompany: false }) }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { company: { id: 'company' } } }) }))

afterEach(() => vi.useRealTimers())

it.each([{}, { creditNote: true }, { debitNote: true }])('fija la fecha de elaboración en hoy en Colombia para %j', props => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-12T02:00:00Z'))
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoicePage {...props} /></MemoryRouter>)
  const dateField = html.match(/Fecha de elaboración[\s\S]*?<\/label>/)?.[0]
  expect(dateField).toContain('11/11/2026')
  expect(dateField).toContain('disabled=""')
})

it.each([{ supportDocument: true }, { adjustmentNote: true }])('conserva la elección de fecha en %j', props => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoicePage {...props} /></MemoryRouter>)
  const dateField = html.match(/Fecha de elaboración[\s\S]*?<\/label>/)?.[0]
  expect(dateField).toContain('date-picker__trigger')
  expect(dateField).not.toContain('disabled=""')
})

it.each([
  [{ creditNote: true }, 'Nota crédito'],
  [{ debitNote: true }, 'Nota débito'],
  [{ adjustmentNote: true }, 'Nota de ajuste'],
] as const)('crea %s sin solicitar pagos ni vencimiento', (props, title) => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoicePage {...props} /></MemoryRouter>)
  expect(html).toContain(title)
  expect(html).not.toContain('Selecciona forma de pago')
  expect(html).not.toContain('Forma de negociación')
  expect(html).not.toContain('Fecha de vencimiento')
  expect(html).toContain('Motivo')
  expect(html).toContain('Total bruto:')
})

it('conserva los campos de pago para facturas y documentos soporte', () => {
  for (const supportDocument of [false, true]) {
    const html = renderToStaticMarkup(<MemoryRouter><SalesInvoicePage supportDocument={supportDocument} /></MemoryRouter>)
    expect(html).toContain('Selecciona forma de pago')
    expect(html).toContain('Forma de negociación')
  }
})

it.each([{ creditNote: true }, { debitNote: true }])('permite buscar la factura por consecutivo desde una nota nueva: %j', props => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoicePage {...props} /></MemoryRouter>)
  const field = html.match(/Número de factura[\s\S]*?<\/label>/)?.[0]
  expect(field).toContain('role="combobox"')
  expect(field).toContain('Busca por prefijo o consecutivo')
  expect(field).not.toContain('readOnly=""')
})
