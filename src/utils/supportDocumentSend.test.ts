import { describe, expect, it } from 'vitest'
import { buildNotSendableReason, canSendDocument } from './supportDocumentSend'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import { createEmptyPurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import { IMPORT_ROW_STATUS } from '../types/import'

function buildItem(
  overrides: Partial<PurchaseInvoiceItemDraft> = {},
): PurchaseInvoiceItemDraft {
  return { ...createEmptyPurchaseInvoiceItemDraft(), ...overrides }
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
    supplierName: 'Proveedor SAS',
    supplierNit: '900685902',
    documentSubtotal: 100000,
    documentIva: 19000,
    total: 119000,
    status: 'ACCOUNT_REQUIRED',
    supplierExistsInSiigo: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

const ACCOUNT = { code: '5135', description: 'Cuenta' }
const PAYMENT_METHOD = { id: 1, name: 'Contado', type: 'Contado' }
const CREDIT_PAYMENT_METHOD = {
  id: 2,
  name: 'Crédito',
  type: 'CREDIT',
  dueDate: true,
}

describe('buildNotSendableReason', () => {
  it('devuelve null (se puede enviar) cuando todo está resuelto', () => {
    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': ACCOUNT },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
    )

    expect(reason).toBeNull()
  })

  it('da una razón específica cuando falta la cuenta contable (caso real reportado: seleccionar 5 y solo enviar 3 sin explicación)', () => {
    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': null },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
    )

    expect(reason).toBe('Falta asignar la cuenta contable.')
  })

  it('da una razón específica cuando falta el medio de pago', () => {
    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': ACCOUNT },
      { 'doc-1': null },
      { 'doc-1': null },
    )

    expect(reason).toBe('Falta asignar el medio de pago.')
  })

  it('da una razón específica cuando el medio de pago es a crédito sin fecha de vencimiento', () => {
    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': ACCOUNT },
      { 'doc-1': CREDIT_PAYMENT_METHOD },
      { 'doc-1': null },
    )

    expect(reason).toBe(
      'El medio de pago es a crédito y falta la fecha de vencimiento.',
    )
  })

  it('da una razón específica cuando el proveedor no existe en SIIGO', () => {
    const reason = buildNotSendableReason(
      buildDocument({ supplierExistsInSiigo: false }),
      'doc-1',
      IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR,
      { 'doc-1': ACCOUNT },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
    )

    expect(reason).toBe('El proveedor no existe en SIIGO todavía.')
  })

  it('da una razón específica cuando el documento ya fue enviado', () => {
    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.LISTA,
      { 'doc-1': ACCOUNT },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
    )

    expect(reason).toBe('El documento ya fue enviado.')
  })

  it('se puede enviar sin cuenta a nivel de documento si TODOS los ítems editados ya traen su propio código (caso real reportado: cuenta asignada a mano por ítem, "Enviar" seguía deshabilitado)', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '5115' }),
      buildItem({ tipo: 'Account', producto: '5115' }),
    ]

    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': null },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
      { 'doc-1': items },
    )

    expect(reason).toBeNull()
  })

  it('sigue faltando la cuenta si algún ítem editado se dejó sin código', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '5115' }),
      buildItem({ tipo: 'Account', producto: '' }),
    ]

    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': null },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
      { 'doc-1': items },
    )

    expect(reason).toBe('Falta asignar la cuenta contable.')
  })

  it('un ítem tipo Product/FixedAsset no necesita cuenta contable propia', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Product', producto: 'SKU-1' }),
    ]

    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': null },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
      { 'doc-1': items },
    )

    expect(reason).toBeNull()
  })

  it('canSendDocument sigue siendo equivalente a "buildNotSendableReason === null"', () => {
    const document = buildDocument()
    const args = [
      document,
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': null },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
    ] as const

    expect(canSendDocument(...args)).toBe(false)
    expect(buildNotSendableReason(...args)).not.toBeNull()
  })
})
