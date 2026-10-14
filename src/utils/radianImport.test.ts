import { expect, it } from 'vitest'
import { mergeRadianInvoices } from './radianImport'
import type { RadianInvoice } from './radianExcel'

const invoice = (cufe: string, number = 'FV1'): RadianInvoice => ({ cufe, number, supplier: 'Empresa', nit: '123', date: '2026-10-14', valid: true })

it('informa nuevas y repetidas sin reemplazar los datos existentes', () => {
  const original = invoice('a'.repeat(96))
  const result = mergeRadianInvoices([original], [invoice('A'.repeat(96), 'otra'), invoice('b'.repeat(96))])
  expect(result.added).toHaveLength(1)
  expect(result.repeated).toHaveLength(1)
  expect(result.invoices).toHaveLength(2)
  expect(result.invoices[0]).toBe(original)
})

it('cuenta también los CUFE repetidos dentro del mismo archivo', () => {
  const result = mergeRadianInvoices([], [invoice('a'.repeat(96)), invoice('a'.repeat(96))])
  expect(result.added).toHaveLength(1)
  expect(result.repeated).toHaveLength(1)
  expect(result.invoices).toHaveLength(1)
})
