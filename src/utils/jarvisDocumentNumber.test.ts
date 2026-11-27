import { expect, it } from 'vitest'
import { formatJarvisDocumentNumber } from './jarvisDocumentNumber'

it.each([
  ['FV', '001', 'FV-001'], ['FV', 'FV001', 'FV-001'], ['FV', 'FV-001', 'FV-001'],
  ['FV-', '001', 'FV-001'], ['FV-', '-001', 'FV-001'], ['FV-', 'FV-001', 'FV-001'], ['', '001', '001'],
  [null, '001', '001'], ['FV', null, 'FV'], ['FV', 12, 'FV-12'], ['A-B', '0005', 'A-B-0005'],
])('formatea %s y %s sin alterar ceros: %s', (prefix, number, expected) => {
  expect(formatJarvisDocumentNumber(prefix, number)).toBe(expected)
})
