import type { DocumentSourceType } from './documentSource'
import type { ImportRowStatus } from './import'
import type { InvoicePreview } from './invoice'
import type { ValidateSiigoImportResponse } from './siigo'
import type { XmlImportSummary } from './xmlInvoice'

export interface UserImportInput {
  accountCode: string | null
}

export interface SiigoSessionData {
  validation: ValidateSiigoImportResponse | null
  supplierConfigurationId: string | null
  supplierDocument: string | null
  supplierName: string | null
  accountCode: string | null
  autoApply: boolean
  providerId: string | null
}

export interface ImportSession {
  documentId: string | null
  sourceType: DocumentSourceType
  summary: XmlImportSummary | null
  preview: InvoicePreview
  siigo: SiigoSessionData
  userInput: UserImportInput
  stepStatus: ImportRowStatus
}

export interface ImportSessionsState {
  byDocumentId: Record<string, ImportSession>
}

export function createEmptyUserImportInput(): UserImportInput {
  return {
    accountCode: null,
  }
}

export function createEmptySiigoSessionData(): SiigoSessionData {
  return {
    validation: null,
    supplierConfigurationId: null,
    supplierDocument: null,
    supplierName: null,
    accountCode: null,
    autoApply: false,
    providerId: null,
  }
}

export function mapSiigoResponseToSessionData(
  response: ValidateSiigoImportResponse,
): SiigoSessionData {
  return {
    validation: response,
    supplierConfigurationId: response.supplierConfigurationId,
    supplierDocument: response.supplierDocument,
    supplierName: response.supplierName,
    accountCode: response.accountCode,
    autoApply: response.autoApply,
    providerId: null,
  }
}
