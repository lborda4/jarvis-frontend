import type { Concept } from '../../services/payrollService'

export const payrollIncomeCategories = [
  'Salario', 'Vacaciones', 'Horas extras', 'Incapacidades',
  'Licencias remuneradas', 'Liquidación de contrato', 'Otros ingresos',
] as const

export type PayrollIncomeCategory = typeof payrollIncomeCategories[number]

export function payrollIncomeCategory(concept?: Pick<Concept, 'category'>): PayrollIncomeCategory {
  const category = concept?.category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? ''
  if (category.includes('salario')) return 'Salario'
  if (category.includes('vacacion')) return 'Vacaciones'
  if (category.includes('hora') || category.includes('recargo')) return 'Horas extras'
  if (category.includes('incapacidad')) return 'Incapacidades'
  if (category.includes('licencia')) return 'Licencias remuneradas'
  if (category.includes('liquidacion')) return 'Liquidación de contrato'
  return 'Otros ingresos'
}

export function isPayrollSalaryAllowance(concept: Concept): boolean {
  return concept.code === 'transportation_allowance' ||
    (payrollIncomeCategory(concept) === 'Salario' && /transporte|conectividad/i.test(concept.name))
}
