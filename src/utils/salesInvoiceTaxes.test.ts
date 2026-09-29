import { describe, expect, it } from 'vitest'
import type { JarvisTax } from '../types/jarvis'
import {
  buildSalesInvoiceTaxOptions,
  calculateSalesInvoiceTax,
  formatSalesInvoiceTaxLabel,
  requireSalesInvoiceTaxCatalogId,
} from './salesInvoiceTaxes'

function savedTax(overrides: Partial<JarvisTax> = {}): JarvisTax {
  return {
    id: 'tax-uuid', name: 'IVA reducido', category: 'IMPUESTO', code: '1',
    tax_type: 'IVA', rate: 5, is_active: true, is_in_use: false,
    created_at: '', updated_at: '', ...overrides,
  }
}

describe('impuestos de factura de venta', () => {
  it('combina los impuestos activos guardados con IVA 19% aunque no haya catálogo general', () => {
    const options = buildSalesInvoiceTaxOptions([
      savedTax(), savedTax({ id: 'inactive', is_active: false }),
    ], [])
    expect(options.map(formatSalesInvoiceTaxLabel)).toEqual(['IVA reducido (5%)', 'IVA (19%)'])
    expect(options[0]).toMatchObject({ id: 'saved:tax-uuid', catalogId: 1, savedId: 'tax-uuid' })
  })

  it('no duplica IVA 19% cuando ya está guardado y preserva la cuenta local', () => {
    const options = buildSalesInvoiceTaxOptions([savedTax({ name: 'IVA 19%', rate: 19 })], [])
    expect(options).toHaveLength(1)
    expect(options[0].savedId).toBe('tax-uuid')
    expect(formatSalesInvoiceTaxLabel(options[0])).toBe('IVA 19%')
  })

  it('separa cargos y retenciones según la categoría y usa el ID del catálogo al enviar', () => {
    const options = buildSalesInvoiceTaxOptions([
      savedTax({ id: 'ret', category: 'RETENCION', name: 'Servicios', tax_type: 'Retefuente', rate: 4 }),
      savedTax({ id: 'consumo', name: 'Consumo', tax_type: 'INC', rate: 8 }),
    ], [{ id: 6, name: 'ReteRenta' }, { id: 4, name: 'INC' }])
    const retention = options.find((tax) => tax.savedId === 'ret')!
    expect(retention.category).toBe('RETENCION')
    expect(requireSalesInvoiceTaxCatalogId(retention)).toBe(6)
    expect(requireSalesInvoiceTaxCatalogId(options.find((tax) => tax.savedId === 'consumo')!)).toBe(4)
  })

  it.each([['5', 5000], ['19', 19000], ['0', 0], ['2,5', 2500]])(
    'aplica la tarifa %s con un identificador local', (rate, expected) => {
      expect(calculateSalesInvoiceTax(100000, 'saved:uuid', rate)).toBe(expected)
    },
  )

  it('no cobra impuesto sin selección y no envía tipos desconocidos como IVA', () => {
    expect(calculateSalesInvoiceTax(100000, '', '19')).toBe(0)
    const [tax] = buildSalesInvoiceTaxOptions([savedTax({ tax_type: 'Desconocido' })], [])
    expect(() => requireSalesInvoiceTaxCatalogId(tax)).toThrow('no coincide')
  })
})
