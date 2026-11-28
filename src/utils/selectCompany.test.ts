import { describe, expect, it, vi } from 'vitest'
import { ADVISOR_DEMO_SELECTION, selectCompany } from './selectCompany'

describe('selección de empresa del comercial', () => {
  const companies = [{ id: 'real', name: 'Empresa real', nit: '123' }, { id: 'second', name: 'Otra empresa', nit: '456' }]
  const setup = () => ({ companies, activeCompanyId: 'real', advisor: true, switchCompany: vi.fn().mockResolvedValue(undefined), navigate: vi.fn() })

  it('abre la demo sin cambiar el token ni seleccionar una empresa operativa', async () => {
    const state = setup()
    await selectCompany({ ...state, selection: ADVISOR_DEMO_SELECTION })
    expect(state.switchCompany).not.toHaveBeenCalled()
    expect(state.navigate).toHaveBeenCalledWith('/asesor/demo')
  })

  it('vuelve desde la demo a la empresa activa sin solicitar otro token', async () => {
    const state = setup()
    await selectCompany({ ...state, selection: 'real' })
    expect(state.switchCompany).not.toHaveBeenCalled()
    expect(state.navigate).toHaveBeenCalledWith('/inicio')
  })

  it('cambia la sesión antes de abrir otra empresa y no navega ante errores', async () => {
    const state = setup()
    await selectCompany({ ...state, selection: 'second' })
    expect(state.switchCompany).toHaveBeenCalledWith('second')
    expect(state.navigate).toHaveBeenCalledWith('/inicio')
    state.navigate.mockClear()
    state.switchCompany.mockRejectedValueOnce(new Error('Sin acceso'))
    await expect(selectCompany({ ...state, selection: 'second' })).rejects.toThrow('Sin acceso')
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('cambia del tenant demo a cualquiera de las empresas reales vinculadas', async () => {
    for (const company of companies) {
      const state = { ...setup(), activeCompanyId: 'shared-demo-company' }
      await selectCompany({ ...state, selection: company.id })
      expect(state.switchCompany).toHaveBeenCalledWith(company.id)
      expect(state.navigate).toHaveBeenCalledWith('/inicio')
    }
  })

  it('rechaza opciones ajenas y mantiene el cambio normal sin redirección', async () => {
    const state = setup()
    await expect(selectCompany({ ...state, selection: 'other' })).rejects.toThrow()
    expect(state.switchCompany).not.toHaveBeenCalled()
    await selectCompany({ ...state, advisor: false, selection: 'second' })
    expect(state.switchCompany).toHaveBeenCalledWith('second')
    expect(state.navigate).not.toHaveBeenCalled()
  })
})
