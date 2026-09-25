import { describe, expect, it } from 'vitest'
import { resolveInvoiceDueDate, resolvePlazoDays } from './supportDocumentDate'

describe('resolvePlazoDays', () => {
  it('usa durationMeasure directo cuando viene válido, sin importar las fechas', () => {
    expect(resolvePlazoDays('2026-03-30', '2026-04-29', 30)).toBe(30)
  })

  it('deriva los días de payment_due_date - issueDate cuando no hay durationMeasure', () => {
    expect(resolvePlazoDays('2026-03-30', '2026-04-29', null)).toBe(30)
  })

  it('devuelve null (no un número inventado) cuando payment_due_date es el placeholder "0001-01-01" de NextPyme (bug real: daba Plazo -45744)', () => {
    expect(resolvePlazoDays('2026-03-30', '0001-01-01', null)).toBeNull()
  })

  it('devuelve null si falta alguna fecha', () => {
    expect(resolvePlazoDays(null, '2026-04-29', null)).toBeNull()
    expect(resolvePlazoDays('2026-03-30', null, null)).toBeNull()
  })

  it('ignora durationMeasure <= 0 y cae al cálculo por fechas', () => {
    expect(resolvePlazoDays('2026-03-30', '2026-04-29', 0)).toBe(30)
  })
})

describe('resolveInvoiceDueDate', () => {
  it('conserva el vencimiento real de NextPyme', () => {
    expect(resolveInvoiceDueDate('2026-09-18', '2026-10-18', 30)).toBe(
      '2026-10-18',
    )
  })

  it('calcula el vencimiento con el plazo de NextPyme si no hay fecha', () => {
    expect(resolveInvoiceDueDate('2026-09-18', null, 30)).toBe('2026-10-18')
  })
})
