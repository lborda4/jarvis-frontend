import type { ImportRowStatus } from './import'

export type SupportDocumentAction = 'continue_supplier' | 'send' | 'none'

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
  supplierExistsInSiigo: boolean
  suggestedAccount: SuggestedAccount | null
  importStatus: ImportRowStatus
  action: SupportDocumentAction
}

export interface SupportDocumentImportNotice {
  documentCount: number
  documentIds: string[]
}
