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

describe('centro de costo de la compra', () => {
  it('incluye el centro elegido en Siigo y en la configuración guardada', () => {
    const center = { id: 12, code: '001', name: 'Administración' }
    const request = buildSiigoPurchaseSendRequest(buildDocument(), ACCOUNT, PAYMENT_METHOD, [], center, '2026-09-30')
    expect(request.cost_center).toBe(12)
    expect(request.supplierPreferences?.costCenter).toEqual(center)
  })
  it.each([null, { id: -1, code: '', name: 'Ninguno' }])('omite el centro al dejarlo vacío o seleccionar Ninguno', center => {
    const request = buildSiigoPurchaseSendRequest(buildDocument(), ACCOUNT, PAYMENT_METHOD, [], center, '2026-09-30')
    expect(request.cost_center).toBeUndefined()
    expect(request.supplierPreferences?.costCenter).toBeUndefined()
  })
})
const RETEFUENTE_TAX = {
  id: 7001,
  name: 'Retefuente servicios 4%',
  type: 'Retefuente',
  percentage: 4,
}

describe('buildSiigoPurchaseSendRequest — Retefuente', () => {
  it('no envía la Retefuente sugerida sin selección del usuario', () => {
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

    expect(request.retentions ?? []).toEqual([])
    expect(request.supplierPreferences?.retentions ?? []).toEqual([])
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
    expect(request.items[0].taxes).toBeUndefined()
  })

  it('si el panel dejó el IVA vacío, conserva la línea sin impuesto', () => {
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

    expect(request.items[0].taxes).toBeUndefined()
  })

  it('no cambia precios del editor por discrepancias con los totales importados', () => {
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
          ivaTax: iva19,
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
          ivaTax: iva19,
          retefuenteTax: null,
        },
      ],
    )

    expect(request.items[0].price).toBe(100000)
    expect(request.items[1].price).toBe(100)
    expect(request.items[0].description).toBe('CANDADO MARINO 60MM')
    expect(request.items[1].description).toBe('CHAZO SUPRA CAIMAN PLATA')
    expect(request.items.map((item) => item.taxes)).toEqual([
      [{ id: iva19.id }],
      [{ id: iva19.id }],
    ])
  })
})

describe('envío de facturas con IVA mixto', () => {
  const iva19 = { id: 19, name: 'IVA 19%', type: 'IVA', percentage: 19 }
  const iva5 = { id: 5, name: 'IVA 5%', type: 'IVA', percentage: 5 }
  it.each([false, true])('conserva precios con subtotal que excluye exentos, editada=%s', edited => {
    const prices = [1015, 3500, 20000, 9100, 46218.48, 88000, 8000]
    const quantities = [20, 5, 4, 2, 2, 1, 2]
    const items = prices.map((unitValue, i) => ({
      description: `Ítem ${i}`, unitValue, quantity: quantities[i],
      total: unitValue * quantities[i], suggestedTax: i === 5 ? null : iva19,
    }))
    const request = buildSiigoPurchaseSendRequest(
      buildDocument({ items, documentSubtotal: 244437, documentIva: 46443, total: 378880 }),
      ACCOUNT, PAYMENT_METHOD, [], null, '2026-09-24', undefined, undefined, iva19,
      edited ? items.map((item, i) => ({
        ...item, localId: String(i), tipo: 'Account', producto: ACCOUNT.code,
        discount: 0, ivaTax: item.suggestedTax, retefuenteTax: null,
      })) : undefined,
    )
    expect(request.items.map(item => item.price)).toEqual(prices)
    expect(request.items[5].taxes).toBeUndefined()
    expect(request.payments[0].value).toBeCloseTo(378880, 0)
  })

  it.each([false, true])('aplica el descuento una vez y conserva la base editada=%s', edited => {
    // Caso de regresión: la edición deja la suma cercana al total original.
    // Eso no significa que el precio del editor incluya IVA.
    const item = { description: 'Producto', quantity: 2, unitValue: 60000,
      discount: 10000, total: 110000, suggestedTax: iva19 }
    const document = buildDocument({ items: [item] })
    const before = structuredClone(document)
    const request = buildSiigoPurchaseSendRequest(
      document, ACCOUNT, PAYMENT_METHOD, [], null, '2026-09-24', undefined, undefined, iva19,
      edited ? [{ ...item, localId: '1', tipo: 'Account', producto: ACCOUNT.code,
        ivaTax: iva19, retefuenteTax: null }] : undefined,
    )
    expect(request.items[0].price).toBe(60000)
    expect(request.items[0].discount).toBe(10000)
    expect(request.payments[0].value).toBe(130900)
    expect(document).toEqual(before)
  })
  it.each([false, true])('conserva tarifas por línea, editada=%s', edited => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      description: 'Ítem ' + i, quantity: 1, unitValue: 100, total: 100,
      suggestedTax: i === 9 ? null : i === 8 ? iva5 : iva19,
    }))
    const document = buildDocument({ items, documentSubtotal: 1000, documentIva: 157, total: 1157 })
    const request = buildSiigoPurchaseSendRequest(document, ACCOUNT, PAYMENT_METHOD,
      [], null, '2026-09-28', undefined, undefined, iva19,
      edited ? items.map((item, i) => ({
        localId: String(i), tipo: 'Account', producto: '5105',
        description: item.description, quantity: 1, unitValue: 100,
        discount: 0, ivaTax: item.suggestedTax, retefuenteTax: null,
      })) : undefined,
    )
    expect(request.items.slice(0, 8).every(item => item.taxes?.[0]?.id === 19)).toBe(true)
    expect(request.items[8].taxes).toEqual([{ id: 5 }])
    expect(request.items[9].taxes).toBeUndefined()
    expect(request.payments[0].value).toBe(1157)
  })

  it('convierte precios incluidos solo cuando base, IVA y total concilian', () => {
    const items = [
      { description: '19%', quantity: 1, unitValue: 119, total: 119, suggestedTax: iva19 },
      { description: '5%', quantity: 1, unitValue: 105, total: 105, suggestedTax: iva5 },
      { description: 'Sin IVA', quantity: 1, unitValue: 100, total: 100, suggestedTax: null },
    ]
    const request = buildSiigoPurchaseSendRequest(
      buildDocument({ items, documentSubtotal: 300, documentIva: 24, total: 324 }),
      ACCOUNT, PAYMENT_METHOD, [], null, '2026-09-28', undefined, undefined, iva19,
    )
    expect(request.tax_included).toBe(true)
    expect(request.items.map(item => item.price)).toEqual([119, 105, 100])
    expect(request.items[2].taxes).toBeUndefined()
    expect(request.payments[0].value).toBe(324)
  })

  it.each([false, true])('H&M: convierte precio y descuento con IVA, editada=%s', edited => {
    const prices = [39900, 39900, 39900, 39900, 69900, 59900, 39900, 79900, 59900, 29900, 39900, 300]
    const items = prices.map((unitValue, i) => ({
      description: `H&M ${i}`, quantity: 1, unitValue,
      discount: i === 11 ? 0 : unitValue * 0.1,
      total: i === 11 ? unitValue : unitValue * 0.9,
      suggestedTax: iva19,
    }))
    const document = buildDocument({ items, documentSubtotal: 407823.53,
      documentIva: 77486.47, total: 485310 })
    const before = structuredClone(document)
    const request = buildSiigoPurchaseSendRequest(
      document, ACCOUNT, PAYMENT_METHOD, [], null, '2026-08-23', undefined, undefined, iva19,
      edited ? items.map((item, i) => ({ ...item, localId: String(i),
        tipo: 'Account', producto: ACCOUNT.code, ivaTax: iva19, retefuenteTax: null,
      })) : undefined,
    )
    expect(request.tax_included).toBe(true)
    expect(request.items[4].price).toBe(69900)
    expect(request.items[4].discount).toBe(6990)
    const base = request.items.reduce((sum, item) => sum + (item.quantity * item.price - (item.discount ?? 0)) / 1.19, 0)
    expect(Math.abs(base - 407823.53)).toBeLessThan(0.1)
    expect(Math.abs(base * 0.19 - 77486.47)).toBeLessThan(0.1)
    expect(Math.round(request.payments[0].value)).toBe(485310)
    expect(document).toEqual(before)
  })

  it('no convierte por coincidencia del total si el IVA no concilia', () => {
    const request = buildSiigoPurchaseSendRequest(buildDocument({
      documentSubtotal: 100000, documentIva: 10000, total: 110000,
      items: [{ description: 'Precio base', quantity: 1, unitValue: 110000,
        total: 110000, suggestedTax: iva19 }],
    }), ACCOUNT, PAYMENT_METHOD, [], null, '2026-09-29')
    expect(request.items[0].price).toBe(110000)
  })
})
