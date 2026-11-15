import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminBillingEnvironmentSettings from './AdminBillingEnvironmentSettings'

const session = vi.hoisted(() => ({ role: 'user', company: { id: 'company', name: 'Empresa' } as { id: string; name: string } | null }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: session }) }))

beforeEach(() => { session.role = 'user'; session.company = { id: 'company', name: 'Empresa' } })
it('oculta el control a usuarios normales', () => {
  expect(renderToStaticMarkup(<AdminBillingEnvironmentSettings />)).toBe('')
})
it('ofrece el cambio solo al administrador de una empresa seleccionada', () => {
  session.role = 'admin'
  expect(renderToStaticMarkup(<AdminBillingEnvironmentSettings />)).toContain('Pruebas/producción facturación')
  session.company = null
  expect(renderToStaticMarkup(<AdminBillingEnvironmentSettings />)).toBe('')
})
