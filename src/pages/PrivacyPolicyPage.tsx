import { useNavigate, useSearchParams } from 'react-router-dom'
import { getIntegrationPolicy } from '../constants/integrationPolicies'
import IntegrationPolicyModal from '../components/IntegrationPolicyModal'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const policy = getIntegrationPolicy(params.get('integracion') === 'siigo' ? 'siigo' : 'jarvis')!
  return <IntegrationPolicyModal policy={policy} onClose={() => navigate('/', { replace: true })} />
}
