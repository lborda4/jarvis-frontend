import { describe, it, expect } from 'vitest'
import { calculatePurchaseInvoiceRowSummary } from './purchaseInvoiceRowSummary'
import { formatInvoiceCurrency } from './formatters'
import fixture from './fixtures/nextpyme-discounts.json'
import { buildSiigoPurchaseSendRequest } from './buildSiigoDocumentRequest'
import { buildPurchaseInvoiceItemDrafts, buildPurchaseInvoiceItemDraftsFromDraft, calculatePurchaseInvoiceItemLineTotals, purchaseInvoiceItemDraftBase } from '../types/purchaseInvoiceItemDraft'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { roundMoney } from './siigoSupportDocumentTotal'
const iva = { id: 19, name: 'IVA 19%', type: 'IVA', percentage: 19 }
const account = { code: '5105', description: 'Cuenta seleccionada' }
function document(): ElectronicDocumentListItem {
 return { id: 'doc-1', companyId: 'company-1', companyName: 'Test', cufe: 'test', invoiceNumber: 'FE1', supplierNit: '900123456', issueDate: '2026-08-23', dueDate: null, supplierName: 'Test', status: 'ACCOUNT_REQUIRED', createdAt: '', updatedAt: '',
 documentSubtotal: 407823.53, documentIva: 77486.47, documentDiscount: 0, total: 485310,
 items: fixture.invoice_lines.map(line => ({description: line.description, quantity: Number(line.invoiced_quantity), unitValue: Number(line.price_amount), total: Number(line.line_extension_amount), discount: line.allowance_charges.reduce((sum,c)=>sum+Number(c.amount),0), ivaPercentage: 19, suggestedTax: iva})) } as ElectronicDocumentListItem
}
describe('Descuentos reales Nextpyme a formulario y Siigo', () => {
 it('muestra exactamente subtotal, IVA y descuento general originales con centavos', () => {
   const summary = calculatePurchaseInvoiceRowSummary(document(), [], null, 53900)
   expect(summary.subtotal).toBe(407823.53)
   expect(summary.ivaAmount).toBe(77486.47)
   expect(summary.documentDiscount).toBe(0)
   expect(summary.total).toBe(485310)
   expect(formatInvoiceCurrency(summary.subtotal)).toContain('407.823,53')
   expect(formatInvoiceCurrency(summary.ivaAmount)).toContain('77.486,47')
 })
 it.each([false,true])('conserva bases, descuentos e IVA del response, editor=%s', edited => {
   const source = document()
   const before = structuredClone(source)
   const drafts = buildPurchaseInvoiceItemDrafts(source, [account], [], [iva])
   const totals = calculatePurchaseInvoiceItemLineTotals(drafts, source.total)
   expect(totals).toEqual(fixture.invoice_lines.map(l => roundMoney(Number(l.line_extension_amount)+Number(l.tax_totals[0].tax_amount))))
   expect(drafts[0].unitValue).toBe(39900)
   expect(drafts[0].discount).toBe(3990)
   expect(purchaseInvoiceItemDraftBase(drafts[0])).toBe(30176.47)
   const sent = buildSiigoPurchaseSendRequest(source, account, {id:1,name:'Contado',type:'Contado'}, [], null, '2026-08-23', undefined, undefined, null, edited ? drafts : undefined)
   expect(sent.items).toHaveLength(12)
   sent.items.forEach((item,i)=>{
     expect(item.code).toBe('5105')
     expect(item.taxes).toEqual([{id:19}])
     expect(sent.tax_included).toBe(true)
     expect(item.price).toBe(Number(fixture.invoice_lines[i].price_amount))
     expect(item.discount ?? 0).toBe(source.items![i].discount ?? 0)
     expect(roundMoney((item.quantity*item.price-(item.discount??0))/1.19)).toBe(Number(fixture.invoice_lines[i].line_extension_amount))
   })
   expect(sent.payments[0].value).toBe(485310)
   expect(source).toEqual(before)
 })
 it('reconstruye la conversión al abrir un borrador guardado',()=>{
   const source=document()
   const initial=buildPurchaseInvoiceItemDrafts(source,[account],[],[iva])
   const saved=initial.map(i=>({...i,ivaTaxId:19,retefuenteTaxId:null}))
   const restored=buildPurchaseInvoiceItemDraftsFromDraft(saved,[iva],[],null,source)
   expect(purchaseInvoiceItemDraftBase(restored[0])).toBe(30176.47)
   expect(calculatePurchaseInvoiceItemLineTotals(restored,source.total)).toEqual(calculatePurchaseInvoiceItemLineTotals(initial,source.total))
 })
 it('convierte por línea aunque otra sea exenta o traiga precios base con IVA 5%',()=>{
   const source=document()
   const iva5={id:5,name:'IVA 5%',type:'IVA',percentage:5}
   source.items=[source.items![0],{description:'Exento',quantity:1,unitValue:100,total:100,discount:0,ivaPercentage:0,suggestedTax:null},{description:'Base 5%',quantity:1,unitValue:100,total:90,discount:10,ivaPercentage:5,suggestedTax:iva5}]
   source.documentSubtotal=30366.47; source.documentIva=5738.03; source.total=36104.5
   const drafts=buildPurchaseInvoiceItemDrafts(source,[account],[],[iva,iva5])
   const sent=buildSiigoPurchaseSendRequest(source,account,{id:1,name:'Contado',type:'Contado'},[],null,'2026-08-23',undefined,undefined,null,drafts)
   expect(sent.items.map(i=>i.taxes)).toEqual([[{id:19}],undefined,[{id:5}]])
   expect(sent.items[1].price).toBe(100); expect(sent.items[2].price).toBe(100); expect(sent.items[2].discount).toBe(10)
   expect(sent.payments[0].value).toBe(36104.5)
 })
})
