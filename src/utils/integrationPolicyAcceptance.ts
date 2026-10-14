export function hasAcceptedIntegrationPolicy(key: string): boolean {
  try { return localStorage.getItem(`jarvis:policy-acceptance:${key}`) === 'accepted' }
  catch { return false }
}

export function saveIntegrationPolicyAcceptance(key: string): void {
  try { localStorage.setItem(`jarvis:policy-acceptance:${key}`, 'accepted') }
  catch { /* Keep the in-memory acceptance when browser storage is unavailable. */ }
}
