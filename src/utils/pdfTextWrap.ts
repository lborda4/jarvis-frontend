import { Font } from '@react-pdf/renderer'

let registered = false

/** react-pdf hyphenates by default (LAU- / RA). Keep the whole word and wrap at spaces. */
export function keepPdfWordIntact(word: string): string[] {
  return [word]
}

export function disablePdfHyphenation() {
  if (registered) return
  Font.registerHyphenationCallback(keepPdfWordIntact)
  registered = true
}
