import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DateRangeFilter from './DateRangeFilter'

it('muestra Todas cuando no hay un rango seleccionado', () => {
  const html = renderToStaticMarkup(<DateRangeFilter from="" to="" onApply={() => undefined} />)
  expect(html).toContain('Filtro de fecha: Todas')
  expect(html).not.toContain('Quitar filtro de fecha')
})

it('muestra ambas fechas seleccionadas en el mismo campo y permite limpiar el filtro', () => {
  const html = renderToStaticMarkup(<DateRangeFilter from="2026-10-01" to="2026-10-31" onApply={() => undefined} />)
  expect(html).toContain('01/10/2026 – 31/10/2026')
  expect(html).toContain('Quitar filtro de fecha')
  expect(html).not.toContain('type="date"')
})
