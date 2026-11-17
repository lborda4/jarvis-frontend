import { payrollService, type PayrollPayslipRecipient } from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'

export async function sendPayrollPayslipEmails(rows: PayrollPayslipRecipient[], requests: Map<string, string>, onResult: (id: string, result: { sent: boolean; message: string }) => void, onProgress: (completed: number) => void) {
  if (!rows.length || rows.some(row => !row.canEmail) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Selecciona empleados con un correo válido.')
  const succeeded: string[] = []
  let completed = 0
  const queue = [...rows]
  const worker = async () => {
    while (queue.length) {
      const row = queue.shift()!
      const requestId = requests.get(row.id) ?? crypto.randomUUID()
      requests.set(row.id, requestId)
      try {
        const result = await payrollService.emailPayslip(row.id, requestId)
        if (!result.sent) throw new Error('No se confirmó el envío del correo.')
        succeeded.push(row.id)
        onResult(row.id, { sent: true, message: 'Correo enviado' })
      } catch (cause) {
        onResult(row.id, { sent: false, message: getApiErrorMessage(cause, 'No se confirmó el envío. Intenta nuevamente.') })
      }
      onProgress(++completed)
    }
  }
  await Promise.all([worker(), worker()])
  return succeeded
}
