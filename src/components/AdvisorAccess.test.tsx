import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import AdvisorAccountPage from '../pages/AdvisorAccountPage'
import AdvisorCompanyAccess from './AdvisorCompanyAccess'
import type { AuthCompany, AuthUser } from '../types/auth'

const auth = vi.hoisted(() => ({ user: { id: 'advisor', email: 'laura@example.test', name: 'Laura', role: 'advisor', company: null } as AuthUser, companies: [] as AuthCompany[], isLoading: false, isAuthenticated: true, logout: vi.fn(), switchCompany: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
beforeEach(() => { auth.user.role = 'advisor'; auth.user.company = null; auth.companies = [] })
const privatePage = () => renderToStaticMarkup(<MemoryRouter initialEntries={['/factura-venta']}><Routes><Route element={<ProtectedRoute />}><Route path="/factura-venta" element={<p>Documentos privados</p>} /></Route></Routes></MemoryRouter>)
it('requiere seleccionar una empresa antes de entrar al área operativa del asesor', () => {
  auth.user.role = 'advisor'
  expect(privatePage()).not.toContain('Documentos privados')
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorAccountPage /></MemoryRouter>)
  expect(html).toContain('Panel de asesor')
  expect(html).toContain('Crear empresa')
  expect(html).toContain('Cerrar sesión')
})
it('permite operar la empresa seleccionada y conserva el rol comercial', () => {
  auth.user.company = { id: 'linked', name: 'Mi empresa', nit: '900' }
  expect(privatePage()).toContain('Documentos privados')
  expect(auth.user.role).toBe('advisor')
})
it('muestra únicamente los vínculos de usuario al elegir una empresa', () => {
  auth.companies = [{ id: 'linked', name: 'Mi empresa', nit: '900' }, { id: 'other-linked', name: 'Otra empresa', nit: '901' }]
  auth.user.company = auth.companies[1]
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorCompanyAccess /></MemoryRouter>)
  expect(html).toContain('Ir a la aplicación')
  expect(html).toContain('Mi empresa · NIT 900')
  expect(html).toContain('value="other-linked" selected=""')
  expect(html).not.toContain('portfolio-only')
})
it('no ofrece acceso a la aplicación sin empresas vinculadas ni al administrador que consulta un asesor', () => {
  expect(renderToStaticMarkup(<MemoryRouter><AdvisorCompanyAccess /></MemoryRouter>)).toBe('')
  auth.user.role = 'admin'
  auth.companies = [{ id: 'admin-company', name: 'Empresa admin', nit: '900' }]
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorAccountPage advisorId="other-advisor" /></MemoryRouter>)
  expect(html).not.toContain('Acceso a mis empresas')
  expect(html).not.toContain('Ir a la aplicación')
})
it('conserva el acceso operativo de los usuarios normales', () => {
  auth.user.role = 'user'
  expect(privatePage()).toContain('Documentos privados')
})
