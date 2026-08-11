import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { supportDocumentExcelSource } from '../services/documentSources/supportDocumentExcelSource'
import { purchaseInvoiceExcelSource } from '../services/documentSources/purchaseInvoiceExcelSource'
import { downloadSupportDocumentTemplate } from '../services/supportDocumentService'
import {
  createSiigoPurchaseSend,
  createSiigoSupportDocument,
} from '../services/siigoService'
import {
  createJarvisSupportDocument,
  type CreateJarvisSupportDocumentRequest,
} from '../services/jarvisService'
import {
  ELECTRONIC_DOCUMENT_TYPE,
  type ElectronicDocumentType,
} from '../types/electronicDocument'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type {
  CreateSiigoPurchaseSendRequest,
  CreateSiigoSupportDocumentRequest,
} from '../types/siigo'
import {
  PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
  PURCHASE_INVOICE_RETENTION_CATALOG_TYPES,
  SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES,
} from '../constants/siigoTaxCatalog'
import {
  buildSiigoPurchaseSendRequest,
  buildSiigoSupportDocumentRequest,
} from '../utils/buildSiigoDocumentRequest'
import { EXCEL_FILE_INPUT } from '../utils/fileType'
import { validateSupportDocumentExcelDates } from '../utils/validateSupportDocumentExcel'
import { getTodayLocalDate } from '../utils/supportDocumentDate'
import { isCreditPaymentMethod } from '../utils/siigoPaymentMethods'

const JARVIS_PAYMENT_FORM_CASH = 1
const JARVIS_PAYMENT_FORM_CREDIT = 2

export interface DocumentWorkspaceImportResult {
  documentIds: string[]
  documentCount: number
}

export type DocumentWorkspaceProvider = 'SIIGO' | 'JARVIS'

export interface DocumentWorkspaceConfig {
  key: 'supportDocument' | 'purchaseInvoice'
  provider: DocumentWorkspaceProvider
  routePath: string
  electronicDocumentType: ElectronicDocumentType
  paymentDocumentType: string
  retentionCatalogTypes: readonly string[]
  requiresAccount: boolean
  requiresPaymentMethod: boolean
  pageTitle: string
  pageDescription: string
  loadDocumentsError: string
  templateDownloadError: string
  importFileError: string
  sendProcessingLabel: string
  importButtonLabel: string
  importingButtonLabel: string
  templateButtonLabel: string
  downloadingTemplateLabel: string
  fileInputAccept: string
  showTemplateDownload: boolean
  supplierMissingLabel: string
  downloadTemplate?: () => Promise<void>
  importFile: (file: File) => Promise<DocumentWorkspaceImportResult>
  buildSendRequest: (
    document: ElectronicDocumentListItem,
    account: SiigoAccountOption | null,
    paymentMethod: SiigoPaymentMethodOption | null,
    retentions: SiigoTaxOption[],
    costCenter: SiigoCostCenterOption | null,
    selectedDate: string,
    dueDate?: string,
    observations?: string,
    savePreferences?: boolean,
  ) =>
    | CreateSiigoSupportDocumentRequest
    | CreateSiigoPurchaseSendRequest
    | CreateJarvisSupportDocumentRequest
  sendDocument: (
    request:
      | CreateSiigoSupportDocumentRequest
      | CreateSiigoPurchaseSendRequest
      | CreateJarvisSupportDocumentRequest,
  ) => Promise<unknown>
  sendSuccessFeedback: (sentCount: number, failedCount: number) => string
}

async function importSupportDocumentExcel(
  file: File,
  options?: { enforceDateRange?: boolean },
): Promise<DocumentWorkspaceImportResult> {
  await validateSupportDocumentExcelDates(file, {
    enforceDateRange: options?.enforceDateRange !== false,
  })

  const { rawResponse } = await supportDocumentExcelSource.upload(file, {
    electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
  })
  const response = rawResponse as {
    documentsCreated?: number
    documentIds?: string[]
  }

  const documentIds = response.documentIds ?? []
  const documentCount = response.documentsCreated ?? documentIds.length

  return { documentIds, documentCount }
}

function buildJarvisSupportDocumentRequest(
  document: ElectronicDocumentListItem,
  _account: SiigoAccountOption | null,
  paymentMethod: SiigoPaymentMethodOption | null,
  retentions: SiigoTaxOption[],
  _costCenter: SiigoCostCenterOption | null,
  selectedDate: string,
  dueDate?: string,
  observations?: string,
): CreateJarvisSupportDocumentRequest {
  const documentDate =
    selectedDate.trim() ||
    document.issueDate?.trim() ||
    getTodayLocalDate()
  const resolvedObservations =
    observations?.trim() || document.observations?.trim() || undefined
  const isCredit = isCreditPaymentMethod(paymentMethod)
  const resolvedDueDate =
    isCredit && dueDate?.trim() ? dueDate.trim() : documentDate

  return {
    documentId: document.id,
    date: documentDate,
    ...(resolvedObservations ? { observations: resolvedObservations } : {}),
    ...(retentions.length > 0
      ? {
          retentions: retentions.map((tax) => ({
            id: tax.id,
            type: tax.type,
            percentage: tax.percentage,
          })),
        }
      : {}),
    ...(paymentMethod
      ? {
          payment: {
            id: paymentMethod.id,
            payment_form_id: isCredit
              ? JARVIS_PAYMENT_FORM_CREDIT
              : JARVIS_PAYMENT_FORM_CASH,
            due_date: resolvedDueDate,
          },
        }
      : {}),
  }
}

export const SUPPORT_DOCUMENT_WORKSPACE: DocumentWorkspaceConfig = {
  key: 'supportDocument',
  provider: 'SIIGO',
  routePath: '/documento-soporte',
  electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
  paymentDocumentType: SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  retentionCatalogTypes: SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES,
  requiresAccount: true,
  requiresPaymentMethod: true,
  pageTitle: 'Documento Soporte',
  pageDescription:
    '',
  loadDocumentsError: 'No se pudieron cargar los documentos soporte.',
  templateDownloadError:
    'No se pudo descargar la plantilla de Documento soporte.',
  importFileError: 'No se pudo importar el archivo Excel.',
  sendProcessingLabel: 'Enviando documento soporte a SIIGO...',
  importButtonLabel: 'Importar Excel',
  importingButtonLabel: 'Importando...',
  templateButtonLabel: 'Descargar plantilla',
  downloadingTemplateLabel: 'Descargando...',
  fileInputAccept: EXCEL_FILE_INPUT,
  showTemplateDownload: true,
  supplierMissingLabel: 'Crear tercero',
  downloadTemplate: () => downloadSupportDocumentTemplate('SIIGO'),
  importFile: importSupportDocumentExcel,
  buildSendRequest: (
    document,
    account,
    paymentMethod,
    retentions,
    costCenter,
    selectedDate,
    dueDate,
    observations,
    savePreferences,
  ) =>
    buildSiigoSupportDocumentRequest(
      document,
      account!,
      paymentMethod!,
      retentions,
      costCenter,
      selectedDate,
      dueDate,
      observations,
      savePreferences,
    ),
  sendDocument: (request) =>
    createSiigoSupportDocument(request as CreateSiigoSupportDocumentRequest),
  sendSuccessFeedback: (sentCount, failedCount) =>
    failedCount > 0
      ? `${sentCount} documento(s) enviados. ${failedCount} fallaron.`
      : `${sentCount} documento(s) enviados correctamente a SIIGO.`,
}

export const JARVIS_SUPPORT_DOCUMENT_WORKSPACE: DocumentWorkspaceConfig = {
  key: 'supportDocument',
  provider: 'JARVIS',
  routePath: '/documento-soporte',
  electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
  paymentDocumentType: SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  retentionCatalogTypes: ['ReteRenta', 'ReteICA', 'ReteIVA'],
  requiresAccount: false,
  requiresPaymentMethod: false,
  pageTitle: 'Documento Soporte',
  pageDescription:
    'Descarga la plantilla Excel, completa tus datos e impórtalos aquí. Usa fechas en formato día/mes/año (ej. 10/06/2026). Luego envíalos a DIAN vía Jarvis.',
  loadDocumentsError: 'No se pudieron cargar los documentos soporte.',
  templateDownloadError:
    'No se pudo descargar la plantilla de Documento soporte.',
  importFileError: 'No se pudo importar el archivo Excel.',
  sendProcessingLabel: 'Enviando documento soporte a DIAN...',
  importButtonLabel: 'Importar Excel',
  importingButtonLabel: 'Importando...',
  templateButtonLabel: 'Descargar plantilla',
  downloadingTemplateLabel: 'Descargando...',
  fileInputAccept: EXCEL_FILE_INPUT,
  showTemplateDownload: true,
  supplierMissingLabel: 'Crear tercero',
  downloadTemplate: () => downloadSupportDocumentTemplate('JARVIS'),
  importFile: (file) =>
    importSupportDocumentExcel(file, { enforceDateRange: false }),
  buildSendRequest: buildJarvisSupportDocumentRequest,
  sendDocument: (request) =>
    createJarvisSupportDocument(request as CreateJarvisSupportDocumentRequest),
  sendSuccessFeedback: (sentCount, failedCount) =>
    failedCount > 0
      ? `${sentCount} documento(s) enviados. ${failedCount} fallaron.`
      : `${sentCount} documento(s) enviados correctamente a DIAN.`,
}

async function importPurchaseInvoiceExcel(
  file: File,
): Promise<DocumentWorkspaceImportResult> {
  const { rawResponse } = await purchaseInvoiceExcelSource.upload(file, {
    electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
  })
  const response = rawResponse as {
    documentsCreated?: number
    documentIds?: string[]
  }

  const documentIds = response.documentIds ?? []
  const documentCount = response.documentsCreated ?? documentIds.length

  return { documentIds, documentCount }
}

export const PURCHASE_INVOICE_WORKSPACE: DocumentWorkspaceConfig = {
  key: 'purchaseInvoice',
  provider: 'SIIGO',
  routePath: '/factura-compra',
  electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
  paymentDocumentType: PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
  retentionCatalogTypes: PURCHASE_INVOICE_RETENTION_CATALOG_TYPES,
  requiresAccount: true,
  requiresPaymentMethod: true,
  pageTitle: 'Factura de compra',
  pageDescription:
    'Sube el Excel descargado de la DIAN. Solo se importan filas con Tipo de documento “Factura electrónica” y Grupo “Recibido”.',
  loadDocumentsError: 'No se pudieron cargar las facturas de compra.',
  templateDownloadError: '',
  importFileError: 'No se pudo importar el Excel de la DIAN.',
  sendProcessingLabel: 'Enviando factura de compra a SIIGO...',
  importButtonLabel: 'Importar Excel DIAN',
  importingButtonLabel: 'Importando...',
  templateButtonLabel: '',
  downloadingTemplateLabel: '',
  fileInputAccept: EXCEL_FILE_INPUT,
  showTemplateDownload: false,
  supplierMissingLabel: 'Crear tercero',
  importFile: importPurchaseInvoiceExcel,
  buildSendRequest: (
    document,
    account,
    paymentMethod,
    retentions,
    costCenter,
    selectedDate,
    dueDate,
    observations,
    savePreferences,
  ) =>
    buildSiigoPurchaseSendRequest(
      document,
      account!,
      paymentMethod!,
      retentions,
      costCenter,
      selectedDate,
      dueDate,
      observations,
      savePreferences,
    ),
  sendDocument: (request) =>
    createSiigoPurchaseSend(request as CreateSiigoPurchaseSendRequest),
  sendSuccessFeedback: (sentCount, failedCount) =>
    failedCount > 0
      ? `${sentCount} factura(s) enviadas. ${failedCount} fallaron.`
      : `${sentCount} factura(s) enviadas correctamente a SIIGO.`,
}

export const JARVIS_PURCHASE_INVOICE_WORKSPACE: DocumentWorkspaceConfig = {
  key: 'purchaseInvoice',
  provider: 'JARVIS',
  routePath: '/factura-compra',
  electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
  paymentDocumentType: PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
  retentionCatalogTypes: ['ReteRenta', 'ReteICA', 'ReteIVA'],
  requiresAccount: false,
  requiresPaymentMethod: false,
  pageTitle: 'Factura de compra',
  pageDescription:
    'Sube el Excel descargado de la DIAN. Solo se importan filas con Tipo de documento “Factura electrónica” y Grupo “Recibido”.',
  loadDocumentsError: 'No se pudieron cargar las facturas de compra.',
  templateDownloadError: '',
  importFileError: 'No se pudo importar el Excel de la DIAN.',
  sendProcessingLabel: 'Procesando factura de compra...',
  importButtonLabel: 'Importar Excel DIAN',
  importingButtonLabel: 'Importando...',
  templateButtonLabel: '',
  downloadingTemplateLabel: '',
  fileInputAccept: EXCEL_FILE_INPUT,
  showTemplateDownload: false,
  supplierMissingLabel: 'Crear tercero',
  importFile: importPurchaseInvoiceExcel,
  buildSendRequest: buildJarvisSupportDocumentRequest,
  sendDocument: async () => {
    throw new Error(
      'El envío de factura de compra desde Jarvis estará disponible pronto.',
    )
  },
  sendSuccessFeedback: (sentCount, failedCount) =>
    failedCount > 0
      ? `${sentCount} factura(s) procesadas. ${failedCount} fallaron.`
      : `${sentCount} factura(s) procesadas correctamente.`,
}

