import { ELECTRONIC_DOCUMENT_TYPE } from '../types/electronicDocument'
import type { ElectronicDocumentType } from '../types/electronicDocument'
import type { ImportDocumentType } from '../types/importModule'

interface ImportModuleCopy {
  importTitle: string
  importDescription: string
  historyTitle: string
  electronicDocumentType: ElectronicDocumentType
}

export const IMPORT_MODULE_COPY: Record<ImportDocumentType, ImportModuleCopy> = {
  invoice: {
    importTitle: 'Importar facturas a SIIGO',
    importDescription:
      'Carga un archivo Excel de la DIAN o un XML de factura electrónica, selecciona las facturas y presiona Importar a SIIGO.',
    historyTitle: 'Historial de facturas de compra',
    electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
  },
  supportDocument: {
    importTitle: 'Importar documento soporte a SIIGO',
    importDescription:
      'Carga un archivo Excel o un XML de documento soporte, selecciona los registros y presiona Importar a SIIGO.',
    historyTitle: 'Historial de documentos soporte',
    electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
  },
}
