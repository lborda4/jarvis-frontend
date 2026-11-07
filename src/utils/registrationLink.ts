const storageKey = 'jarvis:registration-link'
export function readRegistrationLink(): string {
  try { return sessionStorage.getItem(storageKey) ?? '' } catch { return '' }
}
export function rememberRegistrationLink(token: string): void {
  try { sessionStorage.setItem(storageKey, token) } catch { /* Remain usable in this page when browser storage is unavailable. */ }
}
export function clearRegistrationLink(): void {
  try { sessionStorage.removeItem(storageKey) } catch { /* No stored token to clear. */ }
}
