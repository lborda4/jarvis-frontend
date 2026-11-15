import { describe, expect, it } from 'vitest'
import { payrollMonthlySendNotice } from './payrollMonthlySendNotice'

describe('Resultado de envío mensual', () => {
  it('muestra éxito únicamente cuando todos están aceptados por DIAN', () => {
    expect(payrollMonthlySendNotice(['ACCEPTED', 'ACCEPTED'], 2)).toMatchObject({ variant: 'success', message: '2 de 2 documentos aceptados por la DIAN.' })
  })
  it('resume resultados mixtos sin ocultar los errores', () => {
    const result = payrollMonthlySendNotice(['ACCEPTED', 'REJECTED'], 2)
    expect(result.variant).toBe('error')
    expect(result.message).toContain('1 de 2 documentos aceptados')
    expect(result.message).toContain('1 con error')
  })
  it.each(['PROCESSING', 'UNCERTAIN'])('no anuncia éxito para un resultado %s', status => {
    const result = payrollMonthlySendNotice([status], 1)
    expect(result.variant).toBe('error')
    expect(result.message).toContain('pendientes de confirmación')
    expect(result.message).toContain('antes de reenviar')
  })
  it('distingue un error de actualización de empleados aún sin procesar', () => {
    const result = payrollMonthlySendNotice(['ACCEPTED'], 3)
    expect(result.variant).toBe('error')
    expect(result.message).toContain('2 sin procesar')
  })
})
