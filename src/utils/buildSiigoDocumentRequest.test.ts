import { describe, expect, it } from 'vitest'
import { buildSiigoPurchaseSendRequest } from './buildSiigoDocumentRequest'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'

function buildDocument(
  overrides: Partial<ElectronicDocumentListItem> = {},
): ElectronicDocumentListItem {
  return {
    id: 'doc-1',
    companyId: 'company-1',
    companyName: 'Empresa',
    cufe: 'cufe-123',
    invoiceNumber: 'FE-1',
    issueDate: '2026-08-01',
    dueDate: null,
    supplierName: 'Proveedor SAS',
    supplierNit: '900685902',
    documentSubtotal: 100000,
    documentIva: 19000,
    total: 119000,
    status: 'ACCOUNT_REQUIRED',
    supplierExistsInSiigo: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

const ACCOUNT = { code: '5135', description: 'Cuenta' }
const PAYMENT_METHOD = { id: 1, name: 'Contado', type: 'Contado' }
const RETEFUENTE_TAX = {
  id: 7001,
  name: 'Retefuente servicios 4%',
  type: 'Retefuente',
  percentage: 4,
}

describe('buildSiigoPurchaseSendRequest — Retefuente', () => {
  it('aplica la Retefuente sugerida por el historial del proveedor aunque la fila nunca se haya editado a mano (bug reportado en producción)', () => {
    const document = buildDocument({
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: null,
        accountName: null,
        productCode: null,
        productName: null,
        ivaTax: null,
        retefuenteTax: RETEFUENTE_TAX,
        paymentMethod: null,
      },
    })

    // editedItems = null/undefined: simula enviar directo desde la fila
    // colapsada, sin abrir nunca el panel de detalle del ítem.
    const request = buildSiigoPurchaseSendRequest(
      document,
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      '2026-08-01',
      undefined,
      undefined,
      null,
      null,
    )

    expect(request.retentions).toEqual([
      { id: RETEFUENTE_TAX.id, type: RETEFUENTE_TAX.type },
    ])
    expect(request.supplierPreferences?.retentions).toEqual([
      {
        id: RETEFUENTE_TAX.id,
        name: RETEFUENTE_TAX.name,
        type: RETEFUENTE_TAX.type,
        percentage: RETEFUENTE_TAX.percentage,
      },
    ])
  })

  it('no agrega ninguna retención si el proveedor no tiene Retefuente sugerida en el historial', () => {
    const document = buildDocument({
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: null,
        accountName: null,
        productCode: null,
        productName: null,
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const request = buildSiigoPurchaseSendRequest(
      document,
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      '2026-08-01',
      undefined,
      undefined,
      null,
      null,
    )

    expect(request.retentions).toBeUndefined()
  })
})
