import { describe, expect, it } from 'vitest'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import {
  buildPurchaseInvoicePeriodWorkbook,
  getCurrentCalendarMonthRange,
  inferExportDisplayPeriodFromDocuments,
  PURCHASE_INVOICE_EXPORT_TABLE_HEADER_ROW,
  resolveExportDisplayPeriod,
  splitInvoiceNumber,
} from './purchaseInvoicePeriodExport'

describe('splitInvoiceNumber', () => {
  it('separa prefijo alfabético y consecutivo numérico', () => {
    expect(splitInvoiceNumber('POSE3254')).toEqual({
      prefix: 'POSE',
      consecutive: '3254',
    })
  })

  it('tolera guiones entre prefijo y número', () => {
    expect(splitInvoiceNumber('FV-1195')).toEqual({
      prefix: 'FV',
      consecutive: '1195',
    })
  })

  it('maneja número sin prefijo y vacío', () => {
    expect(splitInvoiceNumber('990000001')).toEqual({
      prefix: '',
      consecutive: '990000001',
    })
    expect(splitInvoiceNumber(null)).toEqual({
      prefix: '',
      consecutive: '',
    })
  })
})

describe('resolveExportDisplayPeriod', () => {
  const reference = new Date(2026, 8, 15)

  it('mes por defecto cuando no hay filtros en UI', () => {
    expect(
      resolveExportDisplayPeriod({
        issueDateFrom: '2026-09-01',
        issueDateTo: '2026-09-30',
        usedDefaultMonth: true,
        documents: [],
        reference,
      }),
    ).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('usa fechas del filtro cuando el usuario las eligió', () => {
    expect(
      resolveExportDisplayPeriod({
        issueDateFrom: '2026-08-01',
        issueDateTo: '2026-08-15',
        usedDefaultMonth: false,
        documents: [],
        reference,
      }),
    ).toEqual({ from: '2026-08-01', to: '2026-08-15' })
  })

  it('tolera solo desde o solo hasta', () => {
    expect(
      resolveExportDisplayPeriod({
        issueDateFrom: '2026-08-01',
        usedDefaultMonth: false,
        documents: [],
        reference,
      }),
    ).toEqual({ from: '2026-08-01', to: '2026-08-01' })
  })

  it('infiere min/max si solo hay otros filtros', () => {
    const documents = [
      { issueDate: '2026-07-10T00:00:00.000Z' },
      { issueDate: '2026-07-22' },
    ] as ElectronicDocumentListItem[]

    expect(
      resolveExportDisplayPeriod({
        usedDefaultMonth: false,
        documents,
        reference,
      }),
    ).toEqual({ from: '2026-07-10', to: '2026-07-22' })
  })
})

describe('inferExportDisplayPeriodFromDocuments', () => {
  it('ordena fechas para el rango', () => {
    const documents = [
      { issueDate: '2026-03-05' },
      { issueDate: '2026-01-01' },
    ] as ElectronicDocumentListItem[]

    expect(inferExportDisplayPeriodFromDocuments(documents)).toEqual({
      from: '2026-01-01',
      to: '2026-03-05',
    })
  })
})

describe('buildPurchaseInvoicePeriodWorkbook', () => {
  it('incluye autofiltro, merges y fila de encabezados de tabla en fila 6', () => {
    const workbook = buildPurchaseInvoicePeriodWorkbook({
      documents: [],
      company: { name: 'Empresa demo', nit: '900000000' },
      periodFrom: '2026-09-01',
      periodTo: '2026-09-30',
    })

    const sheet = workbook.Sheets['Compras-por-prov']
    expect(sheet['!autofilter']?.ref).toBe('A6:L6')
    expect(sheet['!merges']).toHaveLength(4)
    expect(sheet['!views']?.[0]?.ySplit).toBe(PURCHASE_INVOICE_EXPORT_TABLE_HEADER_ROW)
  })
})

describe('getCurrentCalendarMonthRange', () => {
  it('cubre febrero en año bisiesto', () => {
    expect(getCurrentCalendarMonthRange(new Date(2024, 1, 10))).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    })
  })
})
