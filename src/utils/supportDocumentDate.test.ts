import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePlazoDays } from './supportDocumentDate'

/**
 * Suite de regresión permanente: Plazo es un dato FIJO del documento (los
 * días de crédito que otorgó el vendedor al emitir la factura), nunca una
 * medida de mora contra la fecha actual. `resolvePlazoDays` no debe leer
 * Date.now()/new Date() en ningún punto — el test "[CANARIO]" de abajo es
 * el que revienta primero si alguien reintroduce esa dependencia.
 */

afterEach(() => {
  vi.useRealTimers()
})

describe('resolvePlazoDays', () => {
  it('Dollarcity — issueDate y paymentDueDate iguales, duration_measure 0 → 0 días', () => {
    expect(resolvePlazoDays('2026-07-02', '2026-07-02', 0)).toBe(0)
  })

  it('Lafayette — un día de diferencia entre fin/inicio de mes, duration_measure 0 → 1 día', () => {
    expect(resolvePlazoDays('2026-07-31', '2026-08-01', 0)).toBe(1)
  })

  it('Matriarca — issueDate y paymentDueDate iguales, duration_measure 0 → 0 días', () => {
    expect(resolvePlazoDays('2026-07-21', '2026-07-21', 0)).toBe(0)
  })

  it('Movistar — issueDate y paymentDueDate iguales, duration_measure 0 → 0 días', () => {
    expect(resolvePlazoDays('2026-07-06', '2026-07-06', 0)).toBe(0)
  })

  it('usa duration_measure explícito (> 0) como prioridad 1, aunque no coincida con dueDate - issueDate', () => {
    // Si se derivara de las fechas daría 4 — duration_measure manda porque
    // es el dato explícito del emisor, la fuente más confiable.
    expect(resolvePlazoDays('2026-01-01', '2026-01-05', 30)).toBe(30)
  })

  it('payment_due_date anterior a issueDate: plazo negativo válido, no se clampa a 0', () => {
    expect(resolvePlazoDays('2026-07-10', '2026-07-05', 0)).toBe(-5)
  })

  it('sin payment_due_date y sin duration_measure: null, nunca un número inventado', () => {
    expect(resolvePlazoDays('2026-07-10', null, 0)).toBeNull()
    expect(resolvePlazoDays('2026-07-10', undefined, null)).toBeNull()
  })

  it('sin issueDate y sin duration_measure: null', () => {
    expect(resolvePlazoDays(null, '2026-07-10', 0)).toBeNull()
  })

  it('[CANARIO] el resultado NO cambia sin importar la fecha actual del sistema', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-12-31T23:59:59Z'))

    // Mismo caso Dollarcity: si alguien reintroduce Date.now()/new Date()
    // como respaldo (ej. `issueDate || getTodayLocalDate()`), este test es
    // el primero en fallar porque el resultado dejaría de ser 0.
    expect(resolvePlazoDays('2026-07-02', '2026-07-02', 0)).toBe(0)
    expect(resolvePlazoDays('2026-07-31', '2026-08-01', 0)).toBe(1)
  })
})
