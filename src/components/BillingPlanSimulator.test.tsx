import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import BillingPlanSimulator, { BillingEstimateResult, BillingManualPacks, PayrollEstimateResult, ComboEstimateResult } from './BillingPlanSimulator'
import { buildManualBillingPlan, estimateBillingPlan } from '../marketing/billingSimulator'
import { BILLING_TOP_UPS } from '../marketing/catalog'
import { PAYROLL_TOP_UPS } from '../marketing/catalog'
import { buildManualPayrollPlan } from '../marketing/payrollSimulator'
import { buildManualComboPlan } from '../marketing/comboSimulator'
import { renderPage } from '../entry-prerender'

it('publica el botón en las cuatro landings sin abrir el simulador ni requerir sesión', () => {
  const html = renderToStaticMarkup(<BillingPlanSimulator />)
  expect(html).toContain('Arma tu plan a la medida')
  expect(html).toContain('aria-haspopup="dialog"')
  expect(html).not.toContain('role="dialog"')
  for (const path of ['/', '/siigo', '/facturacion-electronica', '/nomina-electronica'] as const) expect(renderPage(path).html).toContain('billing-simulator-trigger')
})
it('diferencia el costo anual, las recargas y el margen de documentos', () => {
  const html = renderToStaticMarkup(<BillingEstimateResult estimate={estimateBillingPlan(200, 'year', 'initial')!} />)
  expect(html).toContain('1 × recarga de 100 documentos')
  expect(html).toContain('1 × recarga de 50 documentos')
  expect(html).toContain('Pago anual estimado')
  expect(html).toContain('$369.800 COP')
  expect(html).toContain('200 documentos en total')
  expect(html).toContain('Las recargas vencen con la suscripción.')
})
it('ofrece las recargas en un desplegable y muestra solo las elegidas', () => {
  const html = renderToStaticMarkup(<BillingManualPacks quantities={{ 100: '2' }} onChange={() => {}} />)
  for (const pack of BILLING_TOP_UPS) {
    expect(html).toContain(`${pack.documents} documentos · ${pack.price} COP`)
  }
  expect(html.match(/<input/g)).toHaveLength(1)
  expect(html).toContain('Quitar recarga de 100 documentos')
  expect(html).toContain('value="2"')
  const result = renderToStaticMarkup(<BillingEstimateResult manual estimate={buildManualBillingPlan('initial', { 100: 2 })!} />)
  expect(result).toContain('250 documentos en total')
  expect(result).toContain('Tu combinación')
  expect(result).not.toContain('recomendada')
  expect(result).not.toContain('facturas al año')
})
it('muestra las recargas y el resultado de nómina en empleados', () => {
  const html = renderToStaticMarkup(<BillingManualPacks payroll quantities={{ 5: '1' }} onChange={() => {}} />)
  for (const pack of PAYROLL_TOP_UPS) {
    expect(html).toContain(`${pack.employees} ${pack.employees === 1 ? 'empleado' : 'empleados'} · ${pack.price} COP`)
  }
  expect(html.match(/<input/g)).toHaveLength(1)
  const result = renderToStaticMarkup(<PayrollEstimateResult manual estimate={buildManualPayrollPlan('basic', { 5: 1 })!} />)
  expect(result).toContain('Cupo total: 7 empleados')
  expect(result).toContain('$217.900 COP')
  expect(result).not.toContain('documentos incluidos')
})
it('presenta el combo con recargas separadas y un único total', () => {
  const html = renderToStaticMarkup(<ComboEstimateResult manual estimate={buildManualComboPlan('basic', { 100: 1 }, { 5: 1 })!} />)
  expect(html).toContain('1 × recarga de 100 documentos')
  expect(html).toContain('1 × recarga de 5 empleados')
  expect(html).toContain('$467.900 COP')
  expect(html.match(/Pago anual estimado/g)).toHaveLength(1)
  const inputs = renderToStaticMarkup(<><BillingManualPacks quantities={{ 10: '1' }} onChange={() => {}} /><BillingManualPacks payroll quantities={{ 10: '1' }} onChange={() => {}} /></>)
  const ids = [...inputs.matchAll(/\sid="([^"]+)"/g)].map(match => match[1])
  expect(ids).toHaveLength(2)
  expect(new Set(ids).size).toBe(ids.length)
})
it('empieza con un solo desplegable sin filas de recargas ni cantidades en cero', () => {
  const html = renderToStaticMarkup(<BillingManualPacks payroll quantities={{ 5: '0' }} onChange={() => {}} />)
  expect(html.match(/<select/g)).toHaveLength(1)
  expect(html).toContain('Selecciona una recarga')
  expect(html).not.toContain('<input')
  expect(html).not.toContain('Quitar recarga')
})
