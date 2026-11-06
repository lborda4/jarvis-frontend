import { describe, expect, it } from 'vitest'
import { companyJarvisModules, jarvisModuleForPath } from './companyModules'
import { extractAuthCompanies, extractAuthUser } from '../utils/authTokens'

describe('módulos de Jarvis por empresa', () => {
  it('conserva ambas secciones para empresas antiguas y respeta una selección explícita', () => {
    expect(companyJarvisModules(undefined)).toEqual(['BILLING', 'PAYROLL'])
    expect(companyJarvisModules(null)).toEqual(['BILLING', 'PAYROLL'])
    expect(companyJarvisModules(['PAYROLL'])).toEqual(['PAYROLL'])
    expect(companyJarvisModules(['BILLING'])).toEqual(['BILLING'])
    expect(companyJarvisModules([])).toEqual([])
  })
  it.each(['/nomina', '/nomina/nueva', '/nomina/empleados', '/nomina/configuracion'])('clasifica la ruta de nómina %s', path => {
    expect(jarvisModuleForPath(path)).toBe('PAYROLL')
  })
  it.each(['/factura-venta/nueva', '/documento-soporte/a/visualizar', '/nota-credito', '/nota-ajuste', '/productos/listar', '/eventos-radian', '/reportes'])('clasifica la ruta de facturación %s', path => {
    expect(jarvisModuleForPath(path)).toBe('BILLING')
  })
  it('mantiene compartidos el inicio y la configuración de empresa', () => {
    expect(jarvisModuleForPath('/inicio')).toBeNull()
    expect(jarvisModuleForPath('/configuracion/integracion-jarvis')).toBeNull()
  })
  it('conserva los módulos al interpretar el inicio de sesión y las empresas disponibles', () => {
    const billing = { id: 'billing', name: 'Facturación', nit: '123', jarvisModules: ['BILLING'] }
    const payroll = { id: 'payroll', name: 'Nómina', nit: '456', jarvisModules: ['PAYROLL'] }
    const session = { user: { id: 'user', name: 'Usuario', email: 'user@example.com', company: payroll }, companies: [billing, payroll] }
    expect(extractAuthUser(session)?.company?.jarvisModules).toEqual(['PAYROLL'])
    expect(extractAuthCompanies(session).map(company => company.jarvisModules)).toEqual([['BILLING'], ['PAYROLL']])
  })
})
