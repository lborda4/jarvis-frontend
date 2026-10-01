import { describe, it, expect } from 'vitest'
import { jarvisTaxTechnical, calculateJarvisRetention } from './jarvisTaxTechnical'
import { buildSalesInvoiceTaxOptions } from './salesInvoiceTaxes'
import type { JarvisTax } from '../types/jarvis'
describe('Catálogo por empresa y factores técnicos', () => {
 it('ReteICA mantiene la tarifa por mil y su factor',()=>{
   expect(jarvisTaxTechnical({tax_type:'ReteICA',rate:4.14,code:'401'})).toMatchObject({divisor:1000,unit:'x 1.000',factor:0.00414})
   expect(calculateJarvisRetention('ReteICA',4.14,100000,19000)).toBe(414)
 })
 it('ReteIVA usa el impuesto como base',()=>expect(calculateJarvisRetention('ReteIVA',15,100000,19000)).toBe(2850))
 it('Retefuente usa el subtotal',()=>expect(calculateJarvisRetention('Retefuente',2.5,100000,19000)).toBe(2500))
 it('conserva IVA exento, excluido y no gravado como opciones diferentes',()=>{
   const taxes=['103','104','105'].map(code=>({id:code,code,name:code,rate:0,tax_type:'IVA',category:'IMPUESTO',is_active:true}) as JarvisTax)
   expect(buildSalesInvoiceTaxOptions(taxes,[]).map(tax=>tax.savedId)).toEqual(['103','104','105'])
   expect(taxes.map(tax=>jarvisTaxTechnical(tax).note)).toEqual(['Operación exenta','Operación excluida','Operación no gravada'])
 })
 it('desactivar todos no agrega impuestos sintéticos del catálogo externo',()=>{
   expect(buildSalesInvoiceTaxOptions([], [{id:6,name:'ReteRenta'}])).toEqual([])
 })
})
