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
  /** Filas que reusaron un documento ya existente (mismo CUFE de un import
   * anterior) en vez de crear uno nuevo — el banner lo muestra aparte para
   * que "documentCount" bajo no se lea como si algo hubiera fallado. */
  documentsReused?: number
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
