import { beforeEach, expect, it, vi } from 'vitest'
import { payrollService, type PayrollPayslipRecipient } from '../../services/payrollService'
import { sendPayrollPayslipEmails } from './payrollPayslipEmail'

vi.mock('../../services/payrollService', () => ({ payrollService: { emailPayslip: vi.fn() } }))
const rows: PayrollPayslipRecipient[] = ['ana', 'luis', 'laura'].map(id => ({ id, name: id, email: `${id}@example.com`, identification: id, canEmail: true }))
beforeEach(() => vi.clearAllMocks())
it('envía un correo separado por empleado seleccionado y conserva los resultados parciales', async () => {
  vi.mocked(payrollService.emailPayslip).mockImplementation(async id => { if (id === 'luis') throw new Error('No disponible'); return { sent: true } })
  const requests = new Map<string, string>(), result = vi.fn(), progress = vi.fn()
  const succeeded = await sendPayrollPayslipEmails(rows, requests, result, progress)
  expect(succeeded.sort()).toEqual(['ana', 'laura'])
  expect(payrollService.emailPayslip).toHaveBeenCalledTimes(3)
  for (const row of rows) expect(payrollService.emailPayslip).toHaveBeenCalledWith(row.id, requests.get(row.id))
  expect(result).toHaveBeenCalledWith('luis', expect.objectContaining({ sent: false }))
  expect(progress).toHaveBeenLastCalledWith(3)
  const previous = requests.get('luis')
  vi.mocked(payrollService.emailPayslip).mockResolvedValue({ sent: true })
  await sendPayrollPayslipEmails([rows[1]], requests, result, progress)
  expect(payrollService.emailPayslip).toHaveBeenLastCalledWith('luis', previous)
})
it('no envía a empleados sin correo ni procesa duplicados', async () => {
  for (const selected of [[{ ...rows[0], canEmail: false }], [rows[0], rows[0]], []]) {
    await expect(sendPayrollPayslipEmails(selected, new Map(), vi.fn(), vi.fn())).rejects.toThrow()
  }
  expect(payrollService.emailPayslip).not.toHaveBeenCalled()
})
it('no confirma éxito cuando el proveedor no confirma el envío', async () => {
  vi.mocked(payrollService.emailPayslip).mockResolvedValue({ sent: false })
  const result = vi.fn()
  expect(await sendPayrollPayslipEmails([rows[0]], new Map(), result, vi.fn())).toEqual([])
  expect(result).toHaveBeenCalledWith('ana', expect.objectContaining({ sent: false }))
})
