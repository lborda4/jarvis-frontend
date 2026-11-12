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
        <Route path="/nomina-electronica" element={<LandingPage product="payroll" />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('ofrece accesos a cada producto y a sus precios desde la portada', () => {
  const html = renderLanding('/')
  expect(html).toContain('href="/siigo"')
  expect(html).toContain('href="/facturacion-electronica"')
  expect(html).toContain('aria-label="Conocer más sobre causación automática"')
  expect(html).toContain('href="/facturacion-electronica#precios"')
  expect(html).toContain('Elige tu solución')
  expect(html).toContain('Nómina')
  expect(html).toContain('Causación')
  expect(html).toContain('$139.900')
  expect(html).toContain('$149.900')
  expect(html).toContain('$220.000')
  expect(html).toContain('$720.000')
  expect(html).toContain('href="/nomina-electronica"')
  expect(html).not.toContain('id="detalle-nomina"')
  expect(html).toContain('Conocer más')
  expect(html).not.toContain('Comprar ahora')
  expect(html).toContain('Valor anual')
  expect(html).not.toContain('$10.833')
  expect(html).not.toContain('$11.658')
  expect(html).toContain('href="/login"')
})

it('muestra nómina anual, recargas y combos en su página independiente', () => {
  const html = renderLanding('/nomina-electronica')
  expect(html).toContain('La nómina de tu equipo,')
  expect(html).toContain('$149.900')
  expect(html).toContain('Hasta 2 empleados')
  expect(html).toContain('Certificado digital incluido')
  expect(html).toContain('id="como-funciona"')
  expect(html).toContain('id="precios"')
  expect(html).toContain('id="acompanamiento"')
  expect(html).toContain('id="preguntas-frecuentes"')
  const navigation = html.match(/<nav class="solution-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? ''
  expect(navigation).toContain('href="#precios"')
  expect(navigation).not.toContain('href="/#')
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    expect(html).toContain(`id="${anchor}"`)
  }
  expect(html).toContain(encodeURIComponent('por $149.900 COP al año'))
  for (const price of ['$20.000', '$38.000', '$55.000', '$90.000', '$170.000', '$320.000']) expect(html).toContain(price)
  expect(html).toContain('id="recargas-nomina"')
  expect(html).toContain('id="combos"')
  expect(html).not.toContain('Elige tu solución')
  expect(html).not.toContain('class="solution-cards"')
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

it('presenta la inscripción inicial, regular, combos y las seis recargas con sus precios anuales', () => {
  const html = renderLanding('/facturacion-electronica')
  expect(html).toContain('50 documentos de obsequio')
  expect(html).toContain('25 documentos incluidos')
  expect(html).toContain('únicamente en la primera inscripción')
  expect(html).toContain('$139.900')
  expect(html).toContain('Facturación electrónica ilimitada')
  expect(html).toContain('$720.000')
  expect(html).toContain('$220.000')
  expect(html).not.toContain('Pago mensual')
  expect(html).not.toContain('$35.000')
  expect(html).not.toContain('Cargue masivo a SIIGO')

  const messages = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"\s]+)"/g)]
    .map(([, href]) => new URL(href.replaceAll('&amp;', '&')).searchParams.get('text'))
  expect(messages).toContain('Hola, me interesa el Combo cumplimiento ilimitado de JARVIS por $720.000 COP al año: Facturación y nómina ilimitadas')
  expect(messages).toContain('Hola, me interesa la Inscripción inicial de facturación de JARVIS por $139.900 COP al año: 50 documentos de obsequio')
  for (const [documents, price] of [[10, '$25.000'], [25, '$45.000'], [50, '$80.000'], [100, '$140.000'], [250, '$300.000'], [500, '$480.000']]) {
    expect(messages).toContain(`Hola, quiero una recarga de ${documents} documentos electrónicos para Facturación JARVIS por ${price}`)
  }
})

it.each(['/', '/facturacion-electronica', '/nomina-electronica'])('publica los combos anuales del portafolio en %s sin las tarifas anteriores', path => {
  const html = renderLanding(path)
  expect(html).toContain('Combo cumplimiento inicial')
  expect(html).toContain('Combo cumplimiento ilimitado')
  expect(html).not.toContain('La integración contable con Siigo se contrata por separado.')
  for (const price of ['$60.000', '$130.000', '$12.900']) expect(html).not.toContain(price)
  expect(html).toContain('/ año')
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  expect(new Set(ids).size).toBe(ids.length)
})
