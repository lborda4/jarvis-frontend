import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import JarvisIntegrationSettings from './JarvisIntegrationSettings'
import { useJarvisIntegrationSettings } from '../hooks/useJarvisIntegrationSettings'
import { COMPANY_PERSON_TYPE } from '../types/admin'

vi.mock('../hooks/useJarvisIntegrationSettings', () => ({ useJarvisIntegrationSettings: vi.fn() }))
vi.mock('../components/AuthCompanyDisplay', () => ({ default: () => null }))
vi.mock('../components/JarvisDocumentQuotaCard', () => ({ default: () => null }))
vi.mock('../components/CompanyLogoSettings', () => ({ default: () => null }))
vi.mock('../components/InvoiceAppearanceSettings', () => ({ default: () => null }))
vi.mock('../components/InviteAccountant', () => ({ default: () => null }))

const base = {
  hasCompany: true, businessName: 'Empresa SAS', tradeName: 'Mi negocio',
  personType: COMPANY_PERSON_TYPE.LEGAL_ENTITY, givenNames: '', surnames: '',
  isNaturalPerson: false, hasValidIdentity: true,
  economicActivity: '4923', country: 'Colombia', department: 'Cundinamarca', municipality: 'Soacha',
  city: 'Soacha', email: 'persona@example.com', address: 'Calle 1', phone: '3001234567',
  taxRegime: 'common', vatRegime: 'non_vat_responsible', taxResponsibility: 'R-99-PN',
  isBusy: false, isSaving: false, rutWarnings: [], steps: [{ id: 'company' }], activeStepId: 'company',
  isStepComplete: () => false, isStepUnlocked: () => true,
}

function render(overrides: Record<string, unknown> = {}) {
  vi.mocked(useJarvisIntegrationSettings).mockReturnValue({ ...base, ...overrides } as unknown as ReturnType<typeof useJarvisIntegrationSettings>)
  return renderToStaticMarkup(<JarvisIntegrationSettings />)
}

describe('identidad en la configuración de Jarvis', () => {
  beforeEach(() => vi.clearAllMocks())
  it('no muestra pasos ni avisos de facturación para una empresa solo de nómina', () => {
    const html = render({ showSetupRequiredNotice: true })
    expect(html).toContain('usar Jarvis con nómina')
    expect(html).not.toContain('Factura de Venta permanecerán bloqueados')
    expect(html).not.toContain('jarvis-step-panel-resolutions')
  })

  it('pide razón social para persona jurídica y conserva el nombre comercial', () => {
    const html = render()
    expect(html).toContain('id="jarvis-business-name"')
    expect(html).not.toContain('id="jarvis-given-names"')
    expect(html).toContain('id="jarvis-trade-name"')
    expect(html).toContain('value="Mi negocio"')
  })

  it('pide nombres y apellidos para persona natural y conserva el nombre comercial', () => {
    const html = render({ personType: COMPANY_PERSON_TYPE.NATURAL_PERSON, isNaturalPerson: true, givenNames: 'JUAN CAMILO', surnames: 'PEREZ GOMEZ' })
    expect(html).not.toContain('id="jarvis-business-name"')
    expect(html).toContain('id="jarvis-given-names"')
    expect(html).toContain('id="jarvis-surnames"')
    expect(html).toContain('value="JUAN CAMILO"')
    expect(html).toContain('value="PEREZ GOMEZ"')
    expect(html).toContain('id="jarvis-trade-name"')
    expect(html).toContain('value="Mi negocio"')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Guardar y continuar/)
  })

  it('impide guardar una persona natural con identidad incompleta', () => {
    const html = render({ personType: COMPANY_PERSON_TYPE.NATURAL_PERSON, isNaturalPerson: true, hasValidIdentity: false })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Guardar y continuar/)
  })

  it('espera a que termine la lectura del RUT para permitir guardar', () => {
    expect(render({ isBusy: true, isParsingRut: true })).toMatch(/<button[^>]*disabled=""[^>]*>Guardar y continuar/)
  })
})
