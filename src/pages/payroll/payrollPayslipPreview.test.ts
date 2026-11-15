import { afterEach, describe, expect, it, vi } from 'vitest'
import { openPayrollPayslipPdf } from './payrollPayslipPreview'

afterEach(() => vi.unstubAllGlobals())
function setup() {
  const preview = { opener: {}, document: { title: '', body: { textContent: '' } }, closed: false, location: { replace: vi.fn() }, close: vi.fn() }
  const open = vi.fn(() => preview)
  vi.stubGlobal('window', { open, setTimeout: vi.fn() })
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:payroll'), revokeObjectURL: vi.fn() })
  return { preview, open }
}
describe('Vista del desprendible en pestaña aparte', () => {
  it('abre la pestaña antes de generar y muestra el PDF sin acceso al opener', async () => {
    const { preview, open } = setup()
    await openPayrollPayslipPdf(async () => {
      expect(open).toHaveBeenCalledWith('about:blank', '_blank')
      return new Blob(['pdf'])
    })
    expect(preview.opener).toBeNull()
    expect(preview.location.replace).toHaveBeenCalledWith('blob:payroll')
  })
  it('explica un bloqueo de ventanas sin consultar datos ni generar el PDF', async () => {
    setup()
    vi.mocked(window.open).mockReturnValue(null)
    const generate = vi.fn()
    await expect(openPayrollPayslipPdf(generate)).rejects.toThrow('ventanas emergentes')
    expect(generate).not.toHaveBeenCalled()
  })
  it('cierra la pestaña de espera cuando falla la generación', async () => {
    const { preview } = setup()
    await expect(openPayrollPayslipPdf(async () => { throw new Error('Sin conexión') })).rejects.toThrow('Sin conexión')
    expect(preview.close).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
