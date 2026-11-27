import type { AuthCompany } from '../types/auth'

export const ADVISOR_DEMO_SELECTION = '__advisor_demo__'

export async function selectCompany({
  selection, companies, activeCompanyId, advisor, switchCompany, navigate,
}: {
  selection: string
  companies: AuthCompany[]
  activeCompanyId?: string
  advisor: boolean
  switchCompany: (companyId: string) => Promise<void>
  navigate: (path: string) => void
}): Promise<void> {
  if (selection === ADVISOR_DEMO_SELECTION && advisor) {
    navigate('/asesor/demo')
    return
  }
  if (!companies.some(company => company.id === selection)) {
    throw new Error('La empresa seleccionada no está disponible.')
  }
  if (selection !== activeCompanyId) await switchCompany(selection)
  if (advisor) navigate('/inicio')
}
