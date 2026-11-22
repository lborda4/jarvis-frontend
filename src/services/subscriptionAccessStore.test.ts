import { afterEach, describe, expect, it } from 'vitest'
import { blockedSubscriptionRequest, clearSubscriptionAccess, saveSubscriptionAccess, type SubscriptionAccess } from './subscriptionAccessStore'

const expired: SubscriptionAccess = { provider: 'SIIGO', startsAt: null, expiresAt: '2020-01-01T05:00:00Z', expired: true, notStarted: false, canWrite: false, daysRemaining: -1, status: 'ACTIVE' }
afterEach(() => clearSubscriptionAccess('a'))
describe('acceso de la empresa activa', () => {
  it('bloquea escrituras, conserva consultas y permite renovar desde administración', () => {
    saveSubscriptionAccess('a', [expired])
    expect(blockedSubscriptionRequest('a', 'post', '/invoices/import')).toContain('Solo puedes consultar')
    expect(blockedSubscriptionRequest('a', 'get', '/invoices/a/download')).toBeNull()
    expect(blockedSubscriptionRequest('a', 'patch', '/admin/companies/a/tracking')).toBeNull()
  })
  it('no aplica el saldo ni el bloqueo de una empresa a otra', () => {
    saveSubscriptionAccess('a', [expired])
    clearSubscriptionAccess('b')
    expect(blockedSubscriptionRequest('a', 'post', '/products')).not.toBeNull()
    expect(blockedSubscriptionRequest('b', 'post', '/products')).toBeNull()
    clearSubscriptionAccess('a')
    expect(blockedSubscriptionRequest('a', 'post', '/products')).toBeNull()
  })
  it('usa el proveedor explícito y detecta vencimiento aunque el snapshot no se haya actualizado', () => {
    saveSubscriptionAccess('a', [expired, { ...expired, provider: 'JARVIS', canWrite: true, expired: false, expiresAt: '2099-01-01T00:00:00Z' }])
    expect(blockedSubscriptionRequest('a', 'post', '/integrations/jarvis/support-documents')).toBeNull()
    expect(blockedSubscriptionRequest('a', 'post', '/integrations/siigo/purchases')).not.toBeNull()
    saveSubscriptionAccess('a', [{ ...expired, canWrite: true, expired: false }])
    expect(blockedSubscriptionRequest('a', 'post', '/invoices/import')).not.toBeNull()
  })
})
