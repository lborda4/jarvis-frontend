import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getIntegrationPolicy, type IntegrationPolicy } from '../constants/integrationPolicies'
import IntegrationPolicyModal from './IntegrationPolicyModal'
import LoadingIndicator from './LoadingIndicator'
import { hasAcceptedIntegrationPolicy, saveIntegrationPolicyAcceptance } from '../utils/integrationPolicyAcceptance'
import { apiClient } from '../services/apiClient'
import ErrorMessage from './ErrorMessage'

function PolicyCheck({ policy, acceptanceKey, logout, children }: { policy: IntegrationPolicy; acceptanceKey: string; logout: () => void; children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'pending' | 'accepted'>('checking')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const endpoint = '/auth/integration-policy/' + encodeURIComponent(policy.id)
  useEffect(() => {
    let active = true
    async function check() {
      try {
        const response = await apiClient.get<{ accepted: boolean }>(endpoint)
        let accepted = response.data.accepted
        // Conservar las aceptaciones que ya se habían guardado en este navegador.
        if (!accepted && hasAcceptedIntegrationPolicy(acceptanceKey)) {
          accepted = (await apiClient.post<{ accepted: boolean }>(endpoint + '/accept')).data.accepted
        }
        if (active) { setStatus(accepted ? 'accepted' : 'pending'); setError('') }
      } catch { if (active) setError('No pudimos consultar la aceptación. Inténtalo nuevamente.') }
    }
    void check()
    return () => { active = false }
  }, [endpoint, acceptanceKey, attempt])
  async function accept() {
    if (saving) return
    setSaving(true); setError('')
    try {
      const response = await apiClient.post<{ accepted: boolean }>(endpoint + '/accept')
      if (!response.data.accepted) throw new Error('Acceptance was not stored')
      saveIntegrationPolicyAcceptance(acceptanceKey)
      setStatus('accepted')
    } catch { setError('No pudimos guardar tu aceptación. Inténtalo nuevamente.') }
    finally { setSaving(false) }
  }
  if (status === 'accepted') return children
  return <>
    {status === 'checking' ? error ? <div><ErrorMessage inline message={error} /><button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Reintentar</button></div> : <LoadingIndicator message="Consultando aceptación de términos..." /> : <IntegrationPolicyModal policy={policy} onAccept={() => void accept()} onLogout={logout} accepting={saving} />}
    {status === 'pending' && error && <ErrorMessage message={error} />}
  </>
}

export default function IntegrationPolicyGate({ children }: { children: ReactNode }) {
  const { user, logout, isLoading } = useAuth()
  const { integrationMode, isCheckingSetup } = useIntegrationSetup()
  const policy = getIntegrationPolicy(integrationMode)
  if (isLoading || isCheckingSetup) return <LoadingIndicator message="Consultando la integración de tu empresa..." />
  if (!policy || !user?.id || !user.company?.id) return children
  const key = `${user.id}:${user.company.id}:${policy.id}`
  return <PolicyCheck key={key} policy={policy} acceptanceKey={key} logout={logout}>{children}</PolicyCheck>
}
