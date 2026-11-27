/** Formato de pantalla; nunca sustituye el identificador oficial del documento. */
export function formatJarvisDocumentNumber(prefix: string | null | undefined, number: string | number | null | undefined): string {
  const rawPrefix = prefix?.trim() ?? ''
  const rawNumber = number == null ? '' : String(number).trim()
  if (!rawPrefix || !rawNumber) return rawNumber || rawPrefix
  const suffix = rawNumber.startsWith(rawPrefix) ? rawNumber.slice(rawPrefix.length) : rawNumber
  if (!suffix) return rawNumber
  if (rawPrefix.endsWith('-') && suffix.startsWith('-')) return `${rawPrefix}${suffix.slice(1)}`
  return rawPrefix.endsWith('-') || suffix.startsWith('-') ? `${rawPrefix}${suffix}` : `${rawPrefix}-${suffix}`
}
