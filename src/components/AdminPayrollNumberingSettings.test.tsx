import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminPayrollNumberingSettings from './AdminPayrollNumberingSettings'

const session = vi.hoisted(() => ({ role: 'user', company: { id: 'company', name: 'Empresa' } as { id: string; name: string } | null }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: session }) }))
beforeEach(() => { session.role = 'user'; session.company = { id: 'company', name: 'Empresa' } })
it('no ofrece configuración de numeración al usuario final', () => {
  expect(renderToStaticMarkup(<AdminPayrollNumberingSettings />)).toBe('')
})
it('ofrece el botón al administrador con una empresa activa', () => {
  session.role = 'admin'
  expect(renderToStaticMarkup(<AdminPayrollNumberingSettings />)).toContain('Configurar numeración de nómina')
  session.company = null
  expect(renderToStaticMarkup(<AdminPayrollNumberingSettings />)).toBe('')
})
