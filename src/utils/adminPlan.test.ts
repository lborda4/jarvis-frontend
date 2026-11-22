import { describe, expect, it } from 'vitest'
import { formatAdminPlanCapacity, formatAdminPlanOption, jarvisPlanAssignment } from './adminPlan'
import { portfolioPlans } from '../testFixtures/adminPortfolio'


describe('planes Jarvis del portafolio', () => {
  it.each(portfolioPlans)('muestra nombre, precio anual y capacidad de $name', plan => {
    const label = formatAdminPlanOption(plan)
    expect(label).toContain(plan.name)
    expect(label).toContain(`$${plan.commercialTerms!.priceCop.toLocaleString('es-CO')} COP / año`)
    expect(label).not.toContain('Recarga')
  })

  it('distingue cupos de documentos, empleados e ilimitados', () => {
    expect(formatAdminPlanCapacity(portfolioPlans[0])).toBe('50 documentos')
    expect(formatAdminPlanCapacity(portfolioPlans[1])).toBe('25 documentos')
    expect(formatAdminPlanCapacity(portfolioPlans[2])).toBe('Nómina para 2 empleados')
    expect(formatAdminPlanCapacity(portfolioPlans[3])).toBe('50 documentos · Nómina para 2 empleados')
    expect(formatAdminPlanCapacity(portfolioPlans[4])).toBe('Documentos ilimitados · Nómina ilimitada')
  })

  it.each(portfolioPlans)('vincula $name con su ID persistido, módulos y periodicidad, sin comprar recargas', plan => {
    expect(jarvisPlanAssignment(plan)).toEqual({ jarvisPlanId: plan.id, jarvisModules: plan.commercialTerms!.modules, billingMonths: 12 })
    expect(jarvisPlanAssignment(plan)).not.toHaveProperty('priceCop')
    expect(jarvisPlanAssignment(plan).jarvisModules).not.toBe(plan.commercialTerms!.modules)
  })

  it('rechaza planes de otra integración y planes anteriores sin términos comerciales', () => {
    expect(() => jarvisPlanAssignment({ ...portfolioPlans[0], provider: 'SIIGO' })).toThrow('plan Jarvis')
    expect(() => jarvisPlanAssignment({ ...portfolioPlans[0], commercialTerms: null })).toThrow('plan Jarvis')
  })
})
