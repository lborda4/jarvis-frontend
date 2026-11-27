import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

const state = vi.hoisted(() => ({ user: undefined as { role: string; company?: { id: string } } | undefined }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, user: state.user }) }))
it('al iniciar sesión permite entrar sin abrir de nuevo el modal de aceptación', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/inicio']}><Routes>
    <Route element={<ProtectedRoute />}><Route path="/inicio" element={<p>Aplicación de la empresa</p>} /></Route>
  </Routes></MemoryRouter>)
  expect(html).toContain('Aplicación de la empresa')
  expect(html).not.toContain('Consultando aceptación')
  expect(html).not.toContain('role="dialog"')
})

it('permite al comercial entrar únicamente cuando tiene una empresa activa', () => {
  const render = () => renderToStaticMarkup(<MemoryRouter initialEntries={['/inicio']}><Routes>
    <Route element={<ProtectedRoute />}><Route path="/inicio" element={<p>Aplicación de la empresa</p>} /></Route>
  </Routes></MemoryRouter>)
  state.user = { role: 'advisor' }
  expect(render()).not.toContain('Aplicación de la empresa')
  state.user = { role: 'advisor', company: { id: 'real' } }
  expect(render()).toContain('Aplicación de la empresa')
  state.user = undefined
})
