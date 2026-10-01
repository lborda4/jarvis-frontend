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
  it('combina impuestos activos de la empresa con las tarifas predeterminadas', () => {
    const options = buildSalesInvoiceTaxOptions([
      savedTax(), savedTax({ id: 'inactive', is_active: false }),
    ], [])
    expect(options.map(formatSalesInvoiceTaxLabel)).toEqual(['IVA reducido (5%)', 'IVA | 0%', 'IVA | 19%'])
    expect(options.some(tax => tax.savedId === 'inactive')).toBe(false)
    expect(options[0]).toMatchObject({ id: 'saved:tax-uuid', catalogId: 1, savedId: 'tax-uuid' })
  })

  it('no duplica IVA 19% cuando ya está guardado y preserva la cuenta local', () => {
    const options = buildSalesInvoiceTaxOptions([savedTax({ name: 'IVA 19%', rate: 19 })], [])
    expect(options.filter(tax => tax.percentage === 19 && tax.type === 'IVA')).toHaveLength(1)
    expect(options[0].savedId).toBe('tax-uuid')
    expect(formatSalesInvoiceTaxLabel(options[0])).toBe('IVA 19% · tarifa 19%')
  })

  it('ofrece las 24 tarifas solicitadas y conserva el ID maestro y las unidades', () => {
    const options = buildSalesInvoiceTaxOptions([], [
      { id: 1, name: 'IVA' }, { id: 4, name: 'INC' }, { id: 5, name: 'ReteIVA' },
      { id: 6, name: 'ReteRenta' }, { id: 7, name: 'ReteICA' },
    ])
    expect(options).toHaveLength(24)
    expect(options.filter(tax => tax.type === 'Retefuente').map(tax => tax.percentage)).toEqual([1, 2, 2.5, 3.5, 4, 6, 10, 11])
    expect(options.find(tax => tax.type === 'ReteIVA' && tax.percentage === 100)).toMatchObject({ catalogId: 5, category: 'RETENCION' })
    expect(options.find(tax => tax.type === 'INC')).toMatchObject({ catalogId: 4, category: 'IMPUESTO' })
    expect(formatSalesInvoiceTaxLabel(options.find(tax => tax.type === 'ReteICA' && tax.percentage === 7)!)).toBe('ReteICA | 7,00 x 1.000')
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
