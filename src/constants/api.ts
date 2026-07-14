function resolveApiBaseUrl(): string {
  const fallback = 'http://localhost:3000'
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()

  if (!raw) {
    return fallback
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, '')
  const protocolMatches = [...withoutTrailingSlash.matchAll(/https?:\/\//g)]

  if (protocolMatches.length > 1) {
    const duplicateIndex =
      protocolMatches[1].index ?? withoutTrailingSlash.length

    return withoutTrailingSlash
      .slice(0, duplicateIndex)
      .replace(/\/+$/, '')
  }

  return withoutTrailingSlash
}

export const API_BASE_URL = resolveApiBaseUrl()
