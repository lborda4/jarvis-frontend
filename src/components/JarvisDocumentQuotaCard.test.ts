import { describe, expect, it } from 'vitest'
import { jarvisDocumentQuotaView } from './JarvisDocumentQuotaCard'

describe('jarvisDocumentQuotaView', () => {
  it('muestra ilimitado cuando no hay tope', () => {
    expect(jarvisDocumentQuotaView(null, 12, null)).toEqual({
      unlimited: true,
      remaining: null,
      limit: null,
      used: 12,
      percent: 0,
    })
  })

  it('calcula disponibles y porcentaje de uso', () => {
    expect(jarvisDocumentQuotaView(100, 0, 100)).toMatchObject({
      unlimited: false,
      remaining: 100,
      limit: 100,
      used: 0,
      percent: 0,
    })
    expect(jarvisDocumentQuotaView(100, 90, 10).percent).toBe(90)
  })
})
