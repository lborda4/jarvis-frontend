import type { ElectronicDocumentType } from './electronicDocument'

export type ImportDocumentType = 'invoice' | 'supportDocument'

export type ImportIntegration = 'siigo'

export interface ImportModuleProps {
  title: string
  description: string
  electronicDocumentType: ElectronicDocumentType
  integration?: ImportIntegration
}

export interface ImportHistoryProps {
  title: string
  electronicDocumentType: ElectronicDocumentType
}
