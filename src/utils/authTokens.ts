import type { AuthTokens, AuthUser } from '../types/auth'

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readIdentifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return readString(value)
}

function extractCompany(
  companyPayload: unknown,
): AuthUser['company'] {
  if (!companyPayload || typeof companyPayload !== 'object') {
    console.log('[Auth] Empresa no encontrada en la respuesta:', companyPayload)
    return null
  }

  const companyRecord = companyPayload as Record<string, unknown>
  const companyId =
    readIdentifier(companyRecord.id) ??
    readIdentifier(companyRecord.companyId) ??
    readIdentifier(companyRecord.company_id)
  const companyName =
    readString(companyRecord.name) ?? readString(companyRecord.companyName)
  const companyNit =
    readIdentifier(companyRecord.nit) ?? readIdentifier(companyRecord.companyNit)

  console.log('[Auth] Datos de empresa recibidos:', {
    raw: companyRecord,
    parsed: {
      id: companyId,
      name: companyName,
      nit: companyNit,
    },
  })

  if (!companyId || !companyName || !companyNit) {
    console.warn('[Auth] La empresa no pudo parsearse completamente.', {
      id: companyId,
      name: companyName,
      nit: companyNit,
    })
    return null
  }

  return {
    id: companyId,
    name: companyName,
    nit: companyNit,
  }
}

export function extractAuthTokens(data: unknown): AuthTokens | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const directAccessToken = readString(record.accessToken)
  const directRefreshToken = readString(record.refreshToken)

  if (directAccessToken && directRefreshToken) {
    return {
      accessToken: directAccessToken,
      refreshToken: directRefreshToken,
    }
  }

  const nestedTokens = record.tokens

  if (nestedTokens && typeof nestedTokens === 'object') {
    const tokens = nestedTokens as Record<string, unknown>
    const accessToken = readString(tokens.accessToken)
    const refreshToken = readString(tokens.refreshToken)

    if (accessToken && refreshToken) {
      return {
        accessToken,
        refreshToken,
      }
    }
  }

  return null
}

export function extractAuthUser(data: unknown): AuthUser | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const payload =
    record.user && typeof record.user === 'object'
      ? (record.user as Record<string, unknown>)
      : record

  const id = readString(payload.id) ?? readString(payload.userId)
  const name = readString(payload.name)
  const email = readString(payload.email)

  if (!id || !name || !email) {
    return null
  }

  let company: AuthUser['company'] = null
  const companyPayload = payload.company ?? payload.companyData

  company = extractCompany(companyPayload)

  const user = {
    id,
    name,
    email,
    company,
  }

  console.log('[Auth] Usuario parseado:', user)

  return user
}
