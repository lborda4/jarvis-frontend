import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SalesInvoicePage from './SalesInvoicePage'

vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({ isSiigoCompany: false }) }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { company: { id: 'company' } } }) }))

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
