import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdvisorRole } from '../constants/userRole'
import { getApiErrorMessage } from '../services/apiClient'
import { openAdvisorDemo } from '../services/advisorService'
import LoadingIndicator from '../components/LoadingIndicator'
import ErrorMessage from '../components/ErrorMessage'
import Button from '../components/Button'

/** The demo selects a shared company; all application screens use the regular routes. */
export default function AdvisorDemoPage() {
  const { user, isAuthenticated, isLoading, switchCompany } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !isAdvisorRole(user?.role)) return
    if (user?.company?.isDemo) {
      navigate('/inicio', { replace: true })
      return
    }
    let active = true
    void openAdvisorDemo().then(async ({ company }) => {
      if (!active) return
      if (!company.id || !company.isDemo) throw new Error('No se pudo identificar la empresa demo compartida.')
      await switchCompany(company.id)
      if (active) navigate('/inicio', { replace: true })
    }).catch(failure => {
      if (active) setError(getApiErrorMessage(failure, 'No se pudo abrir la empresa demo.'))
    })
    return () => { active = false }
  }, [isLoading, isAuthenticated, user?.role, user?.company?.isDemo, switchCompany, navigate, attempt])

  if (!isLoading && !isAuthenticated) return <Navigate to="/login" replace />
  if (!isLoading && !isAdvisorRole(user?.role)) return <Navigate to="/inicio" replace />
  if (error) return <main className="integration-page">
    <ErrorMessage message={error} />
    <Button onClick={() => { setError(''); setAttempt(value => value + 1) }}>Reintentar</Button>
    <Button variant="outline" onClick={() => navigate('/asesor')}>Volver al panel comercial</Button>
  </main>
  return <LoadingIndicator message="Abriendo empresa demo compartida…" />
}
