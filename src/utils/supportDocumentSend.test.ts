import { describe, expect, it } from 'vitest'
import {
  buildNotSendableReason,
  canSendDocument,
  isDocumentDeletable,
  isDocumentDeletableFromSiigo,
  isDocumentRemovableFromDatabase,
  needsPurchaseInvoiceReview,
} from './supportDocumentSend'
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

  it('un ítem tipo Product SIN código bloquea el envío aunque haya cuenta a nivel de documento (caso real: producto nuevo sin código SIIGO conocido, ej. "cremallera azul")', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Product', producto: '' }),
    ]

    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': ACCOUNT },
      { 'doc-1': PAYMENT_METHOD },
      { 'doc-1': null },
      { 'doc-1': items },
    )

    expect(reason).toBe(
      'Hay un ítem de producto sin código asignado — requiere revisión.',
    )
  })

  it('se puede enviar de nuevo una vez que el usuario completa el código de producto que faltaba', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Product', producto: 'PROD-NUEVO' }),
    ]

    const reason = buildNotSendableReason(
      buildDocument(),
      'doc-1',
      IMPORT_ROW_STATUS.PENDIENTE,
      { 'doc-1': ACCOUNT },
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

describe('needsPurchaseInvoiceReview', () => {
  const REQUIRES_BOTH = { requiresAccount: true, requiresPaymentMethod: true }

  it('caso real D1 SAS: ítems tipo Cuenta sin resolver Y sin cuenta de respaldo a nivel de documento — requiere revisión, no es solo "Pendiente"', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '' }),
      buildItem({ tipo: 'Account', producto: '' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': null },
        { 'doc-1': PAYMENT_METHOD },
        { 'doc-1': items },
        REQUIRES_BOTH,
      ),
    ).toBe(true)
  })

  it('no requiere revisión si hay una cuenta de respaldo a nivel de documento (la IA/historial sí encontraron algo)', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': ACCOUNT },
        { 'doc-1': PAYMENT_METHOD },
        { 'doc-1': items },
        REQUIRES_BOTH,
      ),
    ).toBe(false)
  })

  it('no requiere revisión si cada ítem Cuenta ya trae su propio código, aunque no haya cuenta de respaldo', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '5115' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': null },
        { 'doc-1': PAYMENT_METHOD },
        { 'doc-1': items },
        REQUIRES_BOTH,
      ),
    ).toBe(false)
  })

  it('un ítem Producto sin código SIEMPRE requiere revisión, aunque haya cuenta de respaldo a nivel de documento', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Product', producto: '' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': ACCOUNT },
        { 'doc-1': PAYMENT_METHOD },
        { 'doc-1': items },
        REQUIRES_BOTH,
      ),
    ).toBe(true)
  })

  it('false cuando el workspace no requiere cuenta ni medio de pago (ej. Jarvis)', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': null },
        { 'doc-1': null },
        { 'doc-1': items },
        { requiresAccount: false, requiresPaymentMethod: false },
      ),
    ).toBe(false)
  })

  it('caso real reportado: cuenta ya resuelta (por IA) pero medio de pago sin resolver — igual requiere revisión, no se puede enviar vacío', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '51952503' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': ACCOUNT },
        { 'doc-1': null },
        { 'doc-1': items },
        REQUIRES_BOTH,
      ),
    ).toBe(true)
  })

  it('no requiere revisión por medio de pago si el workspace no lo exige', () => {
    const items: PurchaseInvoiceItemDraft[] = [
      buildItem({ tipo: 'Account', producto: '51952503' }),
    ]

    expect(
      needsPurchaseInvoiceReview(
        'doc-1',
        { 'doc-1': ACCOUNT },
        { 'doc-1': null },
        { 'doc-1': items },
        { requiresAccount: true, requiresPaymentMethod: false },
      ),
    ).toBe(false)
  })
})

describe('borrado — EXISTENTE EN SIIGO no se puede eliminar (caso real pedido: la factura ya existía en SIIGO antes del import, no debe poder borrarse ni de la BD ni de SIIGO)', () => {
  it('isDocumentRemovableFromDatabase es false para EXISTENTE EN SIIGO', () => {
    expect(
      isDocumentRemovableFromDatabase(IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO),
    ).toBe(false)
  })

  it('isDocumentDeletableFromSiigo es false para EXISTENTE EN SIIGO', () => {
    expect(
      isDocumentDeletableFromSiigo(
        IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO,
        'SIIGO',
      ),
    ).toBe(false)
  })

  it('isDocumentDeletable (BD + SIIGO combinados) es false para EXISTENTE EN SIIGO', () => {
    expect(
      isDocumentDeletable(IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO, 'SIIGO'),
    ).toBe(false)
  })

  it('LISTA (enviada de verdad desde Jarvis) sigue siendo eliminable en SIIGO, a diferencia de EXISTENTE EN SIIGO', () => {
    expect(isDocumentDeletable(IMPORT_ROW_STATUS.LISTA, 'SIIGO')).toBe(true)
    expect(
      isDocumentDeletableFromSiigo(IMPORT_ROW_STATUS.LISTA, 'SIIGO'),
    ).toBe(true)
  })

  it('PENDIENTE sigue siendo eliminable de la BD (nunca se envió a SIIGO)', () => {
    expect(isDocumentDeletable(IMPORT_ROW_STATUS.PENDIENTE, 'SIIGO')).toBe(
      true,
    )
  })
})
