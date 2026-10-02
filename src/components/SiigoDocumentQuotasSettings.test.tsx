import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SiigoDocumentQuotasSettings from './SiigoDocumentQuotasSettings'
import type { SiigoSubscriptionStatus } from '../types/siigo'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'CLIENT', company: { id: 'test-company' } },
  }),
}))
vi.mock('../context/IntegrationSetupContext', () => ({
  useIntegrationSetup: () => ({ refreshSetupStatus: vi.fn() }),
}))

it('presenta ambos cupos en una sola tarjeta usando la suscripción recibida', () => {
  const subscription = {
    status: 'ACTIVE',
    startedAt: null,
    documentLimit: 150,
    documentsUsed: 12,
    remaining: 138,
    includedDocumentTypes: ['PURCHASE_INVOICE', 'SUPPORT_DOCUMENT'],
    plan: null,
    documentQuotas: {
      PURCHASE_INVOICE: { documentLimit: 100, documentsUsed: 10, remaining: 90 },
      SUPPORT_DOCUMENT: { documentLimit: 50, documentsUsed: 2, remaining: 48 },
    },
  } as SiigoSubscriptionStatus
  const html = renderToStaticMarkup(
    <SiigoDocumentQuotasSettings
      subscription={subscription}
      onUpdated={vi.fn()}
    />,
  )
  expect(html.match(/<section\b/g)).toHaveLength(1)
  expect(html.match(/Cupos de documentos/g)).toHaveLength(1)
  expect(html).toContain('id="siigo-document-quotas"')
  expect(html).toContain('Facturas de compra')
  expect(html).toContain('Documentos soporte')
  expect(html).toContain('>90<')
  expect(html).toContain('>48<')
  expect(html).not.toContain('siigo-document-quotas__card')
  expect(html).not.toContain('Los cupos se mostrarán')
  expect(html).not.toContain('Guardar cupos')
})

it('no pinta la tarjeta de cupos antes de cargar la suscripción', () => {
  const html = renderToStaticMarkup(
    <SiigoDocumentQuotasSettings subscription={null} onUpdated={vi.fn()} />,
  )
  expect(html).toBe('')
  expect(html).not.toContain('Cupos de documentos')
  expect(html).not.toContain('<form')
})
