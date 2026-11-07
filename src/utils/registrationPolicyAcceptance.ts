import { getIntegrationPolicyById, type IntegrationPolicy } from '../constants/integrationPolicies'

export interface RegistrationPolicyAcceptance {
  companyId: string
  email: string
  policyId: string
  version: string
}
const storageKey = 'jarvis:registration-policy-acceptance'

export function readRegistrationPolicyAcceptance(): RegistrationPolicyAcceptance | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as RegistrationPolicyAcceptance | null
    return value && typeof value.companyId === 'string' && typeof value.email === 'string' && typeof value.policyId === 'string' && typeof value.version === 'string' ? value : null
  } catch { return null }
}

export function registrationAcceptedPolicy(acceptance: RegistrationPolicyAcceptance | null, companyId: string, email: string): IntegrationPolicy | undefined {
  if (!acceptance || !companyId.trim() || !email.trim() || acceptance.companyId !== companyId.trim() || acceptance.email !== email.trim().toLowerCase()) return undefined
  const policy = getIntegrationPolicyById(acceptance.policyId)
  return policy?.version === acceptance.version ? policy : undefined
}

export function saveRegistrationPolicyAcceptance(companyId: string, email: string, policy: IntegrationPolicy): RegistrationPolicyAcceptance {
  const acceptance = { companyId: companyId.trim(), email: email.trim().toLowerCase(), policyId: policy.id, version: policy.version }
  try { sessionStorage.setItem(storageKey, JSON.stringify(acceptance)) } catch { /* Keep acceptance in memory when storage is unavailable. */ }
  return acceptance
}

export function clearRegistrationPolicyAcceptance(): void {
  try { sessionStorage.removeItem(storageKey) } catch { /* The server keeps the account's acceptance. */ }
}
