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

describe('buildSiigoPurchaseSendRequest — descripción e IVA de ítems Account', () => {
  const iva19 = {
    id: 1919,
    name: 'IVA 19%',
    type: 'IVA',
    percentage: 19,
  }

  it('envía la descripción real aunque el ítem editado sea Account', () => {
    const document = buildDocument({
      items: [
        {
          description: 'CANDADO MARINO 60MM',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
          suggestedTax: iva19,
        },
      ],
    })

    const request = buildSiigoPurchaseSendRequest(
      document,
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      '2026-09-18',
      undefined,
      undefined,
      iva19,
      [
        {
          localId: 'item-1',
          tipo: 'Account',
          producto: '51451001',
          description: 'CANDADO MARINO 60MM',
          quantity: 1,
          unitValue: 100000,
          discount: 0,
          ivaTax: null,
          retefuenteTax: null,
        },
      ],
    )

    expect(request.items[0].description).toBe('CANDADO MARINO 60MM')
    expect(request.items[0].taxes).toEqual([{ id: iva19.id }])
  })

  it('si el panel dejó el IVA vacío, usa el IVA del documento y no omite el impuesto', () => {
    const document = buildDocument({
      documentIva: 16286,
      documentSubtotal: 85714,
      items: [
        {
          description: 'CHAZO SUPRA CAIMAN PLATA',
          quantity: 20,
          unitValue: 100,
          total: 2000,
        },
      ],
    })

    const request = buildSiigoPurchaseSendRequest(
      document,
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      '2026-09-18',
      undefined,
      undefined,
      iva19,
      [
        {
          localId: 'item-2',
          tipo: 'Account',
          producto: '51451001',
          description: 'CHAZO SUPRA CAIMAN PLATA',
          quantity: 20,
          unitValue: 100,
          discount: 0,
          ivaTax: null,
          retefuenteTax: null,
        },
      ],
    )

    expect(request.items[0].taxes).toEqual([{ id: iva19.id }])
  })

  it('si el valor unitario ya trae IVA, envía la base neta para que SIIGO no lo vuelva a sumar', () => {
    const document = buildDocument({
      documentSubtotal: 85714,
      documentIva: 16286,
      total: 102000,
      items: [
        {
          description: 'CANDADO MARINO 60MM',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
        },
        {
          description: 'CHAZO SUPRA CAIMAN PLATA',
          quantity: 20,
          unitValue: 100,
          total: 2000,
        },
      ],
    })

    const request = buildSiigoPurchaseSendRequest(
      document,
      ACCOUNT,
      PAYMENT_METHOD,
      [],
      null,
      '2026-09-18',
      undefined,
      undefined,
      iva19,
      [
        {
          localId: 'item-1',
          tipo: 'Account',
          producto: '51359501',
          description: 'CANDADO MARINO 60MM',
          quantity: 1,
          unitValue: 100000,
          discount: 0,
          ivaTax: null,
          retefuenteTax: null,
        },
        {
          localId: 'item-2',
          tipo: 'Account',
          producto: '51451001',
          description: 'CHAZO SUPRA CAIMAN PLATA',
          quantity: 20,
          unitValue: 100,
          discount: 0,
          ivaTax: null,
          retefuenteTax: null,
        },
      ],
    )

    expect(request.items[0].price).toBe(84033.61)
    expect(request.items[1].price).toBe(84.03)
    expect(request.items[0].description).toBe('CANDADO MARINO 60MM')
    expect(request.items[1].description).toBe('CHAZO SUPRA CAIMAN PLATA')
    expect(request.items.map((item) => item.taxes)).toEqual([
      [{ id: iva19.id }],
      [{ id: iva19.id }],
    ])
  })
})
