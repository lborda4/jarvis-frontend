import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { payrollSubmissionErrors } from './payrollSubmissionErrors'
import { groupPayrollPeriods } from '../pages/payroll/payrollPeriods'
import type { PayrollDocument } from '../services/payrollService'
import PayrollDocumentTable from '../pages/payroll/PayrollDocumentTable'
import { blankEmployee, blankPayroll } from '../pages/payroll/payrollDefaults'

describe('Errores de envío de nómina', () => {
  it('presenta acciones para los rechazos de configuración sin confundir el adjunto con aceptación', () => {
    const errors = ['Regla: NIE017, Rechazo: NIT del software', 'Regla: 92, Rechazo: Emisor no habilitado', 'Regla: NIE033, Rechazo: NIT del empleador', 'Regla: NIE020, Rechazo: Software Security Code', 'AttachedDocument #NI5 generada con éxito']
    expect(payrollSubmissionErrors(errors)).toHaveLength(4)
  })
  it('separa validaciones de campos y mensajes SOAP, eliminando duplicados', () => {
    expect(payrollSubmissionErrors({ errors: { 'worker.code': ['Falta código'], salary: ['Salario inválido'] },
      ResponseDian: { ErrorMessage: { string: ['Falta código', 'Regla: 90'] } },
    })).toEqual(['Falta código', 'Salario inválido', 'Regla: 90'])
  })
  it('lee respuestas JSON anidadas y los errores guardados', () => {
    expect(payrollSubmissionErrors(['No se confirmó el envío', { response: '{"errors":{"period":["Período inválido"]}}' }]))
      .toEqual(['No se confirmó el envío', 'Período inválido'])
  })
  it('no muestra cuerpos enviados, credenciales, HTML ni trazas', () => {
    expect(payrollSubmissionErrors({ request: { message: 'salary secret' }, token: 'secret', stack: 'private',
      response: { message: '<html>Bad gateway</html>', cune: 'technical', errors: ['Revisa EPS'] },
    })).toEqual(['Revisa EPS'])
  })
  it('un período con un envío ambiguo y un borrador muestra error por confirmar', () => {
    const document = (status: string) => ({ status, state: { startDate: '2026-10-01', endDate: '2026-10-31' }, accrued: '1', deductions: '0', net: '1' }) as PayrollDocument
    expect(groupPayrollPeriods([document('UNCERTAIN'), document('DRAFT')])[0].statusLabel).toBe('Error · Por confirmar')
  })
  it('muestra Error sin revelar el detalle del rechazo en la lista', () => {
    const employee = { ...blankEmployee([], '2026-10-01'), firstName: 'Ana', surname: 'Pérez' }
    const document = { id: 'a', status: 'REJECTED', employee, state: blankPayroll('2026-10'), accrued: '1', deductions: '0', net: '1', submissionErrors: ['Revisa EPS'] } as PayrollDocument
    const html = renderToStaticMarkup(<PayrollDocumentTable documents={[document]} selected={[]} busy={false} onSelection={() => {}} onOpen={() => {}} actions={() => []} />)
    expect(html).toContain('Ana Pérez')
    expect(html).not.toContain('Revisa EPS')
    expect(html).toContain('>Error</span>')
    expect(html).not.toContain('>Borrador</span>')
  })
  it('omite el nombre genérico del error HTTP y conserva el motivo', () => {
    expect(payrollSubmissionErrors({ message: 'Revisa el período', error: 'Bad Request', statusCode: 400 }))
      .toEqual(['Revisa el período'])
  })
})
