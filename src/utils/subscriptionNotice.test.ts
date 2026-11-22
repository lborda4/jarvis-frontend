import { describe, expect, it } from 'vitest'
import { subscriptionNotice } from './subscriptionNotice'
import type { SubscriptionAccess } from '../services/subscriptionAccessStore'

const access: SubscriptionAccess = { provider: 'JARVIS', startsAt: null, expiresAt: '2026-12-01T15:00:00Z', expired: false, notStarted: false, canWrite: true, daysRemaining: null, status: 'ACTIVE' }
describe('avisos de vencimiento', () => {
  it('avisa desde diez días calendario en Colombia', () => {
    expect(subscriptionNotice(access, new Date('2026-11-20T15:00:00Z'))).toBeNull()
    expect(subscriptionNotice(access, new Date('2026-11-21T05:00:00Z'))).toMatchObject({ variant: 'warning', message: expect.stringContaining('10 días') })
    expect(subscriptionNotice(access, new Date('2026-11-30T15:00:00Z'))).toMatchObject({ variant: 'warning', message: expect.stringContaining('1 día.') })
  })
  it('usa la hora exacta del certificado y permite consultar al vencer', () => {
    expect(subscriptionNotice(access, new Date('2026-12-01T14:59:59Z'))).toMatchObject({ variant: 'warning', message: expect.stringContaining('vence hoy') })
    expect(subscriptionNotice(access, new Date('2026-12-01T15:00:00Z'))).toMatchObject({ variant: 'error', title: 'Certificado digital vencido', message: expect.stringContaining('consultar tus documentos, pero no enviarlos') })
  })
  it('explica la restricción de SIIGO y omite fechas ausentes', () => {
    expect(subscriptionNotice({ ...access, provider: 'SIIGO' }, new Date('2027-01-01T15:00:00Z'))).toMatchObject({ variant: 'error', message: expect.stringContaining('No puedes importar') })
    expect(subscriptionNotice({ ...access, expiresAt: null })).toBeNull()
  })
})
