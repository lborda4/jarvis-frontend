import type { ImportRowStatus } from './import'

export type SupportDocumentAction =
  | 'supplier_missing'
  | 'processing'
  | 'send'
  | 'delete'
  | 'none'
  | 'empty'

export interface SuggestedAccount {
  code: string
  name: string
  uses: number
}

export interface SupportDocumentRow {
  id: string
  supplierName: string
  supplierNit: string
  documentCode: string
  siigoDocumentNumber: string | number | null
  supplierExistsInSiigo: boolean
  suggestedAccount: SuggestedAccount | null
  importStatus: ImportRowStatus
  action: SupportDocumentAction
  createdAt: string
}

export interface SupportDocumentImportNotice {
  documentCount: number
  documentIds: string[]
}

/** Aviso tras un lote de envío a SIIGO — igual que
 * SupportDocumentImportNotice (mismo mecanismo de "solo esta tanda" vs "ver
 * todos", ver showSendOnly en SupportDocumentPage.tsx), pero con el
 * desglose de éxito/error del envío en vez de solo el total importado. */
export interface SupportDocumentSendNotice {
  documentIds: string[]
  successCount: number
  errorCount: number
}
