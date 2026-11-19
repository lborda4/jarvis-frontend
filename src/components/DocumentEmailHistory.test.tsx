import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import DocumentEmailHistory from './DocumentEmailHistory'

it('muestra los destinatarios de cada envío y su fecha en Colombia', () => {
  const html = renderToStaticMarkup(<DocumentEmailHistory deliveries={[
    { recipients: ['cliente@correo.com', 'copia@correo.com'], sentAt: '2026-11-17T22:01:00Z' },
    { recipients: ['adicional@correo.com'], sentAt: '2026-11-18T02:05:00Z' },
  ]} />)
  expect(html).toContain('cliente@correo.com, copia@correo.com')
  expect(html).toContain('adicional@correo.com')
  expect(html).toContain('17:01 (COL)')
  expect(html).toContain('21:05 (COL)')
  expect(html.match(/Documento enviado a:/g)).toHaveLength(2)
  expect(html).toContain('dateTime="2026-11-17T22:01:00Z"')
})

it('indica que no hay registros sin afirmar que el documento no fue enviado', () => {
  const html = renderToStaticMarkup(<DocumentEmailHistory deliveries={[]} />)
  expect(html).toContain('Sin envíos de correo registrados.')
  expect(html).not.toContain('Documento enviado a:')
})
