import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import RadianRoute from './RadianRoute'

const setup = vi.hoisted(() => ({
  isCheckingSetup: false, isJarvisCompany: true, isJarvisCompanyConfigured: true,
  isConfigured: false, isSubscriptionActive: true, setupPath: '/configuracion/integracion-jarvis',
}))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
vi.mock('../pages/RadianPage', () => ({ default: () => <p>Eventos RADIAN</p> }))

it('permite RADIAN con empresa configurada aunque falten las resoluciones', () => {
  expect(renderToStaticMarkup(<MemoryRouter><RadianRoute /></MemoryRouter>)).toContain('Eventos RADIAN')
})

it('permite RADIAN con empresa configurada aunque no tenga suscripción', () => {
  setup.isSubscriptionActive = false
  try {
    expect(renderToStaticMarkup(<MemoryRouter><RadianRoute /></MemoryRouter>)).toContain('Eventos RADIAN')
  } finally { setup.isSubscriptionActive = true }
})

it('exige guardar los datos de empresa para acceder a RADIAN', () => {
  setup.isJarvisCompanyConfigured = false
  try {
    expect(renderToStaticMarkup(<MemoryRouter><RadianRoute /></MemoryRouter>)).not.toContain('Eventos RADIAN')
  } finally { setup.isJarvisCompanyConfigured = true }
})
