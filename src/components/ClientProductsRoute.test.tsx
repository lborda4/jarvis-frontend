import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ClientProductsRoute from './ClientProductsRoute'

const auth = vi.hoisted(() => ({ isLoading: false, user: { role: 'ADMIN', company: { id: 'company-1' } } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

it.each(['ADMIN', 'USER'])('muestra el catálogo de la empresa activa para %s', role => {
  auth.user.role = role
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/productos/listar']}>
    <Routes><Route element={<ClientProductsRoute />}><Route path="/productos/listar" element={<p>Catálogo de productos</p>} /></Route></Routes>
  </MemoryRouter>)
  expect(html).toContain('Catálogo de productos')
})
