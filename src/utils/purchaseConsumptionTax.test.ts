import { expect, it } from 'vitest'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { buildSiigoPurchaseSendRequest } from './buildSiigoDocumentRequest'
import { buildPurchaseInvoiceItemDrafts, buildPurchaseInvoiceItemDraftsFromDraft } from '../types/purchaseInvoiceItemDraft'

const inc = { id: 108, name: 'Impoconsumo 8%', percentage: 8 }
const document = {
  id: 'purchase', companyId: 'company', supplierNit: '900123456', invoiceNumber: 'FE123',
  documentSubtotal: 100000, documentIva: 0, documentConsumptionTax: 8000, total: 108000,
  items: [{ description: 'Servicio', quantity: 1, unitValue: 100000, total: 100000, consumptionTaxPercentage: 8, suggestedConsumptionTax: inc }],
} as ElectronicDocumentListItem
const account = { code: '5135', description: 'Gastos' }
const payment = { id: 1, name: 'Contado', type: 'Contado' }

it('envía INC por ítem y lo incluye en payments sin convertirlo en IVA', () => {
  const request = buildSiigoPurchaseSendRequest(document, account, payment, [], null, '2026-10-29')
  expect(request.items[0].taxes).toEqual([{ id: 108 }])
  expect(request.payments[0].value).toBe(108000)
  expect(request.tax_included).toBe(false)
})
it('conserva INC al editar y reabrir un borrador anterior sin impoconsumoTaxId', () => {
  const initial = buildPurchaseInvoiceItemDrafts(document)
  expect(initial[0].consumptionTax?.id).toBe(108)
  const saved = initial.map(item => ({ ...item, ivaTaxId: null, retefuenteTaxId: null }))
  const reopened = buildPurchaseInvoiceItemDraftsFromDraft(saved, [], [], null, document)
  const request = buildSiigoPurchaseSendRequest(document, account, payment, [], null, '2026-10-29', undefined, undefined, null, reopened)
  expect(request.items[0].taxes).toEqual([{ id: 108 }])
  expect(request.payments[0].value).toBe(108000)
})
it('envía IVA e INC juntos y aplica el descuento antes de calcularlos', () => {
  const source = { ...document, documentIva: 19000, total: 127000, items: document.items!.map(item => ({ ...item, ivaPercentage: 19, suggestedTax: { id: 119, name: 'IVA 19%', percentage: 19 } })) }
  const items = buildPurchaseInvoiceItemDrafts(source)
  items[0].discount = 10000
  const request = buildSiigoPurchaseSendRequest(source, account, payment, [], null, '2026-10-29', undefined, undefined, null, items)
  expect(request.items[0].taxes).toEqual([{ id: 119 }, { id: 108 }])
  expect(request.payments[0].value).toBe(114300)
})
it('no aplica INC a las líneas que no lo tienen', () => {
  const source = { ...document, items: [...document.items!, { description: 'Exento', quantity: 1, unitValue: 10000, total: 10000, consumptionTaxPercentage: 0 }] }
  const request = buildSiigoPurchaseSendRequest(source, account, payment, [], null, '2026-10-29')
  expect(request.items[1].taxes).toBeUndefined()
  expect(request.payments[0].value).toBe(118000)
})
it('calcula ReteIVA solo sobre el IVA, sin retener el impoconsumo', () => {
  const source = { ...document, documentIva: 19000, total: 127000, items: document.items!.map(item => ({ ...item, ivaPercentage: 19, suggestedTax: { id: 119, name: 'IVA 19%', percentage: 19 } })) }
  const request = buildSiigoPurchaseSendRequest(source, account, payment, [{ id: 215, name: 'ReteIVA 15%', type: 'ReteIVA', percentage: 15 }], null, '2026-10-29')
  expect(request.payments[0].value).toBe(124150)
})
it('bloquea el envío si el catálogo no permite reconocer el INC de la factura', () => {
  const source = { ...document, items: document.items!.map(item => ({ ...item, suggestedConsumptionTax: null })) }
  expect(() => buildSiigoPurchaseSendRequest(source, account, payment, [], null, '2026-10-29')).toThrow('impoconsumo')
})
