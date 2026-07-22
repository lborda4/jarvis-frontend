import {
  DOCUMENT_SOURCE_TYPE,
  type DocumentSourceType,
} from '../types/documentSource'

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'] as const
const XML_EXTENSIONS = ['.xml'] as const

export function isExcelFile(file: File): boolean {
  const fileName = file.name.toLowerCase()

  return EXCEL_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}

export function isXmlFile(file: File): boolean {
  const fileName = file.name.toLowerCase()

  return XML_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}

export function detectDocumentSourceType(
  file: File,
): DocumentSourceType | null {
  const fileName = file.name.toLowerCase()

  if (EXCEL_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
    return DOCUMENT_SOURCE_TYPE.EXCEL
  }

  if (XML_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
    return DOCUMENT_SOURCE_TYPE.XML
  }

  return null
}

export const EXCEL_FILE_EXTENSIONS = [...EXCEL_EXTENSIONS] as const

export const EXCEL_FILE_INPUT =
  '.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const ACCEPTED_FILE_EXTENSIONS = [
  ...EXCEL_EXTENSIONS,
  ...XML_EXTENSIONS,
] as const

export const ACCEPTED_FILE_INPUT =
  '.xlsx,.xls,.xml,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/xml,text/xml'

export const XML_AND_EXCEL_FILE_INPUT = ACCEPTED_FILE_INPUT
