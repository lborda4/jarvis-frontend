import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import AdvisorAccountPage from '../pages/AdvisorAccountPage'

const auth = vi.hoisted(() => ({ user: { name: 'Laura', role: 'advisor' }, isLoading: false, isAuthenticated: true, logout: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
const privatePage = () => renderToStaticMarkup(<MemoryRouter initialEntries={['/factura-venta']}><Routes><Route element={<ProtectedRoute />}><Route path="/factura-venta" element={<p>Documentos privados</p>} /></Route></Routes></MemoryRouter>)
it('no presenta el área operativa a los asesores', () => {
  auth.user.role = 'advisor'
  expect(privatePage()).not.toContain('Documentos privados')
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorAccountPage /></MemoryRouter>)
  expect(html).toContain('Panel de asesor')
  expect(html).toContain('Crear empresa')
  expect(html).toContain('Cerrar sesión')
})
it('conserva el acceso operativo de los usuarios normales', () => {
  auth.user.role = 'user'
  expect(privatePage()).toContain('Documentos privados')
})
