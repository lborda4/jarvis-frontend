import type { ImportRowStatus } from './import'

export type SupportDocumentAction = 'supplier_missing' | 'processing' | 'send' | 'none'

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
  siigoDocumentNumber: number | null
  supplierExistsInSiigo: boolean
  suggestedAccount: SuggestedAccount | null
  importStatus: ImportRowStatus
  action: SupportDocumentAction
}

export interface SupportDocumentImportNotice {
  documentCount: number
  documentIds: string[]
}
