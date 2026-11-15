import { payrollService, type PayrollState } from '../../services/payrollService'

export async function persistPayrollNovelty(id: string, state: PayrollState, callbacks: {
  onSaved: () => void
  refresh: () => Promise<void>
  onRefreshError: () => void
}) {
  await payrollService.save(id, state)
  callbacks.onSaved()
  // Release the editor after the confirmed PUT; refreshing the list is independent.
  void Promise.resolve().then(callbacks.refresh).catch(callbacks.onRefreshError)
}
