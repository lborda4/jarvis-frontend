import { expect, it } from 'vitest'
import { getColombiaToday } from './colombiaDate'

it('cambia de día a medianoche de Colombia y no a medianoche UTC', () => {
  expect(getColombiaToday(new Date('2026-11-12T04:59:59Z'))).toBe('2026-11-11')
  expect(getColombiaToday(new Date('2026-11-12T05:00:00Z'))).toBe('2026-11-12')
})
