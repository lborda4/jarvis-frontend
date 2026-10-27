import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import JarvisReportResults from './JarvisReportResults'
import type { JarvisReportResult } from '../services/jarvisReportsService'

function result(total: number, pageSize = 20): JarvisReportResult {
  return {
    filters: { report: 'sales', view: 'detail', from: '2026-10-01', to: '2026-10-31', customer: '', seller: '', product: '', kind: '', currency: 'COP', page: 1, pageSize },
    columns: [{ key: 'number', label: 'Número de comprobante', format: 'text' }, { key: 'total', label: 'Valor total', format: 'money' }, { key: 'iva', label: 'IVA', format: 'money' }],
    items: total ? [{ number: 'NC1', total: -23.8, iva: null }] : [],
    total, page: 1, pageSize, totals: [], warnings: [],
  }
}
function render(data: JarvisReportResult) { return renderToStaticMarkup(<JarvisReportResults data={data} onPage={vi.fn()} onPageSize={vi.fn()} />) }

it.each([0, 1, 9, 10, 20])('oculta la paginación con %i registros que caben en una página', total => {
  const html = render(result(total))
  expect(html).not.toContain('Anterior')
  expect(html).not.toContain('Siguiente')
  expect(html).not.toContain('Filas por página')
})
it('usa el total filtrado del servidor y no las filas de la página actual', () => {
  const html = render(result(21))
  expect(html).toContain('21 registros filtrados')
  expect(html).toContain('Página 1 de 2')
  expect(html).toContain('Siguiente')
  expect(html).toContain('Filas por página')
})
it('muestra valores negativos con centavos y distingue los datos desconocidos de cero', () => {
  const html = render(result(1))
  expect(html).toContain('-23,80')
  expect(html).toContain('Sin dato')
})
it('muestra vacío sin inventar valores ni registros', () => {
  const html = render(result(0))
  expect(html).toContain('No hay registros para los filtros seleccionados')
  expect(html).not.toContain('<tbody>')
})
