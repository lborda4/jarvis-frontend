import type { JarvisAvailableResolution, JarvisDianResolution } from '../types/jarvis'

export function restoreJarvisResolutionSelection(
  options: JarvisAvailableResolution[],
  saved: JarvisDianResolution | null,
): { options: JarvisAvailableResolution[]; selectedId: string } {
  if (!saved) return { options, selectedId: '' }

  // El consecutivo avanza al emitir; no identifica la resolución autorizada.
  const matching = options.find(option =>
    option.prefix === saved.prefix &&
    option.toNumber === saved.toNumber &&
    (option.formNumber ?? '') === (saved.formNumber ?? '') &&
    (!saved.dateFrom || option.dateFrom === saved.dateFrom) &&
    (!saved.dateTo || option.dateTo === saved.dateTo),
  )
  if (matching) return { options, selectedId: matching.id }

  const stored: JarvisAvailableResolution = {
    ...saved,
    id: `saved-${saved.kind}`,
  }
  return { options: [stored, ...options], selectedId: stored.id }
}
