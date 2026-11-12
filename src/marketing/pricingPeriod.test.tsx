import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PricingPeriodToggle from '../components/PricingPeriodToggle'
import { ComplianceCombos } from '../components/PortfolioPricing'
import { BILLING_PLANS, PAYROLL_PLAN, COMPLIANCE_COMBOS } from './catalog'
import { periodicPrice } from './pricingPeriod'

it.each([
  [BILLING_PLANS[0], '$11.658'], [PAYROLL_PLAN, '$12.492'],
  [COMPLIANCE_COMBOS[0], '$18.333'], [COMPLIANCE_COMBOS[1], '$60.000'],
])('divide el valor anual de $name entre doce y mantiene claro el cobro anual', (plan, monthly) => {
  expect(periodicPrice(plan.amount, 'month')).toMatchObject({ price: monthly, suffix: '/mes', label: 'Equivalente mensual' })
  expect(periodicPrice(plan.amount, 'month').terms).toContain(`Pago anual de ${plan.price} COP`)
  expect(periodicPrice(plan.amount, 'year')).toMatchObject({ price: plan.price, suffix: '/año', label: 'Valor anual' })
})

it('multiplica la causación por doce sin cambiar su cobro mensual', () => {
  expect(periodicPrice(35000, 'month', 'month')).toMatchObject({ price: '$35.000', suffix: '/mes' })
  expect(periodicPrice(35000, 'year', 'month')).toMatchObject({ price: '$420.000', suffix: '/año', terms: '12 pagos mensuales de $35.000 COP' })
})

it('muestra los combos anuales al seleccionar año y conserva los enlaces comerciales', () => {
  const monthly = renderToStaticMarkup(<ComplianceCombos period="month" />)
  const annual = renderToStaticMarkup(<ComplianceCombos period="year" />)
  expect(monthly).toContain('$18.333')
  expect(annual).not.toContain('$18.333')
  expect(annual).toContain('$220.000')
  expect(annual).toContain('/año')
  expect(annual.match(/href="[^"]+"/g)).toEqual(monthly.match(/href="[^"]+"/g))
})

it.each(['month', 'year'] as const)('marca el periodo activo %s en el selector accesible', period => {
  const html = renderToStaticMarkup(<PricingPeriodToggle period={period} onChange={() => {}} />)
  expect(html).toContain(`aria-pressed="${period === 'month'}">Mes</button>`)
  expect(html).toContain(`aria-pressed="${period === 'year'}">Año</button>`)
})
