import { describe, it, expect } from 'vitest'
import { buildSiigoSupportDocumentRequest } from './buildSiigoSupportDocumentRequest'
import { supportDocumentAccountsFallback } from './supportDocumentItemAccounts'
import { canSendDocument, buildNotSendableReason } from './supportDocumentSend'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { IMPORT_ROW_STATUS } from '../types/import'
const account = { code: '5135', description: 'General' }
const payment = { id: 1, name: 'Contado', type: 'Contado' }
function document() { return { id: 'd', electronicDocumentType: 'SUPPORT_DOCUMENT', supplierNit: '12345678', invoiceNumber: 'DS1', supplierExistsInSiigo: true, status: 'ACCOUNT_MAPPED', items: [
  { description: 'Igual', quantity: 1, unitValue: 100, total: 100, accountMapping: { code: '61601013', description: 'Valoraciones' } },
  { description: 'Igual', quantity: 1, unitValue: 200, total: 200, accountMapping: { code: '513595', description: 'Servicios' } },
] } as ElectronicDocumentListItem }
describe('Cuentas por ítem del documento soporte SIIGO', () => {
  it('envía las cuentas del Excel sin reemplazarlas por la cuenta general', () => {
    const result = buildSiigoSupportDocumentRequest(document(), account, payment, [], null, '2026-10-01')
    expect(result.items.map(i => i.code)).toEqual(['61601013', '513595'])
  })
  it('sin cuenta del Excel mantiene sugerencia por ítem y respaldo general', () => {
    const doc = document()
    doc.items = [{ description: 'A', quantity: 1, unitValue: 100, total: 100, suggestedAccount: { code: '5105', name: 'Sugerida', source: 'fallback' } }, { description: 'B', quantity: 1, unitValue: 100, total: 100 }]
    expect(buildSiigoSupportDocumentRequest(doc, account, payment, [], null, '2026-10-01').items.map(i => i.code)).toEqual(['5105', '5135'])
    expect(supportDocumentAccountsFallback(doc)).toBeNull()
  })
  it('habilita el envío con todas las cuentas resueltas aunque la cuenta general esté vacía', () => {
    const doc = document()
    expect(canSendDocument(doc, 'd', IMPORT_ROW_STATUS.PENDIENTE, {}, { d: payment }, {})).toBe(true)
    expect(buildNotSendableReason(doc, 'd', IMPORT_ROW_STATUS.PENDIENTE, {}, { d: payment }, {})).toBeNull()
  })
  it('no habilita el envío si falta resolver una cuenta', () => {
    const doc = document(); delete doc.items![1].accountMapping
    expect(canSendDocument(doc, 'd', IMPORT_ROW_STATUS.PENDIENTE, {}, { d: payment }, {})).toBe(false)
  })
})
