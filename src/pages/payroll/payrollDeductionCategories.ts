import type { Concept } from '../../services/payrollService'

export const payrollDeductionCategories = [
  'Seguridad social', 'Otras deducciones', 'Liquidación de contrato', 'Licencias no remuneradas',
] as const
export type PayrollDeductionCategory = typeof payrollDeductionCategories[number]

export const payrollSocialDeductions = [
  { code: 'eps', label: 'Fondo de salud' },
  { code: 'pension', label: 'Fondo de pensión' },
  { code: 'solidarity', label: 'Fondo de solidaridad pensional' },
  { code: 'subsistence', label: 'Fondo de subsistencia' },
] as const
export type PayrollSocialDeduction = typeof payrollSocialDeductions[number]['code']

export function payrollDeductionCategory(concept?: Pick<Concept, 'code' | 'category' | 'name'>): PayrollDeductionCategory {
  if (payrollSocialDeductions.some(item => item.code === concept?.code)) return 'Seguridad social'
  const text = `${concept?.category ?? ''} ${concept?.name ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (text.includes('licencia') && text.includes('no remunerad')) return 'Licencias no remuneradas'
  if (text.includes('liquidacion')) return 'Liquidación de contrato'
  return 'Otras deducciones'
}
