import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import CompanyModuleSelect from './CompanyModuleSelect'

it('muestra los dos módulos y exige por lo menos uno', () => {
  const html = renderToStaticMarkup(<CompanyModuleSelect value={[]} onChange={() => {}} />)
  expect(html).toContain('Facturación')
  expect(html).toContain('Nómina')
  expect(html).toContain('Selecciona al menos un módulo.')
})
it('refleja la selección guardada al editar', () => {
  const html = renderToStaticMarkup(<CompanyModuleSelect value={['PAYROLL']} onChange={() => {}} />)
  expect(html.match(/checked=""/g)).toHaveLength(1)
  expect(html).not.toContain('role="alert"')
})
