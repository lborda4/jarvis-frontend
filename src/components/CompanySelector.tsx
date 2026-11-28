import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAdvisorRole } from '../constants/userRole'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/apiClient'
import { ADVISOR_DEMO_SELECTION, selectCompany } from '../utils/selectCompany'
import './CompanySelector.css'

export default function CompanySelector({ location, demoName }: {
  location: 'company' | 'demo' | 'panel'
  demoName?: string
}) {
  const { user, companies, isLoading, isSwitchingCompany, switchCompany } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const advisor = isAdvisorRole(user?.role)
  const demo = location === 'demo' || user?.company?.isDemo === true
  const realCompanies = companies.filter(company => !company.isDemo)
  const value = location === 'panel' ? '' : demo ? ADVISOR_DEMO_SELECTION : user?.company?.id ?? ''

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const selection = event.target.value
    setError('')
    try {
      await selectCompany({ selection, companies, activeCompanyId: user?.company?.id, advisor, switchCompany, navigate })
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'No se pudo cambiar de empresa. Intenta nuevamente.'))
    }
  }

  if (!realCompanies.length && !advisor) return null
  return <>
    <select
      className={location === 'company' ? 'app-sidebar__company-select' : 'company-selector'}
      value={value}
      onChange={event => void handleChange(event)}
      disabled={isLoading || isSwitchingCompany}
      aria-label="Empresa activa"
      title={demo ? demoName ?? 'Empresa demo Jarvis' : user?.company?.name}
    >
      {location === 'panel' && <option value="" disabled>Elegir empresa</option>}
      {advisor && <option value={ADVISOR_DEMO_SELECTION}>{demoName ?? 'Empresa demo Jarvis'}</option>}
      {realCompanies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
    </select>
    {error && <span className="company-selector__error" role="alert">{error}</span>}
  </>
}
