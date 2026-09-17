import { describe, expect, it } from 'vitest'
import { getSupportDocumentActionFromImportStatus } from './mapImportRowStatus'
import { IMPORT_ROW_STATUS } from '../types/import'

describe('getSupportDocumentActionFromImportStatus', () => {
  it('ERROR cae a "send" para poder reintentar el envío (caso real pedido: un documento soporte en error no tenía forma de reintentarse)', () => {
    expect(getSupportDocumentActionFromImportStatus(IMPORT_ROW_STATUS.ERROR)).toBe(
      'send',
    )
  })

  it('LISTA (enviado y confirmado) ya no ofrece "delete" — muestra "Completado" (caso real pedido: sin botón de eliminar)', () => {
    expect(getSupportDocumentActionFromImportStatus(IMPORT_ROW_STATUS.LISTA)).toBe(
      'none',
    )
  })

  it('EXISTENTE_EN_SIIGO sigue sin botón de eliminar (celda vacía)', () => {
    expect(
      getSupportDocumentActionFromImportStatus(
        IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO,
      ),
    ).toBe('empty')
  })

  it('REQUIERE_PROVEEDOR pide crear el tercero', () => {
    expect(
      getSupportDocumentActionFromImportStatus(
        IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR,
      ),
    ).toBe('supplier_missing')
  })

  it('EN_PROCESO muestra el estado de procesamiento', () => {
    expect(
      getSupportDocumentActionFromImportStatus(IMPORT_ROW_STATUS.EN_PROCESO),
    ).toBe('processing')
  })

  it('PENDIENTE y REQUIERE_REVISION ofrecen "send" (aún no enviados)', () => {
    expect(
      getSupportDocumentActionFromImportStatus(IMPORT_ROW_STATUS.PENDIENTE),
    ).toBe('send')
    expect(
      getSupportDocumentActionFromImportStatus(
        IMPORT_ROW_STATUS.REQUIERE_REVISION,
      ),
    ).toBe('send')
  })
})
