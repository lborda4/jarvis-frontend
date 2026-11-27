import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import JarvisReportResults from './JarvisReportResults'
import type { JarvisReportResult } from '../services/jarvisReportsService'

function result(total: number, pageSize = 20): JarvisReportResult {
  return {
    filters: { report: 'sales', view: 'detail', from: '2026-10-01', to: '2026-10-31', customer: '', seller: '', product: '', kind: '', currency: 'COP', page: 1, pageSize },
    columns: [{ key: 'number', label: 'Número de comprobante', format: 'text' }, { key: 'total', label: 'Valor total', format: 'money' }, { key: 'iva', label: 'IVA', format: 'money' }],
    items: total ? [{ number: 'NC1', total: -23.8, payable: -23.8, iva: null }] : [],
    total, page: 1, pageSize, totals: [], warnings: [],
  }
}
function render(data: JarvisReportResult) { return renderToStaticMarkup(<MemoryRouter><JarvisReportResults data={data} onPage={vi.fn()} onPageSize={vi.fn()} /></MemoryRouter>) }

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

it('omite criterios fijos y solo presenta advertencias cuando el reporte las contiene', () => {
  const data = result(1)
  expect(render(data)).not.toContain('Advertencias del reporte')
  expect(render(data)).not.toContain('Criterios y observaciones')
  data.warnings = ['1 comprobante no conserva desglose suficiente']
  expect(render(data)).toContain('1 comprobante no conserva desglose suficiente')
})

it('usa los totales filtrados del servidor en el pie, sin sumar solo la página visible', () => {
  const data = result(21)
  data.totals = [{ currency: 'COP', total: 1500.5, payable: 1500.5, iva: 239.58 }]
  const html = render(data)
  const footer = html.match(/<tfoot>(.*?)<\/tfoot>/)?.[1]
  expect(footer).toContain('Total general · COP')
  expect(footer).toContain('1.500,50')
  expect(footer).not.toContain('-23,80')
})

it('conserva las monedas y cantidades netas en la vista compacta de productos', () => {
  const data = result(2)
  data.filters.report = 'products'
  data.filters.currency = ''
  data.columns = [
    { key: 'productName', label: 'Producto', format: 'text' },
    { key: 'quantity', label: 'Cantidad', format: 'number' },
    { key: 'currency', label: 'Moneda', format: 'text' },
    { key: 'total', label: 'Total', format: 'money' },
  ]
  data.items = [{ productName: 'Servicio', quantity: 1, currency: 'COP', total: 100 }]
  data.totals = [{ currency: 'COP', netQuantity: -3, total: 100 }, { currency: 'USD', netQuantity: 2, total: 10 }]
  const html = render(data)
  expect(html).toContain('Moneda')
  expect(html).toContain('Total general · COP')
  expect(html).toContain('Total general · USD')
  expect(html.match(/<tfoot>(.*?)<\/tfoot>/)?.[1]).toContain('>-3<')
  expect(html).not.toContain('Filas por página')
})

it('permite expandir nombres largos sin perder el contenido ni los valores', () => {
  const data = result(1)
  data.filters.report = 'products'
  data.filters.view = 'summary'
  data.columns = [
    { key: 'productName', label: 'Producto o servicio', format: 'text' },
    { key: 'quantity', label: 'Cantidad vendida', format: 'number' },
  ]
  const name = 'Activación y configuración inicial del servicio de facturación electrónica y acompañamiento'
  data.items = [{ productName: name, quantity: 4.5 }]
  const html = render(data)
  expect(html).toContain('aria-label="Tabla del reporte"')
  expect(html).toContain('<details class="jarvis-reports__long-text">')
  expect(html).toContain(name)
  expect(html).toContain('Ver completo')
  expect(html).toContain('4,5')
  expect(html).toContain('class="jarvis-reports__numeric"')
})

it.each(['sales', 'customers', 'products', 'sellers', 'taxes'] as const)('oculta la columna de dirección de retenciones en %s sin ocultar importes', report => {
  const data = result(2)
  data.filters.report = report
  data.filters.view = 'summary'
  data.columns = [
    { key: 'kind', label: 'Tipo de comprobante', format: 'text' },
    { key: 'direction', label: 'Retenciones', format: 'text' },
    { key: 'retefuente', label: 'Retefuente', format: 'money' },
  ]
  data.items = [
    { kind: 'Factura de venta', direction: 'Nos practicaron', retefuente: 2.5 },
    { kind: 'Documento soporte', direction: 'Practicadas por nosotros', retefuente: 3 },
  ]
  const html = render(data)
  expect(html).not.toContain('Nos practicaron')
  expect(html).not.toContain('Practicadas por nosotros')
  expect(html).toContain('Factura de venta')
  expect(html).toContain('Documento soporte')
  expect(html).toContain('2,50')
  expect(html).toContain('3,00')
})

it('presenta ventas con impuestos y retenciones negativos y abre la nota crédito', () => {
  const data = result(1)
  data.items = [{ id: 'credit-1', kind: 'Nota crédito', number: 'NC1', date: '2026-10-05',
    subtotal: -100, discount: 0, netSales: -100, iva: -19, otherTaxes: -2,
    retefuente: -3, reteIca: -1, reteIva: -0.5, payable: -116.5 }]
  data.totals = [{ ...data.items[0], currency: 'COP' }]
  const html = render(data)
  expect(html).toContain('Impuestos a cargo')
  expect(html).toContain('Impuestos de retención')
  expect(html).toContain('-21,00')
  expect(html).toContain('-4,50')
  expect(html).toContain('-116,50')
  expect(html).toContain('05/10/2026')
  expect(html).toContain('/nota-credito/credit-1/visualizar')
  const footer = html.match(/<tfoot>(.*?)<\/tfoot>/)?.[1]
  expect(footer).toContain('-21,00')
  expect(footer).toContain('-4,50')
})

it('no interpreta un impuesto desconocido como cero al agrupar importes', () => {
  const data = result(1)
  data.items = [{ iva: null, otherTaxes: 1, retefuente: 0, reteIca: null, reteIva: 0 }]
  const html = render(data)
  expect(html).toContain('Sin dato')
  expect(html).not.toContain('NaN')
})

it.each(['sales', 'customers', 'products', 'sellers', 'taxes'] as const)('muestra el número formateado en el detalle de %s', report => {
  const data = result(1)
  data.filters.report = report
  data.items = [{ id: 'invoice', kind: 'Factura de venta', prefix: 'FV', number: 'FV001' }]
  const html = render(data)
  expect(html).toContain('FV-001')
  if (report === 'sales') expect(html).toContain('aria-label="Visualizar comprobante FV-001"')
  expect(data.items[0].number).toBe('FV001')
})
