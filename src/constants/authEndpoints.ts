export const AUTH_LOGIN_ENDPOINT = '/auth/login'
export const AUTH_REGISTER_ENDPOINT = '/auth/register'
export const AUTH_REFRESH_ENDPOINT = '/auth/refresh'
export const AUTH_ME_ENDPOINT = '/auth/me'
export const AUTH_SWITCH_COMPANY_ENDPOINT = '/auth/switch-company'

export function isAuthRequestUrl(url: string | undefined): boolean {
  if (!url) {
    return false
  }

  return (
    url.includes(AUTH_LOGIN_ENDPOINT) ||
    url.includes(AUTH_REGISTER_ENDPOINT) ||
    url.includes(AUTH_REFRESH_ENDPOINT)
  )
}
