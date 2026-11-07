import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false }) }))
it('al iniciar sesión permite entrar sin abrir de nuevo el modal de aceptación', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/inicio']}><Routes>
    <Route element={<ProtectedRoute />}><Route path="/inicio" element={<p>Aplicación de la empresa</p>} /></Route>
  </Routes></MemoryRouter>)
  expect(html).toContain('Aplicación de la empresa')
  expect(html).not.toContain('Consultando aceptación')
  expect(html).not.toContain('role="dialog"')
})
