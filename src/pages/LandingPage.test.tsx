import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import LandingPage from './LandingPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}))

function renderLanding(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/siigo" element={<LandingPage product="siigo" />} />
        <Route path="/facturacion-electronica" element={<LandingPage product="billing" />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('ofrece accesos a cada producto y a sus precios desde la portada', () => {
  const html = renderLanding('/')
  expect(html).toContain('href="/siigo"')
  expect(html).toContain('href="/facturacion-electronica"')
  expect(html).toContain('href="/siigo#precios"')
  expect(html).toContain('href="/facturacion-electronica#precios"')
  expect(html).toContain('Ya tengo Siigo')
  expect(html).toContain('Quiero facturar electrónicamente')
})

it('mantiene los planes de Siigo separados de los paquetes de facturación', () => {
  const html = renderLanding('/siigo')
  expect(html).toContain('Planes de automatización para Siigo')
  for (const price of ['$35.000', '$75.000', '$120.000', '$250.000']) {
    expect(html).toContain(price)
  }
  expect(html).not.toContain('$130.000')
  expect(html).not.toContain('$60.000')
  expect(html).not.toContain('id="recargas-title"')
})

it('ofrece los dos modos de facturación y las seis recargas con consultas específicas', () => {
  const html = renderLanding('/facturacion-electronica')
  expect(html).toContain('Incluye 50 documentos electrónicos')
  expect(html).toContain('$130.000')
  expect(html).toContain('Facturación electrónica ilimitada')
  expect(html).toContain('$60.000')
  expect(html).not.toContain('$35.000')
  expect(html).not.toContain('Cargue masivo a SIIGO')

  const messages = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"\s]+)"/g)]
    .map(([, href]) => new URL(href.replaceAll('&amp;', '&')).searchParams.get('text'))
  expect(messages).toContain('Hola, me interesa el plan de facturación electrónica ilimitada de JARVIS por $60.000 mensuales')
  expect(messages).toContain('Hola, me interesa el plan anual de facturación electrónica JARVIS de $130.000 con 50 documentos')
  for (const [documents, price] of [[10, '$25.000'], [25, '$45.000'], [50, '$80.000'], [100, '$140.000'], [250, '$300.000'], [500, '$480.000']]) {
    expect(messages).toContain(`Hola, quiero una recarga de ${documents} documentos electrónicos para Facturación JARVIS por ${price}`)
  }
})
