import { expect, it, vi } from 'vitest'
import { payrollService } from '../../services/payrollService'
import { blankPayroll } from './payrollDefaults'
import { persistPayrollNovelty } from './payrollNoveltyPersistence'

vi.mock('../../services/payrollService', () => ({ payrollService: { save: vi.fn() } }))

it('confirma la escritura y libera el editor sin esperar la recarga del listado', async () => {
  let confirm!: () => void
  vi.mocked(payrollService.save).mockImplementationOnce(() => new Promise<void>(resolve => { confirm = resolve }))
  const onSaved = vi.fn()
  const refresh = vi.fn(() => new Promise<void>(() => {}))
  const pending = persistPayrollNovelty('document', blankPayroll(), { onSaved, refresh, onRefreshError: vi.fn() })
  expect(onSaved).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  confirm()
  await pending
  expect(onSaved).toHaveBeenCalledOnce()
  expect(refresh).toHaveBeenCalledOnce()
})

it('no cambia los datos ni refresca si falla la escritura', async () => {
  vi.mocked(payrollService.save).mockRejectedValueOnce(new Error('No guardado'))
  const callbacks = { onSaved: vi.fn(), refresh: vi.fn(), onRefreshError: vi.fn() }
  await expect(persistPayrollNovelty('document', blankPayroll(), callbacks)).rejects.toThrow('No guardado')
  expect(callbacks.onSaved).not.toHaveBeenCalled()
  expect(callbacks.refresh).not.toHaveBeenCalled()
})

it('un fallo al refrescar no convierte una escritura confirmada en error de guardado', async () => {
  vi.mocked(payrollService.save).mockResolvedValueOnce({ id: 'document' })
  const callbacks = { onSaved: vi.fn(), refresh: vi.fn().mockRejectedValue(new Error('Sin conexión')), onRefreshError: vi.fn() }
  await persistPayrollNovelty('document', blankPayroll(), callbacks)
  expect(callbacks.onSaved).toHaveBeenCalledOnce()
  await vi.waitFor(() => expect(callbacks.onRefreshError).toHaveBeenCalledOnce())
})
