import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DocumentCodeCopy from './DocumentCodeCopy'

it('ofrece el CUFE completo en una sola línea para copiar sin separadores del PDF', () => {
  const code = '0123456789abcdef'.repeat(6)
  const wrapped = ` ${code.slice(0, 32)}\n${code.slice(32, 64)}\r\n${code.slice(64)} `
  const html = renderToStaticMarkup(<DocumentCodeCopy value={wrapped} label="CUFE" />)
  expect(html).toContain(`value="${code}"`)
  expect(html).toContain('Copiar CUFE')
  expect(html).toContain('readOnly=""')
})

it('identifica el código de los otros tipos de documento', () => {
  const html = renderToStaticMarkup(<DocumentCodeCopy value="abcdef" label="CUDE" />)
  expect(html).toContain('Copiar CUDE')
  expect(html).toContain('CUDE completo')
})

it('no ofrece copiar si el documento no tiene código', () => {
  expect(renderToStaticMarkup(<DocumentCodeCopy value="" label="CUFE" />)).toBe('')
})
