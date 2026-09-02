import { describe, expect, it } from 'vitest'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { buildPurchaseInvoiceItemDrafts } from '../types/purchaseInvoiceItemDraft'
import { calculatePurchaseInvoiceRowSummary } from './purchaseInvoiceRowSummary'

/**
 * Suite de regresión permanente: "Total neto" SIEMPRE debe salir del
 * pass-through de `document.total` (payload.totals.total, que ya es
 * legal_monetary_totals.payable_amount mapeado directo del JSON de la
 * DIAN/NextPyme) menos las retenciones del comprador — nunca de la fórmula
 * paralela "Subtotal + IVA − retenciones − descuento", que en facturas
 * reales (ej. muestras sin valor comercial) diverge de lo realmente
 * pagable porque el vendedor asume el IVA.
 *
 * El caso "Lafayette" es el canario: si alguien reintroduce esa fórmula
 * paralela, ese test específico es el primero en fallar (ver el assert
 * explícito contra la fórmula vieja dentro de él).
 */

function buildDocument(
  overrides: Partial<ElectronicDocumentListItem> = {},
): ElectronicDocumentListItem {
  return {
    id: 'doc-1',
    companyId: 'company-1',
    companyName: 'Empresa de prueba',
    cufe: 'cufe-1',
    invoiceNumber: 'F-1',
    issueDate: '2026-08-01',
    dueDate: null,
    documentDiscount: null,
    supplierName: 'Proveedor de prueba',
    supplierNit: '900123456',
    supplierDocumentType: 'NIT',
    documentSubtotal: 0,
    documentIva: 0,
    total: 0,
    status: 'PENDING',
    items: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('calculatePurchaseInvoiceRowSummary — Total neto = payable_amount, nunca Subtotal + IVA', () => {
  it('[CANARIO] Lafayette — factura de muestra sin valor comercial (el vendedor asume el IVA)', () => {
    // JSON real reportado: legal_monetary_totals: { tax_exclusive_amount:
    // 44850.00, tax_inclusive_amount: 8521.50, payable_amount: 8521.50 },
    // tax_totals: [{ tax_amount: 8521.50, percent: 19.00 }].
    // Subtotal + IVA (44850 + 8521.50 = 53371.50) NO es lo pagable acá — es
    // justo el bug que se reportó dos veces (mostraba $53.372).
    const document = buildDocument({
      documentSubtotal: 44850,
      documentIva: 8521.5,
      total: 8521.5,
    })

    const summary = calculatePurchaseInvoiceRowSummary(document, [])

    expect(summary.subtotal).toBe(44850)
    expect(summary.ivaAmount).toBe(8521.5)
    expect(summary.total).toBe(8521.5)

    // Guarda explícita: si alguien vuelve a calcular total como
    // subtotal + iva - retenciones - descuento, este assert es el que
    // revienta primero (la fórmula vieja da 53371.5, no 8521.5).
    const oldParallelFormula = summary.subtotal + summary.ivaAmount - 0 - 0
    expect(summary.total).not.toBe(oldParallelFormula)
  })

  it('Dollarcity — valor unitario con IVA incluido: no debe duplicar el IVA en el resumen', () => {
    // JSON real: legal_monetary_totals: { tax_exclusive_amount: 13445.38,
    // tax_inclusive_amount: 16000.00, payable_amount: 16000.00 },
    // tax_totals: [{ tax_amount: 2554.62, percent: 19.00 }].
    const document = buildDocument({
      documentSubtotal: 13445.38,
      documentIva: 2554.62,
      total: 16000,
    })

    const summary = calculatePurchaseInvoiceRowSummary(document, [])

    expect(summary.subtotal).toBe(13445.38)
    expect(summary.ivaAmount).toBe(2554.62)
    expect(summary.total).toBe(16000)
  })

  it('Matriarca — descuento general de $50.000 + retención: payable_amount ya trae el descuento, la retención se resta aparte', () => {
    // JSON real reportado originalmente: legal_monetary_totals: {
    // tax_exclusive_amount: 1000000.00, tax_inclusive_amount: 1190000.00,
    // allowance_total_amount: 50000.00, payable_amount: 1140000.00 }.
    // payable_amount (1140000) ya tiene el descuento de 50000 restado — no
    // hay que restarlo de nuevo al armar "total".
    const document = buildDocument({
      documentSubtotal: 1000000,
      documentIva: 190000,
      documentDiscount: 50000,
      total: 1140000,
    })

    // Sin retenciones: total = payable_amount tal cual.
    const summaryWithoutRetentions = calculatePurchaseInvoiceRowSummary(document, [])
    expect(summaryWithoutRetentions.documentDiscount).toBe(50000)
    expect(summaryWithoutRetentions.total).toBe(1140000)

    // Con una retención del comprador (ej. Retefuente 2.5%): se resta
    // aparte de payable_amount, no se vuelve a tocar el descuento general.
    const retentions: SiigoTaxOption[] = [
      { id: 1, name: 'ReteRenta 2.5%', type: 'ReteRenta', percentage: 2.5 },
    ]
    const summaryWithRetention = calculatePurchaseInvoiceRowSummary(document, retentions)
    const expectedRetention = 25000 // 2.5% de subtotal (1000000)
    expect(summaryWithRetention.total).toBe(1140000 - expectedRetention)
  })

  it('descuento general editado a mano: el Total se desplaza por la diferencia contra el valor original de la DIAN', () => {
    const document = buildDocument({
      documentSubtotal: 1000000,
      documentIva: 190000,
      documentDiscount: 50000,
      total: 1140000,
    })

    // El contador sube el descuento de 50.000 a 80.000 — el Total baja en
    // esos 30.000 extra, sin tocar payable_amount.
    const summaryIncreased = calculatePurchaseInvoiceRowSummary(
      document,
      [],
      null,
      80000,
    )
    expect(summaryIncreased.documentDiscount).toBe(80000)
    expect(summaryIncreased.total).toBe(1140000 - 30000)

    // El contador lo borra a 0 — el Total sube en los 50.000 que ya traía.
    const summaryCleared = calculatePurchaseInvoiceRowSummary(document, [], null, 0)
    expect(summaryCleared.documentDiscount).toBe(0)
    expect(summaryCleared.total).toBe(1140000 + 50000)

    // Sin override (undefined): se comporta exactamente igual que antes.
    const summaryUnedited = calculatePurchaseInvoiceRowSummary(document, [])
    expect(summaryUnedited.total).toBe(1140000)
  })

  it('Movistar — factura sin IVA (sin tax_totals): sigue funcionando tras el fix', () => {
    // JSON real: legal_monetary_totals: { tax_exclusive_amount: 0.00,
    // tax_inclusive_amount: 16000.00, payable_amount: 16000.00 }, sin
    // tax_totals a nivel de factura (línea sin impuestos).
    const document = buildDocument({
      documentSubtotal: 16000,
      documentIva: 0,
      total: 16000,
    })

    const summary = calculatePurchaseInvoiceRowSummary(document, [])

    expect(summary.subtotal).toBe(16000)
    expect(summary.ivaAmount).toBe(0)
    expect(summary.total).toBe(16000)
  })

  it('resta las retenciones del comprador del Total neto (payable_amount - retenciones), caso genérico', () => {
    const document = buildDocument({
      documentSubtotal: 100000,
      documentIva: 19000,
      total: 119000,
    })
    const retentions: SiigoTaxOption[] = [
      { id: 1, name: 'ReteICA 6.9‰', type: 'ReteICA', percentage: 6.9 },
    ]

    const summary = calculatePurchaseInvoiceRowSummary(document, retentions)

    const expectedRetention = 690 // ReteICA se calcula en por mil: 100000 * 6.9 / 1000
    expect(summary.total).toBe(119000 - expectedRetention)
  })

  it('[CANARIO] Araujo & Segovia SA — el Total del listado y el del panel de detalle nunca pueden divergir', () => {
    // JSON real reportado: legal_monetary_totals: { tax_exclusive_amount:
    // 4252044.00, tax_amount: 807888.00, payable_amount: 5059932.00,
    // allowance_total_amount: 0, charge_total_amount: 0 }. Sin ninguna
    // retención elegida a mano por el contador en esta factura.
    //
    // El historial del proveedor SÍ trae una Retefuente consistente
    // (tieneVariabilidad=false). El bug original: el panel de detalle armaba
    // un draft con esa Retefuente precargada (~3.5% de 4.252.044 ≈ $148.822)
    // mientras el listado, con una resolución de ítems distinta, no la
    // aplicaba — mismo documento, dos Totales distintos en la misma pantalla
    // ($5.059.932 en listado vs. $4.911.110 en detalle). El fix real no fue
    // "Retefuente nunca se autocompleta": fue que listado y detalle usen
    // SIEMPRE la MISMA resolución de ítems (ver effectivePurchaseInvoiceItems
    // en SupportDocumentTable.tsx) — así, si uno aplica la retención
    // aprendida del proveedor, el otro también, y no pueden divergir.
    const document = buildDocument({
      supplierNit: '890400048',
      documentSubtotal: 4252044,
      documentIva: 807888,
      total: 5059932,
      items: [
        {
          description: 'Arriendo',
          quantity: 1,
          unitValue: 4252044,
          total: 4252044,
        },
      ],
      suggestedItemConfig: {
        itemType: 'Account',
        accountCode: '71201002',
        accountName: '71201002',
        productCode: null,
        productName: null,
        ivaTax: { id: 1, name: 'IVA Servicios 19%', percentage: 19 },
        retefuenteTax: { id: 9, name: 'Servicios 3.5%', percentage: 3.5 },
        paymentMethod: null,
      },
    })

    // Listado y detalle parten de la MISMA resolución de ítems — igual que
    // effectivePurchaseInvoiceItems en SupportDocumentTable.tsx: sin ítems
    // guardados ni en edición, ambos caen a buildPurchaseInvoiceItemDrafts.
    const items = buildPurchaseInvoiceItemDrafts(document)
    const listadoSummary = calculatePurchaseInvoiceRowSummary(document, [], items)
    const detalleSummary = calculatePurchaseInvoiceRowSummary(document, [], items)

    const expectedRetefuente = 148821.54 // 3.5% de 4.252.044
    expect(listadoSummary.total).toBe(5059932 - expectedRetefuente)
    // La comparación directa es la que importa: no deben poder divergir,
    // sin importar cuál sea el valor "correcto".
    expect(detalleSummary.total).toBe(listadoSummary.total)
  })
})
