import axios from 'axios'

function collectErrorPayloadParts(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return ''
  }

  const data = error.response?.data

  if (typeof data === 'string') {
    return data.toLowerCase()
  }

  if (typeof data !== 'object' || data === null) {
    return ''
  }

  return JSON.stringify(data).toLowerCase()
}

export function isSiigoDuplicatedDocumentError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data

    if (typeof data === 'object' && data !== null) {
      const code = 'code' in data ? String(data.code ?? '') : ''

      if (code.toLowerCase() === 'duplicated_document') {
        return true
      }
    }
  }

  const payload = collectErrorPayloadParts(error)

  return (
    payload.includes('duplicated_document') ||
    payload.includes('duplicate requests') ||
    payload.includes('duplicate request') ||
    payload.includes('the document already exists')
  )
}
