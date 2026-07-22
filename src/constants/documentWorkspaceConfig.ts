import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { supportDocumentExcelSource } from '../services/documentSources/supportDocumentExcelSource'
import { xmlDocumentSource } from '../services/documentSources/xmlDocumentSource'
import { downloadSupportDocumentTemplate } from '../services/supportDocumentService'
import {
  createSiigoPurchaseSend,
  createSiigoSupportDocument,
} from '../services/siigoService'
import {
  ELECTRONIC_DOCUMENT_TYPE,
  type ElectronicDocumentType,
} from '../types/electronicDocument'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type {
  CreateSiigoPurchaseSendRequest,
  CreateSiigoSupportDocumentRequest,
} from '../types/siigo'
import { isParseXmlResponse } from '../types/xmlInvoice'
import {
  PURCHASE_INVOICE_RETENTION_CATALOG_TYPES,
  PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
  SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES,
} from '../constants/siigoTaxCatalog'
import {
  buildSiigoPurchaseSendRequest,
  buildSiigoSupportDocumentRequest,
} from '../utils/buildSiigoDocumentRequest'
import { EXCEL_FILE_INPUT, isExcelFile, isXmlFile, XML_AND_EXCEL_FILE_INPUT } from '../utils/fileType'
import { validateSupportDocumentExcelDates } from '../utils/validateSupportDocumentExcel'

export interface DocumentWorkspaceImportResult {
  documentIds: string[]
  documentCount: number
}

export interface DocumentWorkspaceConfig {
  key: 'supportDocument' | 'purchaseInvoice'
  routePath: string
  electronicDocumentType: ElectronicDocumentType
  paymentDocumentType: string
  retentionCatalogTypes: readonly string[]
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
  downloadTemplate?: () => Promise<void>
  importFile: (file: File) => Promise<DocumentWorkspaceImportResult>
  buildSendRequest: (
    document: ElectronicDocumentListItem,
    account: SiigoAccountOption,
    paymentMethod: SiigoPaymentMethodOption,
    retentions: SiigoTaxOption[],
    costCenter: SiigoCostCenterOption | null,
    selectedDate: string,
    observations?: string,
    savePreferences?: boolean,
  ) => CreateSiigoSupportDocumentRequest | CreateSiigoPurchaseSendRequest
  sendToSiigo: (
    request: CreateSiigoSupportDocumentRequest | CreateSiigoPurchaseSendRequest,
  ) => Promise<unknown>
  sendSuccessFeedback: (sentCount: number, failedCount: number) => string
}

async function importSupportDocumentExcel(
  file: File,
): Promise<DocumentWorkspaceImportResult> {
  await validateSupportDocumentExcelDates(file)

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

async function importPurchaseInvoiceFile(
  file: File,
): Promise<DocumentWorkspaceImportResult> {
  if (isXmlFile(file)) {
    const { rawResponse } = await xmlDocumentSource.upload(file, {
      electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
    })

    if (!isParseXmlResponse(rawResponse) || !rawResponse.id) {
      throw new Error('No se pudo procesar la respuesta del archivo XML.')
    }

    return {
      documentIds: [rawResponse.id],
      documentCount: 1,
    }
  }

  if (isExcelFile(file)) {
    throw new Error(
      'Para factura de compra cargue un XML de factura electrónica de la DIAN.',
    )
  }

  throw new Error('Solo se permiten archivos XML (.xml) para factura de compra.')
}

export const SUPPORT_DOCUMENT_WORKSPACE: DocumentWorkspaceConfig = {
  key: 'supportDocument',
  routePath: '/documento-soporte',
  electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
  paymentDocumentType: SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  retentionCatalogTypes: SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES,
  pageTitle: 'Documento Soporte',
  pageDescription:
    'Descarga la plantilla Excel, completa tus datos e impórtalos aquí.',
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
  downloadTemplate: downloadSupportDocumentTemplate,
  importFile: importSupportDocumentExcel,
  buildSendRequest: buildSiigoSupportDocumentRequest,
  sendToSiigo: (request) => createSiigoSupportDocument(request as CreateSiigoSupportDocumentRequest),
  sendSuccessFeedback: (sentCount, failedCount) =>
    failedCount > 0
      ? `${sentCount} documento(s) enviados. ${failedCount} fallaron.`
      : `${sentCount} documento(s) enviados correctamente a SIIGO.`,
}

export const PURCHASE_INVOICE_WORKSPACE: DocumentWorkspaceConfig = {
  key: 'purchaseInvoice',
  routePath: '/factura-compra',
  electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
  paymentDocumentType: PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
  retentionCatalogTypes: PURCHASE_INVOICE_RETENTION_CATALOG_TYPES,
  pageTitle: 'Factura de compra',
  pageDescription:
    'Carga un XML de factura electrónica de la DIAN, configura cuenta, pago y retenciones, y envíala a SIIGO.',
  loadDocumentsError: 'No se pudieron cargar las facturas de compra.',
  templateDownloadError: 'No se pudo descargar la plantilla.',
  importFileError: 'No se pudo importar el archivo.',
  sendProcessingLabel: 'Enviando factura de compra a SIIGO...',
  importButtonLabel: 'Importar XML',
  importingButtonLabel: 'Importando...',
  templateButtonLabel: 'Descargar plantilla',
  downloadingTemplateLabel: 'Descargando...',
  fileInputAccept: XML_AND_EXCEL_FILE_INPUT,
  showTemplateDownload: false,
  importFile: importPurchaseInvoiceFile,
  buildSendRequest: buildSiigoPurchaseSendRequest,
  sendToSiigo: (request) => createSiigoPurchaseSend(request as CreateSiigoPurchaseSendRequest),
  sendSuccessFeedback: (sentCount, failedCount) =>
    failedCount > 0
      ? `${sentCount} factura(s) enviadas. ${failedCount} fallaron.`
      : `${sentCount} factura(s) enviadas correctamente a SIIGO.`,
}
