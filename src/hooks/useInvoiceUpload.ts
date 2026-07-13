import { useCallback, useState } from 'react'
import { useImportSession } from '../context/ImportSessionContext'
import { uploadDocument, getDocumentSource } from '../services/documentSources'
import { getUploadInvoiceErrorMessage } from '../services/invoiceService'
import { DOCUMENT_SOURCE_TYPE } from '../types/documentSource'
import type { LoadedDocumentInfo } from '../types/documentSource'
import type { ElectronicDocumentType } from '../types/electronicDocument'
import type { ExtractInvoicesResponse } from '../types/invoice'
import { isParseXmlResponse } from '../types/xmlInvoice'
import { detectDocumentSourceType } from '../utils/fileType'

export function useInvoiceUpload(electronicDocumentType: ElectronicDocumentType) {
  const {
    clearSessions,
    registerXmlImport,
    registerExcelImports,
  } = useImportSession()

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [data, setData] = useState<ExtractInvoicesResponse | null>(null)
  const [loadedDocument, setLoadedDocument] = useState<LoadedDocumentInfo | null>(
    null,
  )

  const setValidationError = useCallback((message: string) => {
    setErrorMessage(message)
    setData(null)
    setLoadedDocument(null)
    clearSessions()
  }, [clearSessions])

  const uploadFile = useCallback(
    async (file: File) => {
      const sourceType = detectDocumentSourceType(file)

      if (!sourceType) {
        setValidationError(
          'Solo se permiten archivos Excel (.xlsx, .xls) o XML (.xml).',
        )
        return
      }

      const source = getDocumentSource(sourceType)

      setIsLoading(true)
      setErrorMessage(null)
      setData(null)
      setLoadedDocument(null)
      clearSessions()

      try {
        const { tableData, rawResponse } = await uploadDocument(
          sourceType,
          file,
          { electronicDocumentType },
        )

        if (
          sourceType === DOCUMENT_SOURCE_TYPE.XML &&
          isParseXmlResponse(rawResponse)
        ) {
          registerXmlImport(rawResponse)
        } else {
          registerExcelImports(tableData.records)
        }

        setData(tableData)
        setLoadedDocument({
          fileName: file.name,
          sourceType,
          sourceLabel: source.label,
        })
      } catch (error) {
        setErrorMessage(getUploadInvoiceErrorMessage(error))
      } finally {
        setIsLoading(false)
      }
    },
    [
      clearSessions,
      electronicDocumentType,
      registerExcelImports,
      registerXmlImport,
      setValidationError,
    ],
  )

  return {
    isLoading,
    errorMessage,
    data,
    loadedDocument,
    uploadFile,
    setValidationError,
  }
}
