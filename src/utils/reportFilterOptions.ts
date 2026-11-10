import type { JarvisReportSuggestion } from '../services/jarvisReportsService'

export function filterReportOptions(options: JarvisReportSuggestion[], query: string) {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  return options.filter(option => {
    const text = normalize(`${option.label} ${option.value}`)
    return terms.every(term => text.includes(term))
  })
}
