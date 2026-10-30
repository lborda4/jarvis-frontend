import { beforeEach, expect, it, vi } from 'vitest'
import { payrollService, type PayrollBootstrap } from '../../services/payrollService'
import { ensurePayrollParameters } from './ensurePayrollParameters'

vi.mock('../../services/payrollService', () => ({ payrollService: { bootstrap: vi.fn(), parameters: vi.fn() } }))
const bootstrap = vi.mocked(payrollService.bootstrap)
const save = vi.mocked(payrollService.parameters)
const state = (dates: string[] = []) => ({ parameters: dates.map(validFrom => ({ validFrom })) }) as PayrollBootstrap

beforeEach(() => { vi.resetAllMocks(); save.mockResolvedValue({}) })

it('inicializa con valores del período, no con la fecha actual', async () => {
  bootstrap.mockResolvedValue(state())
  await ensurePayrollParameters('2026-06-01')
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ validFrom: '2026-06-01', minimumSalary: '1750905', transportAllowance: '249095', weeklyHours: '44', monthlyHours: '220', monthlyDays: '30' }))
})

it('conserva una configuración vigente incluso si se guardó desde otra pantalla', async () => {
  bootstrap.mockResolvedValue(state(['2026-01-01']))
  await ensurePayrollParameters('2026-10-01')
  expect(save).not.toHaveBeenCalled()
})

it('no utiliza una configuración futura para un período anterior', async () => {
  bootstrap.mockResolvedValue(state(['2026-11-01']))
  await ensurePayrollParameters('2026-10-01')
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ validFrom: '2026-10-01', weeklyHours: '42' }))
})

it('permite continuar cuando otra pestaña ya guardó los valores', async () => {
  bootstrap.mockResolvedValueOnce(state()).mockResolvedValueOnce(state(['2026-10-01']))
  save.mockRejectedValue(new Error('Conflicto de vigencia'))
  await expect(ensurePayrollParameters('2026-10-01')).resolves.toBeUndefined()
})

it('conserva el error si no se logró guardar una configuración vigente', async () => {
  bootstrap.mockResolvedValue(state())
  save.mockRejectedValue(new Error('Sin conexión'))
  await expect(ensurePayrollParameters('2026-10-01')).rejects.toThrow('Sin conexión')
})

it('no guarda salario cero para años sin valores definidos', async () => {
  bootstrap.mockResolvedValue(state())
  await expect(ensurePayrollParameters('2027-01-01')).rejects.toThrow('2027')
  expect(save).not.toHaveBeenCalled()
})
