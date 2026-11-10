import type { JarvisMunicipality } from '../types/jarvis'

export function formatMunicipalityLabel(item: Pick<JarvisMunicipality, 'name'>): string {
  return item.name
}

function normalizeName(value: string) {
  const name = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return /^bogota(?: d c| dc)?$/.test(name) ? 'bogota' : name
}

function normalizeCode(value?: string | null) {
  const code = value?.trim() ?? ''
  return /^\d{1,5}$/.test(code) ? code.padStart(5, '0') : ''
}

export function isMunicipalityMatch(item: JarvisMunicipality, query: string): boolean {
  return normalizeName(item.name).includes(normalizeName(query)) ||
    Boolean(item.code?.includes(query.trim())) || String(item.id).includes(query.trim())
}

/** Devuelve siempre el ID real del catálogo, nunca un código DANE como si fuera un ID. */
export function matchMunicipalityId(
  items: JarvisMunicipality[],
  cityCode?: string | null,
  cityName?: string | null,
  municipalityId?: number | null,
  stateCode?: string | null,
): number | undefined {
  const code = normalizeCode(cityCode)
  const byCode = code ? items.find(item => normalizeCode(item.code) === code) : undefined
  const byId = Number.isSafeInteger(municipalityId) && municipalityId! > 0 ? items.find(item => item.id === municipalityId) : undefined
  if (byCode && byId && byCode.id !== byId.id) return undefined
  if (byCode || byId) return (byCode ?? byId)!.id
  const needle = normalizeName(cityName ?? '')
  if (!needle) return undefined
  const department = /^\d{1,2}$/.test(stateCode?.trim() ?? '') ? stateCode!.trim().padStart(2, '0') : ''
  const candidates = department ? items.filter(item => normalizeCode(item.code).startsWith(department)) : items
  const exact = candidates.filter(item => normalizeName(item.name) === needle)
  if (exact.length) return exact.length === 1 ? exact[0].id : undefined
  const partial = candidates.filter(item => ` ${normalizeName(item.name)} `.includes(` ${needle} `))
  return partial.length === 1 ? partial[0].id : undefined
}
