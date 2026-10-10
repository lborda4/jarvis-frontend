import { describe, expect, it } from 'vitest'
import {
  formatSkuSequence,
  incrementSkuSequence,
  parseSkuSequence,
  skuSequenceForKind,
} from './skuNumbering'

describe('skuNumbering', () => {
  it('arma el código con prefijo y ceros', () => {
    expect(formatSkuSequence({ prefix: 'PROD', nextNumber: 1, digits: 4 })).toBe('PROD-0001')
    expect(formatSkuSequence({ prefix: 'SERV-', nextNumber: 12, digits: 4 })).toBe('SERV-0012')
  })

  it('lee un código existente para seguir la numeración', () => {
    expect(parseSkuSequence('PROD-0007', 'PROD')).toEqual({
      prefix: 'PROD',
      nextNumber: 7,
      digits: 4,
    })
  })

  it('avanza el siguiente número y elige la serie según el tipo', () => {
    expect(incrementSkuSequence({ prefix: 'PROD', nextNumber: 1, digits: 4 }).nextNumber).toBe(2)
    expect(skuSequenceForKind({
      product: { prefix: 'PROD', nextNumber: 3, digits: 4 },
      service: { prefix: 'SERV', nextNumber: 9, digits: 4 },
    }, 'service').nextNumber).toBe(9)
  })
})
