import { describe, expect, it } from 'vitest'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import {
  getImportValidationProgress,
  formatImportValidationNotice,
} from './importValidationProgress'

function doc(
  id: string,
  overrides: Partial<ElectronicDocumentListItem> = {},
): ElectronicDocumentListItem {
  return {
    id,
    status: 'PENDING',
    supplierExistsInSiigo: true,
    aiConfidence: 25,
    ...overrides,
  } as ElectronicDocumentListItem
}
const progress = (ids: string[], docs: ElectronicDocumentListItem[]) =>
  getImportValidationProgress(ids, docs, 'PURCHASE_INVOICE', 'SIIGO')

describe('seguimiento de importaciones', () => {
  it('termina con las 65 facturas resueltas, incluidas las reutilizadas', () => {
    const docs = Array.from({ length: 65 }, (_, index) => doc(String(index)))
    const result = progress(
      docs.map(({ id }) => id),
      docs,
    )
    expect(result.complete).toBe(true)
    expect(formatImportValidationNotice(result)).toBeNull()
  })
  it('no atribuye al proveedor la espera de IA', () => {
    const result = progress(['1'], [doc('1', { aiConfidence: null })])
    expect(result).toEqual({ missing: 0, suppliers: 0, ai: 1, complete: false })
    expect(formatImportValidationNotice(result)).toContain(
      'pendientes de sugerencias de IA',
    )
    expect(formatImportValidationNotice(result)).not.toContain('proveedor(es)')
  })
  it('distingue registros ausentes de proveedores pendientes', () => {
    expect(
      progress(['1', '2'], [doc('1', { supplierExistsInSiigo: null })]),
    ).toEqual({ missing: 1, suppliers: 1, ai: 0, complete: false })
  })
  it.each([
    'PURCHASE_CREATED',
    'COMPLETED',
    'FAILED',
    'PURCHASE_FAILED',
  ] as const)('no espera IA en estado terminal %s', (status) => {
    expect(
      progress(
        ['1'],
        [doc('1', { status, supplierExistsInSiigo: null, aiConfidence: null })],
      ).complete,
    ).toBe(true)
  })
  it('reconoce cuentas distintas por ítem sin cuenta ni confianza global', () => {
    const document = doc('1', {
      aiConfidence: null,
      items: [
        {
          description: 'Papel',
          quantity: 1,
          unitValue: 1,
          total: 1,
          accountMapping: { code: '51953001' },
        },
        {
          description: 'Equipo',
          quantity: 1,
          unitValue: 1,
          total: 1,
          accountMapping: { code: '51601501' },
        },
      ],
    })
    expect(progress(['1'], [document]).complete).toBe(true)
    document.items![1].accountMapping = null
    expect(progress(['1'], [document]).ai).toBe(1)
  })
  it('el aviso desaparece cuando una actualización trae la IA resuelta', () => {
    expect(
      formatImportValidationNotice(
        progress(['1'], [doc('1', { aiConfidence: null })]),
      ),
    ).not.toBeNull()
    expect(formatImportValidationNotice(progress(['1'], [doc('1')]))).toBeNull()
  })
  it('no espera clasificación SIIGO en una integración Jarvis', () => {
    expect(
      getImportValidationProgress(
        ['1'],
        [doc('1', { aiConfidence: null })],
        'PURCHASE_INVOICE',
        'JARVIS',
      ).complete,
    ).toBe(true)
  })
})
