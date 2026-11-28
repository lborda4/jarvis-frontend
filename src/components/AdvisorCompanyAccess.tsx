import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdvisorRole } from '../constants/userRole'
import { getApiErrorMessage } from '../services/apiClient'
import Button from './Button'
import ErrorMessage from './ErrorMessage'

export default function AdvisorCompanyAccess() {
  const { user, companies, switchCompany } = useAuth()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState('')
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  if (!isAdvisorRole(user?.role) || !companies.length) return null

  // Only auth memberships grant application access; the sales portfolio does not.
  const companyId = companies.find(company => company.id === selectedId)?.id
    ?? companies.find(company => company.id === user?.company?.id)?.id
    ?? companies[0].id
  const openCompany = async () => {
    if (opening) return
    setOpening(true)
    setError('')
    try {
      await switchCompany(companyId)
      navigate('/inicio')
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'No se pudo abrir la empresa. Intenta nuevamente.'))
    } finally {
      setOpening(false)
    }
  }

  return <>
    <section className="admin-card advisor-admin-switcher" aria-label="Acceso a mis empresas">
      <label className="admin-form__field">Mi empresa
        <select value={companyId} disabled={opening} onChange={event => { setSelectedId(event.target.value); setError('') }}>
          {companies.map(company => <option key={company.id} value={company.id}>{company.name} · NIT {company.nit}</option>)}
        </select>
      </label>
      <Button disabled={opening} onClick={() => { void openCompany() }}>{opening ? 'Abriendo empresa…' : 'Ir a la aplicación'}</Button>
    </section>
    {error && <ErrorMessage inline message={error} />}
  </>
}
