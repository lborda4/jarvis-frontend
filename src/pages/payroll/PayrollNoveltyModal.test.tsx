import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import PayrollNoveltyModal from './PayrollNoveltyModal'
import { blankEmployee, blankParameters, blankPayroll } from './payrollDefaults'
import type { PayrollDetail } from '../../services/payrollService'

vi.mock('./PayrollPage', () => ({
  Field: ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>,
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

it('presenta solo el selector maestro de incapacidad junto con valor y fechas', () => {
  const initial = { id: 'disability', concept: 'disability', kind: 'accrued' as const, quantity: '3', amount: '100', type: 17, startDate: '2026-11-16', endDate: '2026-11-18' }
  const parameters = blankParameters('2026-11-01')
  const detail = { state: blankPayroll('2026-11'), employee_snapshot: blankEmployee(), parameter_snapshot: parameters } as PayrollDetail
  const html = renderToStaticMarkup(<PayrollNoveltyModal detail={detail} concepts={parameters.concepts} initial={initial} busy={false} onClose={() => {}} onSave={async () => {}} />)
  expect(html).toContain('<select aria-label="Tipo de incapacidad"')
  expect(html).not.toContain('aria-label="Tipo de ingreso"')
  expect(html).not.toContain('<input aria-label="Tipo de incapacidad"')
  expect(html).toContain('aria-label="Valor de la novedad"')
  expect(html).toContain('Fecha inicio')
  expect(html).toContain('Fecha fin')
})

it('presenta cuatro deducciones legales con tipo y valor, sin porcentaje FSP manual', () => {
  const parameters = blankParameters('2026-11-01')
  const initial = { id: 'eps', concept: 'eps', kind: 'deduction' as const, quantity: '1', amount: '100', typeLawDeductionsId: 31 }
  const detail = { state: blankPayroll('2026-11'), employee_snapshot: blankEmployee(), parameter_snapshot: parameters } as PayrollDetail
  const html = renderToStaticMarkup(<PayrollNoveltyModal detail={detail} concepts={parameters.concepts} initial={initial} busy={false} onClose={() => {}} onSave={async () => {}} />)
  expect(html.match(/<fieldset/g)).toHaveLength(4)
  expect(html.match(/<select aria-label="Tipo de deducción de /g)).toHaveLength(4)
  expect(html).toContain('Fondo de subsistencia (opcional)')
  expect(html).not.toContain('Porcentaje FSP')
})

it.each([
  ['labor_union', ['Porcentaje de aporte sindical', 'Valor de la novedad']],
  ['sanctions', ['Valor de la sanción pública', 'Valor de la sanción privada']],
  ['loan', ['Descripción de la libranza', 'Valor de la novedad']],
] as const)('presenta los campos requeridos para %s sin solicitar días', (concept, labels) => {
  const parameters = blankParameters('2026-11-01')
  const initial = { id: concept, concept, kind: 'deduction' as const, quantity: '1', amount: '100', percentage: '2', description: 'Cuota', publicSanction: '100' }
  const detail = { state: blankPayroll('2026-11'), employee_snapshot: blankEmployee(), parameter_snapshot: parameters } as PayrollDetail
  const html = renderToStaticMarkup(<PayrollNoveltyModal detail={detail} concepts={parameters.concepts} initial={initial} busy={false} onClose={() => {}} onSave={async () => {}} />)
  for (const label of labels) expect(html).toContain(`aria-label="${label}"`)
  expect(html).not.toContain('aria-label="Cantidad de la novedad"')
  if (concept === 'sanctions') expect(html).not.toContain('aria-label="Valor de la novedad"')
})

it.each(['third_party_payment_deduction', 'advance', 'other_deduction', 'voluntary', 'withholding', 'afc', 'cooperative', 'garnishment', 'supplementary_plan', 'education', 'refund_deduction', 'debt'])('solicita solo valor para %s y descripción opcional cuando corresponde', concept => {
  const parameters = blankParameters('2026-11-01')
  const initial = { id: concept, concept, kind: 'deduction' as const, quantity: '1', amount: '100', description: 'Cuota' }
  const detail = { state: blankPayroll('2026-11'), employee_snapshot: blankEmployee(), parameter_snapshot: parameters } as PayrollDetail
  const html = renderToStaticMarkup(<PayrollNoveltyModal detail={detail} concepts={parameters.concepts} initial={initial} busy={false} onClose={() => {}} onSave={async () => {}} />)
  expect(html).toContain('aria-label="Valor de la novedad"')
  expect(html).not.toContain('aria-label="Cantidad de la novedad"')
  expect(html).not.toContain('label>Porcentaje')
  if (concept === 'other_deduction') expect(html).toContain('Descripción (opcional)')
  else expect(html).not.toContain('aria-label="Descripción de la deducción"')
})
