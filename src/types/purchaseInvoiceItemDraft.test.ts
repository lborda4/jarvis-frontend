import { describe, expect, it } from 'vitest'
import {
  buildPurchaseInvoiceItemDrafts,
  calculatePurchaseInvoiceItemLineTotals,
  createEmptyPurchaseInvoiceItemDraft,
  draftItemsHaveAssignedCodes,
  hasUnresolvedProductItem,
  mergeLateItemSuggestions,
  type PurchaseInvoiceItemDraft,
} from './purchaseInvoiceItemDraft'
import type { ElectronicDocumentListItem } from './electronicDocument'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'

function accountCatalogWith(...codes: string[]): SiigoAccountOption[] {
  return codes.map((code) => ({ code, description: `Cuenta ${code}` }))
}

function buildDraft(
  overrides: Partial<PurchaseInvoiceItemDraft> = {},
): PurchaseInvoiceItemDraft {
  return {
    ...createEmptyPurchaseInvoiceItemDraft(),
    ...overrides,
  }
}

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
    supplierName: 'Proveedor Repetido SAS',
    supplierNit: '900685902',
    documentSubtotal: 100000,
    documentIva: 19000,
    total: 119000,
    status: 'PENDING',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('calculatePurchaseInvoiceItemLineTotals', () => {
  it('Lafayette — una sola línea: el Valor total de la línea es el Total neto del documento, no cantidad × V/U + IVA', () => {
    // invoiced_quantity: 1.5, price_amount: 29900, line_extension_amount: 0.00
    // tax_totals[0]: { tax_amount: 8521.50, percent: 19.00, amount(base): 44850.00 }
    // legal_monetary_totals.payable_amount: 8521.50
    const item = buildDraft({
      quantity: 1.5,
      unitValue: 29900,
      ivaTax: { id: 1, name: 'IVA 19%', type: 'IVA', percentage: 19 },
    })

    // Antes del fix: base (44850) + IVA (8521.50) = 53371.50 → mostraba $53.372.
    const lineTotals = calculatePurchaseInvoiceItemLineTotals([item], 8521.5)

    expect(lineTotals).toEqual([8521.5])
  })

  it('una sola línea sin impuestos configurados también toma el Total neto del documento directo', () => {
    const item = buildDraft({ quantity: 1, unitValue: 16000 })

    const lineTotals = calculatePurchaseInvoiceItemLineTotals([item], 16000)

    expect(lineTotals).toEqual([16000])
  })

  it('varias líneas: reparte el Total neto proporcional al peso de cada línea y la suma cuadra exacto', () => {
    const itemA = buildDraft({
      quantity: 2,
      unitValue: 5000,
      ivaTax: { id: 1, name: 'IVA 19%', type: 'IVA', percentage: 19 },
    }) // peso natural: 10000 + 1900 = 11900
    const itemB = buildDraft({
      quantity: 1,
      unitValue: 3000,
    }) // peso natural: 3000

    const documentTotal = 14000
    const lineTotals = calculatePurchaseInvoiceItemLineTotals(
      [itemA, itemB],
      documentTotal,
    )

    expect(lineTotals.reduce((sum, value) => sum + value, 0)).toBe(documentTotal)
    // itemA pesa más (11900 vs 3000 de itemB) → le toca la mayor parte del reparto.
    expect(lineTotals[0]).toBeGreaterThan(lineTotals[1])
  })

  it('resta la Retefuente elegida por línea después de repartir el total', () => {
    const item = buildDraft({
      quantity: 1,
      unitValue: 100000,
      retefuenteTax: { id: 2, name: 'Retefuente 2.5%', type: 'Retefuente', percentage: 2.5 },
    })

    const lineTotals = calculatePurchaseInvoiceItemLineTotals([item], 100000)

    expect(lineTotals).toEqual([100000 - 2500])
  })

  it('devuelve un arreglo vacío cuando no hay ítems', () => {
    expect(calculatePurchaseInvoiceItemLineTotals([], 5000)).toEqual([])
  })
})

describe('buildPurchaseInvoiceItemDrafts', () => {
  it('proveedor repetido con config consistente: autocompleta tipo, cuenta/producto, IVA y Retefuente', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Servicio de aseo',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
          code: 'CODIGO-FACTURA',
        },
      ],
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: '5135950001',
        accountName: '5135950001',
        productCode: null,
        productName: null,
        ivaTax: { id: 1, name: 'IVA 19%', percentage: 19 },
        retefuenteTax: { id: 4, name: 'Servicios 4%', percentage: 4 },
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('5135950001', 'CODIGO-FACTURA'),
    )

    expect(draft.tipo).toBe('Account')
    // La cuenta aprendida del historial del proveedor manda sobre el código
    // que trae la factura importada.
    expect(draft.producto).toBe('5135950001')
    expect(draft.ivaTax).toEqual({
      id: 1,
      name: 'IVA 19%',
      type: 'IVA',
      percentage: 19,
    })
    expect(draft.retefuenteTax).toEqual({
      id: 4,
      name: 'Servicios 4%',
      type: 'Retefuente',
      percentage: 4,
    })
  })

  it('proveedor con Retefuente consistente en el historial: se autocompleta igual que el IVA (Araujo & Segovia SA)', () => {
    // Caso real reportado: el historial del proveedor trae una Retefuente
    // consistente, pero el documento puntual no la trae seleccionada — antes
    // se dejaba en null a propósito porque listado y detalle armaban esta
    // lista cada uno por su cuenta (un Total distinto para el mismo
    // documento solo por abrir el panel). Ahora ambos parten de esta misma
    // función (ver SupportDocumentTable.tsx), así que no hay como divergir:
    // se autocompleta igual que cuenta/IVA.
    const document = buildDocument({
      items: [
        {
          description: 'Servicio de aseo',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
        },
      ],
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: '5135950001',
        accountName: '5135950001',
        productCode: null,
        productName: null,
        ivaTax: { id: 1, name: 'IVA 19%', percentage: 19 },
        retefuenteTax: { id: 4, name: 'Servicios 4%', percentage: 4 },
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document)

    expect(draft.retefuenteTax).toEqual({
      id: 4,
      name: 'Servicios 4%',
      type: 'Retefuente',
      percentage: 4,
    })
  })

  it('proveedor repetido con itemType=Product: precarga el código de producto aprendido cuando existe en el catálogo', () => {
    const document = buildDocument({
      items: [
        { description: 'Producto X', quantity: 2, unitValue: 5000, total: 10000 },
      ],
      suggestedItemConfig: {
        itemType: 'Product',
        accountCode: null,
        accountName: null,
        productCode: 'PROD-001',
        productName: 'Producto de prueba',
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [], [
      { code: 'PROD-001', description: 'Producto de prueba' },
    ])

    expect(draft.tipo).toBe('Product')
    expect(draft.producto).toBe('PROD-001')
  })

  it('usa el tipo y producto elegidos por IA cuando el historial no resolvió el tipo', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Bota Titán',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
        },
      ],
      suggestedItemConfig: null,
      aiSuggestedItemType: 'Product',
      suggestedProduct: {
        code: 'BOTATITAN235209042',
        name: 'Bota Titán',
      },
      aiConfidence: 30,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [], [
      {
        code: 'BOTATITAN235209042',
        description: 'Bota Titán',
      },
    ])

    expect(draft.tipo).toBe('Product')
    expect(draft.producto).toBe('BOTATITAN235209042')
  })

  it('infiere Product desde suggestedProduct para sugerencias antiguas sin aiSuggestedItemType', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Bota Titán',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
        },
      ],
      suggestedItemConfig: null,
      suggestedProduct: {
        code: 'BOTATITAN235209042',
        name: 'Bota Titán',
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [], [
      {
        code: 'BOTATITAN235209042',
        description: 'Bota Titán',
      },
    ])

    expect(draft.tipo).toBe('Product')
    expect(draft.producto).toBe('BOTATITAN235209042')
  })

  it('proveedor repetido con itemType=Product: descarta el código aprendido si ya no existe en el catálogo real de productos', () => {
    const document = buildDocument({
      items: [
        { description: 'Producto X', quantity: 2, unitValue: 5000, total: 10000 },
      ],
      suggestedItemConfig: {
        itemType: 'Product',
        accountCode: null,
        accountName: null,
        productCode: 'PROD-001',
        productName: 'Producto de prueba',
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [], [])

    expect(draft.tipo).toBe('Product')
    expect(draft.producto).toBe('')
  })

  it('caso real LAFAYETTE: proveedor dominante Producto, pero un ítem puntual ("BAHHIA") tiene regla exacta de cuenta — ese ítem se trata como Cuenta, no Producto', () => {
    const document = buildDocument({
      items: [
        {
          description: 'BAHHIA',
          quantity: 1,
          unitValue: 29900,
          total: 29900,
          suggestedAccount: {
            code: '61350503',
            name: 'Muestras gratis',
            source: 'exact',
          },
        },
      ],
      suggestedItemConfig: {
        itemType: 'Product',
        accountCode: null,
        accountName: null,
        productCode: null,
        productName: null,
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('61350503'),
    )

    expect(draft.tipo).toBe('Account')
    expect(draft.producto).toBe('61350503')
  })

  it('la regla exacta por ítem no aplica si la cuenta ya no existe en el catálogo real (se descarta, no fuerza tipo Cuenta con código inválido)', () => {
    const document = buildDocument({
      items: [
        {
          description: 'BAHHIA',
          quantity: 1,
          unitValue: 29900,
          total: 29900,
          suggestedAccount: {
            code: '61350503',
            name: 'Muestras gratis',
            source: 'exact',
          },
        },
      ],
      suggestedItemConfig: {
        itemType: 'Product',
        accountCode: null,
        accountName: null,
        productCode: null,
        productName: null,
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [])

    expect(draft.tipo).toBe('Account')
    expect(draft.producto).toBe('')
  })

  it('una regla "fallback" (no confirmada) por ítem NO cambia el tipo dominante del proveedor', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Concepto nuevo',
          quantity: 1,
          unitValue: 10000,
          total: 10000,
          suggestedAccount: {
            code: '61350503',
            name: 'Muestras gratis',
            source: 'fallback',
          },
        },
      ],
      suggestedItemConfig: {
        itemType: 'Product',
        accountCode: null,
        accountName: null,
        productCode: 'PROD-002',
        productName: 'Producto de prueba 2',
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('61350503'),
      [{ code: 'PROD-002', description: 'Producto de prueba 2' }],
    )

    expect(draft.tipo).toBe('Product')
    expect(draft.producto).toBe('PROD-002')
  })

  it('proveedor nuevo o con variabilidad (sin suggestedItemConfig): no autocompleta, se comporta como hoy', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Servicio vario',
          quantity: 1,
          unitValue: 50000,
          total: 50000,
          code: 'CODIGO-FACTURA',
          suggestedTax: { id: 7, name: 'IVA 5%', percentage: 5 },
        },
      ],
      suggestedItemConfig: null,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('CODIGO-FACTURA'),
    )

    expect(draft.tipo).toBe('Account')
    // Sin config del proveedor, producto cae al código de la factura importada
    // (siempre que exista de verdad en el catálogo de cuentas).
    expect(draft.producto).toBe('CODIGO-FACTURA')
    // Sin config del proveedor, el IVA cae al match por % de la factura (mecanismo existente).
    expect(draft.ivaTax).toEqual({
      id: 7,
      name: 'IVA 5%',
      type: 'IVA',
      percentage: 5,
    })
    expect(draft.retefuenteTax).toBeNull()
  })

  it('la config del proveedor tiene prioridad sobre el match de IVA por % de la factura', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Servicio',
          quantity: 1,
          unitValue: 50000,
          total: 50000,
          suggestedTax: { id: 7, name: 'IVA 5%', percentage: 5 },
        },
      ],
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: '5135950001',
        accountName: '5135950001',
        productCode: null,
        productName: null,
        ivaTax: { id: 1, name: 'IVA 19%', percentage: 19 },
        retefuenteTax: null,
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document)

    expect(draft.ivaTax?.id).toBe(1)
  })

  it('sin ítems: la línea de respaldo también toma la config del proveedor cuando existe, incluida la Retefuente', () => {
    const document = buildDocument({
      items: [],
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: '5135950001',
        accountName: '5135950001',
        productCode: null,
        productName: null,
        ivaTax: { id: 1, name: 'IVA 19%', percentage: 19 },
        retefuenteTax: { id: 4, name: 'Servicios 4%', percentage: 4 },
        paymentMethod: null,
      },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('5135950001'),
    )

    expect(draft.tipo).toBe('Account')
    expect(draft.producto).toBe('5135950001')
    expect(draft.ivaTax?.id).toBe(1)
    expect(draft.retefuenteTax?.id).toBe(4)
  })

  it('si la factura trae IVA 19% y el catálogo tiene Activo Fijo, precarga el IVA de compras no el de activo', () => {
    const document = buildDocument({
      documentSubtotal: 85714,
      documentIva: 16286,
      items: [
        {
          description: 'CANDADO MARINO 60MM ISEO',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
        },
      ],
      suggestedItemConfig: null,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [], [], [
      { id: 6, name: 'IVA Activo Fijo', type: 'IVA', percentage: 19 },
      { id: 1, name: 'IVA 19%', type: 'IVA', percentage: 19 },
    ])

    expect(draft.ivaTax?.id).toBe(1)
    expect(draft.ivaTax?.name).toBe('IVA 19%')
  })

  it('sin ítems y sin config del proveedor: arranca vacío como antes', () => {
    const document = buildDocument({ items: [], suggestedItemConfig: null })

    const [draft] = buildPurchaseInvoiceItemDrafts(document)

    expect(draft.tipo).toBe('Account')
    expect(draft.producto).toBe('')
    expect(draft.ivaTax).toBeNull()
    expect(draft.retefuenteTax).toBeNull()
  })

  it('sin config confiable del proveedor ni código en la factura, autocompleta con la cuenta sugerida por IA', () => {
    // Caso reportado: proveedor nuevo/sin historial suficiente (sin
    // suggestedItemConfig), la factura importada no trae código de ítem, pero
    // SiigoPurchaseAiClassificationService ya clasificó el documento y
    // document.suggestedAccount refleja esa sugerencia (ver
    // resolveSuggestedAccountForDocument en el backend, que la prioriza).
    const document = buildDocument({
      items: [
        { description: 'Recarga celular', quantity: 1, unitValue: 10000, total: 10000 },
      ],
      suggestedItemConfig: null,
      suggestedAccount: { code: '51356002', name: 'Servicio Línea Telefónica', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('51356002'),
    )

    expect(draft.producto).toBe('51356002')
  })

  it('asigna una cuenta distinta a cada línea cuando la IA clasificó ítem por ítem', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Resma de papel',
          quantity: 1,
          unitValue: 10000,
          total: 10000,
          suggestedAccount: {
            code: '51953001',
            name: 'Papelería',
            source: 'fallback',
          },
        },
        {
          description: 'Jabón líquido',
          quantity: 1,
          unitValue: 8000,
          total: 8000,
          suggestedAccount: {
            code: '51050601',
            name: 'Aseo',
            source: 'fallback',
          },
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: null,
    })

    const drafts = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('51953001', '51050601'),
    )

    expect(drafts.map((item) => item.producto)).toEqual(['51953001', '51050601'])
  })

  it('la cuenta aprendida del historial del proveedor tiene prioridad sobre la sugerida por IA', () => {
    const document = buildDocument({
      items: [
        { description: 'Servicio de aseo', quantity: 1, unitValue: 100000, total: 100000 },
      ],
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: '5135950001',
        accountName: '5135950001',
        productCode: null,
        productName: null,
        ivaTax: null,
        retefuenteTax: null,
        paymentMethod: null,
      },
      suggestedAccount: { code: '51356002', name: 'Servicio Línea Telefónica', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('5135950001', '51356002'),
    )

    expect(draft.producto).toBe('5135950001')
  })

  it('el código que ya trae la factura importada tiene prioridad sobre la sugerida por IA', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Recarga celular',
          quantity: 1,
          unitValue: 10000,
          total: 10000,
          code: 'CODIGO-FACTURA',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: { code: '51356002', name: 'Servicio Línea Telefónica', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('CODIGO-FACTURA', '51356002'),
    )

    expect(draft.producto).toBe('CODIGO-FACTURA')
  })

  it('sin ítems: la línea de respaldo también autocompleta con la cuenta sugerida por IA cuando no hay config del proveedor', () => {
    const document = buildDocument({
      items: [],
      suggestedItemConfig: null,
      suggestedAccount: { code: '51356002', name: 'Servicio Línea Telefónica', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('51356002'),
    )

    expect(draft.producto).toBe('51356002')
  })

  it('un código "1" en la factura importada (placeholder genérico de DIAN, caso real reportado) se descarta y deja paso a la sugerencia de IA', () => {
    // Caso real: factura DIAN de una recarga de celular sin SKU/cuenta real
    // trae items[].code="1" — sin este fix, "1" pasaba tal cual y el
    // autocomplete de cuenta mostraba "1 - 1" (ninguna cuenta real tiene
    // código "1").
    const document = buildDocument({
      items: [
        {
          description: '3166213494 Recarga',
          quantity: 1,
          unitValue: 10000,
          total: 10000,
          code: '1',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: { code: '51356002', name: 'Servicio Línea Telefónica', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('51356002'),
    )

    expect(draft.producto).toBe('51356002')
  })

  it('un código "1" sin sugerencia de IA disponible tampoco se autocompleta: queda vacío, no "1"', () => {
    const document = buildDocument({
      items: [
        {
          description: '3166213494 Recarga',
          quantity: 1,
          unitValue: 10000,
          total: 10000,
          code: '1',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: null,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document)

    expect(draft.producto).toBe('')
  })

  it('un código de barras EAN-13 en la factura importada (caso real reportado: D1 S.A.S) se descarta y deja paso a la sugerencia de IA', () => {
    // Caso real: factura de D1 (tienda de descuento) trae items[].code =
    // "7702004025784", el código de barras del PRODUCTO puesto por el
    // VENDEDOR en su propia factura — nunca una cuenta contable del
    // comprador. Sin este fix, autocompletaba "7702004025784 -
    // 7702004025784" como si fuera la cuenta.
    const document = buildDocument({
      items: [
        {
          description: 'PONY MALTA GO PET 20',
          quantity: 12,
          unitValue: 1176.47,
          total: 14117.65,
          code: '7702004025784',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: { code: '51353501', name: 'Alimentos y bebidas', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('51353501'),
    )

    expect(draft.producto).toBe('51353501')
  })

  it('un código de barras EAN-13 sin sugerencia de IA disponible tampoco se autocompleta: queda vacío', () => {
    const document = buildDocument({
      items: [
        {
          description: 'PONY MALTA GO PET 20',
          quantity: 12,
          unitValue: 1176.47,
          total: 14117.65,
          code: '7702004025784',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: null,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document)

    expect(draft.producto).toBe('')
  })

  it('un código del ítem que sí coincide con una cuenta real del catálogo se sigue usando como fallback', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Servicio de aseo',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
          code: '5135950001',
        },
      ],
      suggestedItemConfig: null,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('5135950001'),
    )

    expect(draft.producto).toBe('5135950001')
  })

  it('un código del ítem que NO existe en el catálogo de cuentas nunca se usa, aunque no "parezca" basura (caso explícito pedido: solo cuentas reales del catálogo)', () => {
    const document = buildDocument({
      items: [
        {
          description: 'Servicio de aseo',
          quantity: 1,
          unitValue: 100000,
          total: 100000,
          code: 'ALGO-QUE-NO-EXISTE',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: { code: '51356002', name: 'Servicio Línea Telefónica', uses: 1 },
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(
      document,
      accountCatalogWith('51356002'),
    )

    expect(draft.producto).toBe('51356002')
  })

  it('la cuenta guardada en accountMapping se muestra aunque el catálogo todavía no haya cargado', () => {
    const document = buildDocument({
      items: [
        {
          description: 'BOLSA RECICLADA',
          quantity: 1,
          unitValue: 500,
          total: 500,
          accountMapping: { code: '51959501' },
          itemType: 'Account',
        },
      ],
      suggestedItemConfig: null,
      suggestedAccount: null,
    })

    const [draft] = buildPurchaseInvoiceItemDrafts(document, [])

    expect(draft.tipo).toBe('Account')
    expect(draft.producto).toBe('51959501')
  })
})

describe('mergeLateItemSuggestions', () => {
  it('copia la cuenta que llega después en una línea que el paso 1 dejó vacía', () => {
    const stored = [buildDraft({ tipo: 'Account', producto: '', description: 'BOLSA RECICLADA' })]
    const fresh = [buildDraft({ tipo: 'Account', producto: '51959501', description: 'BOLSA RECICLADA' })]

    expect(mergeLateItemSuggestions(stored, fresh)[0].producto).toBe('51959501')
  })

  it('no pisa un código que el contador ya eligió', () => {
    const stored = [buildDraft({ tipo: 'Account', producto: '51050601' })]
    const fresh = [buildDraft({ tipo: 'Account', producto: '51959501' })]

    expect(mergeLateItemSuggestions(stored, fresh)[0].producto).toBe('51050601')
  })

  it('un array vacío no tapa las cuentas del borrador ([] es truthy y devolvía cero líneas)', () => {
    const fresh = [buildDraft({ tipo: 'Account', producto: '51959501' })]

    expect(mergeLateItemSuggestions([], fresh)[0].producto).toBe('51959501')
  })

  it('copia el IVA que llega después aunque la cuenta ya estuviera llena', () => {
    const stored = [buildDraft({ tipo: 'Account', producto: '51452501', ivaTax: null })]
    const fresh = [
      buildDraft({
        tipo: 'Account',
        producto: '51452501',
        ivaTax: { id: 1, name: 'IVA 19%', type: 'IVA', percentage: 19 },
      }),
    ]

    expect(mergeLateItemSuggestions(stored, fresh)[0].ivaTax?.id).toBe(1)
  })
})

describe('draftItemsHaveAssignedCodes', () => {
  it('ignora un borrador que solo trae líneas sin cuenta', () => {
    expect(
      draftItemsHaveAssignedCodes([
        { tipo: 'Account', producto: '', description: 'BOLSA', quantity: 1, unitValue: 500, discount: 0 },
      ]),
    ).toBe(false)
  })

  it('acepta un borrador con al menos una cuenta guardada', () => {
    expect(
      draftItemsHaveAssignedCodes([
        { tipo: 'Account', producto: '51959501', description: 'BOLSA', quantity: 1, unitValue: 500, discount: 0 },
      ]),
    ).toBe(true)
  })
})

describe('hasUnresolvedProductItem', () => {
  it('detecta un ítem tipo Producto sin código (caso real: primera compra de un producto nuevo, ej. "cremallera azul")', () => {
    const items = [buildDraft({ tipo: 'Product', producto: '' })]

    expect(hasUnresolvedProductItem(items)).toBe(true)
  })

  it('no marca nada si el ítem Producto ya tiene código', () => {
    const items = [buildDraft({ tipo: 'Product', producto: 'PROD-001' })]

    expect(hasUnresolvedProductItem(items)).toBe(false)
  })

  it('un ítem Cuenta o Activo fijo sin código NO cuenta como "requiere revisión" (tienen su propio manejo)', () => {
    const items = [
      buildDraft({ tipo: 'Account', producto: '' }),
      buildDraft({ tipo: 'FixedAsset', producto: '' }),
    ]

    expect(hasUnresolvedProductItem(items)).toBe(false)
  })

  it('false sin ítems', () => {
    expect(hasUnresolvedProductItem([])).toBe(false)
    expect(hasUnresolvedProductItem(undefined)).toBe(false)
  })
})
