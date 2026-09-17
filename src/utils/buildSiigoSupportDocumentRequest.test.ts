import { describe, expect, it } from 'vitest'
import { buildSiigoSupportDocumentRequest } from './buildSiigoSupportDocumentRequest'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { getTodayLocalDate } from './supportDocumentDate'

function buildDocument(
  overrides: Partial<ElectronicDocumentListItem> = {},
): ElectronicDocumentListItem {
  return {
    id: 'doc-1',
    companyId: 'company-1',
    companyName: 'Empresa',
    cufe: 'cufe-123',
    invoiceNumber: 'DS-1',
    issueDate: '2026-01-01',
    dueDate: null,
    supplierName: 'Proveedor SAS',
    supplierNit: '900685902',
    documentSubtotal: 100000,
    documentIva: 19000,
    total: 119000,
    status: 'ACCOUNT_REQUIRED',
    supplierExistsInSiigo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const ACCOUNT = { code: '5135', description: 'Cuenta' }
const PAYMENT_METHOD = { id: 1, name: 'Contado', type: 'Contado' }

describe('buildSiigoSupportDocumentRequest — fecha del documento', () => {
  it('respeta una fecha bien lejos de hoy en vez de pisarla con la fecha actual (caso real pedido: Documento soporte solo dejaba elegir hasta 5 días antes)', () => {
    const request = buildSiigoSupportDocumentRequest(
      buildDocument(),
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      '2020-01-15',
    )

    expect(request.date).toBe('2020-01-15')
  })

  it('cae a hoy solo si la fecha no tiene el formato esperado', () => {
    const request = buildSiigoSupportDocumentRequest(
      buildDocument(),
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      'fecha-invalida',
    )

    expect(request.date).toBe(getTodayLocalDate())
  })
})
