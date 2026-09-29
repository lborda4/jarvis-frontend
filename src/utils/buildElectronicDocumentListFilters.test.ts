import { describe, expect, it } from 'vitest'
import { IMPORT_ROW_STATUS } from '../types/import'
import { EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS } from '../types/supportDocumentTableFilters'
import {
  buildElectronicDocumentListFilters,
  hasUiElectronicDocumentFilters,
} from './buildElectronicDocumentListFilters'

describe('hasUiElectronicDocumentFilters', () => {
  it('detecta proveedor, estado y fechas', () => {
    expect(
      hasUiElectronicDocumentFilters(EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS, [
        '900123',
      ]),
    ).toBe(true)
    expect(
      hasUiElectronicDocumentFilters(
        {
          ...EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
          statuses: [IMPORT_ROW_STATUS.PENDIENTE],
        },
        [],
      ),
    ).toBe(true)
    expect(
      hasUiElectronicDocumentFilters(
        {
          ...EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
          dateFrom: '2026-01-01',
        },
        [],
      ),
    ).toBe(true)
  })

  it('sin filtros en UI', () => {
    expect(
      hasUiElectronicDocumentFilters(EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS, []),
    ).toBe(false)
  })
})

describe('buildElectronicDocumentListFilters', () => {
  const reference = new Date(2026, 8, 15)

  it('listado: sin filtros no impone mes', () => {
    expect(
      buildElectronicDocumentListFilters({
        electronicDocumentType: 'PURCHASE_INVOICE',
        columnFilters: EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
        selectedSupplierNits: [],
        page: 1,
        limit: 100,
      }),
    ).toMatchObject({
      issueDateFrom: undefined,
      issueDateTo: undefined,
      supplierNits: undefined,
      importStatuses: undefined,
    })
  })

  it('export: sin filtros usa mes calendario actual', () => {
    expect(
      buildElectronicDocumentListFilters({
        electronicDocumentType: 'PURCHASE_INVOICE',
        columnFilters: EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
        selectedSupplierNits: [],
        defaultToCurrentMonthWhenUnfiltered: true,
        referenceDate: reference,
      }),
    ).toMatchObject({
      issueDateFrom: '2026-09-01',
      issueDateTo: '2026-09-30',
    })
  })

  it('con proveedor u otro filtro no fuerza el mes', () => {
    expect(
      buildElectronicDocumentListFilters({
        electronicDocumentType: 'PURCHASE_INVOICE',
        columnFilters: EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
        selectedSupplierNits: ['900111'],
        defaultToCurrentMonthWhenUnfiltered: true,
        referenceDate: reference,
      }),
    ).toMatchObject({
      supplierNits: ['900111'],
      issueDateFrom: undefined,
      issueDateTo: undefined,
    })

    expect(
      buildElectronicDocumentListFilters({
        electronicDocumentType: 'PURCHASE_INVOICE',
        columnFilters: {
          ...EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
          statuses: [IMPORT_ROW_STATUS.LISTA],
        },
        selectedSupplierNits: [],
        defaultToCurrentMonthWhenUnfiltered: true,
        referenceDate: reference,
      }),
    ).toMatchObject({
      importStatuses: [IMPORT_ROW_STATUS.LISTA],
      issueDateFrom: undefined,
      issueDateTo: undefined,
    })
  })

  it('respeta rango de fechas del filtro', () => {
    expect(
      buildElectronicDocumentListFilters({
        electronicDocumentType: 'PURCHASE_INVOICE',
        columnFilters: {
          ...EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-15',
        },
        selectedSupplierNits: [],
        defaultToCurrentMonthWhenUnfiltered: true,
        referenceDate: reference,
      }),
    ).toMatchObject({
      issueDateFrom: '2026-08-01',
      issueDateTo: '2026-08-15',
    })
  })
})
