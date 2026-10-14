import { useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getIntegrationPolicy } from '../constants/integrationPolicies'
import IntegrationPolicyModal from './IntegrationPolicyModal'
import LoadingIndicator from './LoadingIndicator'
import { hasAcceptedIntegrationPolicy, saveIntegrationPolicyAcceptance } from '../utils/integrationPolicyAcceptance'

export default function IntegrationPolicyGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { integrationMode, isCheckingSetup } = useIntegrationSetup()
  const [accepted, setAccepted] = useState<string[]>([])
  const policy = getIntegrationPolicy(integrationMode)
  const key = `${user?.id}:${user?.company?.id}:${policy?.id}`

  if (isCheckingSetup) return <LoadingIndicator message="Consultando la integración de tu empresa..." />
  if (policy && !accepted.includes(key) && !hasAcceptedIntegrationPolicy(key)) {
    return <IntegrationPolicyModal key={key} policy={policy} onAccept={() => {
      saveIntegrationPolicyAcceptance(key)
      setAccepted(current => [...current, key])
    }} onLogout={logout} />
  }
  return children
}
