import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { DocumentSourceType } from '../types/documentSource'
import { DOCUMENT_SOURCE_TYPE } from '../types/documentSource'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import {
  createEmptySiigoSessionData,
  createEmptyUserImportInput,
  mapSiigoResponseToSessionData,
  type ImportSession,
  type ImportSessionsState,
  type SiigoSessionData,
  type UserImportInput,
} from '../types/importSession'
import type { InvoicePreview } from '../types/invoice'
import type { ValidateSiigoImportResponse } from '../types/siigo'
import type { ParseXmlResponse } from '../types/xmlInvoice'
import { normalizeXmlImportSummary } from '../types/xmlInvoice'
import { mapXmlSummaryToInvoicePreview } from '../utils/mapXmlSummaryToPreview'
import { normalizeInvoicePreview } from '../utils/normalizeInvoicesResponse'

type ImportSessionAction =
  | { type: 'CLEAR_ALL' }
  | { type: 'REGISTER_XML'; payload: ParseXmlResponse }
  | {
      type: 'REGISTER_EXCEL_RECORDS'
      payload: { records: InvoicePreview[] }
    }
  | {
      type: 'UPDATE_SESSION'
      payload: {
        documentId: string
        patch: Partial<
          Pick<
            ImportSession,
            'stepStatus' | 'userInput' | 'summary' | 'documentId'
          >
        > & {
          siigo?: Partial<SiigoSessionData>
        }
      }
    }
  | {
      type: 'UPDATE_SIIGO_FROM_RESPONSE'
      payload: {
        documentId: string
        response: ValidateSiigoImportResponse
        stepStatus: ImportRowStatus
      }
    }

interface ImportSessionContextValue {
  sessions: ImportSessionsState
  getSession: (documentId: string) => ImportSession | undefined
  registerXmlImport: (response: ParseXmlResponse) => void
  registerExcelImports: (records: InvoicePreview[]) => void
  updateSession: (
    documentId: string,
    patch: Partial<
      Pick<
        ImportSession,
        'stepStatus' | 'userInput' | 'summary' | 'documentId'
      >
    > & {
      siigo?: Partial<SiigoSessionData>
    },
  ) => void
  updateSiigoFromResponse: (
    documentId: string,
    response: ValidateSiigoImportResponse,
    stepStatus: ImportRowStatus,
  ) => void
  clearSessions: () => void
}

const ImportSessionContext = createContext<ImportSessionContextValue | null>(
  null,
)

const initialState: ImportSessionsState = {
  byDocumentId: {},
}

function createSession(
  sourceType: DocumentSourceType,
  preview: InvoicePreview,
  options: {
    documentId?: string | null
    summary?: ImportSession['summary']
  } = {},
): ImportSession {
  return {
    documentId: options.documentId ?? null,
    sourceType,
    summary: options.summary ?? null,
    preview,
    siigo: createEmptySiigoSessionData(),
    userInput: createEmptyUserImportInput(),
    stepStatus: IMPORT_ROW_STATUS.PENDIENTE,
  }
}

function importSessionReducer(
  state: ImportSessionsState,
  action: ImportSessionAction,
): ImportSessionsState {
  switch (action.type) {
    case 'CLEAR_ALL':
      return initialState

    case 'REGISTER_XML': {
      const { payload } = action
      if (!payload.summary || !payload.id) return state

      const documentId = payload.id.trim()
      const summary = normalizeXmlImportSummary(payload.summary)
      const preview = normalizeInvoicePreview(
        mapXmlSummaryToInvoicePreview(summary, documentId),
        0,
      )

      return {
        byDocumentId: {
          ...state.byDocumentId,
          [documentId]: createSession(
            DOCUMENT_SOURCE_TYPE.XML,
            preview,
            { documentId, summary },
          ),
        },
      }
    }

    case 'REGISTER_EXCEL_RECORDS': {
      const nextByDocumentId = { ...state.byDocumentId }

      action.payload.records.forEach((record, index) => {
        const preview = normalizeInvoicePreview(record, index)
        const documentId =
          preview.documentType === 'Documento soporte'
            ? preview.cufe.trim() || null
            : null

        nextByDocumentId[preview.cufe] = createSession(
          DOCUMENT_SOURCE_TYPE.EXCEL,
          preview,
          { documentId },
        )
      })

      return { byDocumentId: nextByDocumentId }
    }

    case 'UPDATE_SESSION': {
      const current = state.byDocumentId[action.payload.documentId]
      if (!current) return state

      return {
        byDocumentId: {
          ...state.byDocumentId,
          [action.payload.documentId]: {
            ...current,
            ...action.payload.patch,
            siigo: action.payload.patch.siigo
              ? { ...current.siigo, ...action.payload.patch.siigo }
              : current.siigo,
            userInput: action.payload.patch.userInput
              ? { ...current.userInput, ...action.payload.patch.userInput }
              : current.userInput,
          },
        },
      }
    }

    case 'UPDATE_SIIGO_FROM_RESPONSE': {
      const current = state.byDocumentId[action.payload.documentId]
      if (!current) return state

      const siigo = mapSiigoResponseToSessionData(action.payload.response)

      return {
        byDocumentId: {
          ...state.byDocumentId,
          [action.payload.documentId]: {
            ...current,
            stepStatus: action.payload.stepStatus,
            siigo,
          },
        },
      }
    }

    default:
      return state
  }
}

export function ImportSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, dispatch] = useReducer(importSessionReducer, initialState)

  const getSession = useCallback(
    (documentId: string) => sessions.byDocumentId[documentId],
    [sessions.byDocumentId],
  )

  const registerXmlImport = useCallback((response: ParseXmlResponse) => {
    dispatch({ type: 'REGISTER_XML', payload: response })
  }, [])

  const registerExcelImports = useCallback((records: InvoicePreview[]) => {
    dispatch({ type: 'REGISTER_EXCEL_RECORDS', payload: { records } })
  }, [])

  const updateSession = useCallback(
    (
      documentId: string,
      patch: Partial<
        Pick<
          ImportSession,
          'stepStatus' | 'userInput' | 'summary' | 'documentId'
        >
      > & {
        siigo?: Partial<SiigoSessionData>
      },
    ) => {
      dispatch({ type: 'UPDATE_SESSION', payload: { documentId, patch } })
    },
    [],
  )

  const updateSiigoFromResponse = useCallback(
    (
      documentId: string,
      response: ValidateSiigoImportResponse,
      stepStatus: ImportRowStatus,
    ) => {
      dispatch({
        type: 'UPDATE_SIIGO_FROM_RESPONSE',
        payload: { documentId, response, stepStatus },
      })
    },
    [],
  )

  const clearSessions = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  const value = useMemo(
    () => ({
      sessions,
      getSession,
      registerXmlImport,
      registerExcelImports,
      updateSession,
      updateSiigoFromResponse,
      clearSessions,
    }),
    [
      sessions,
      getSession,
      registerXmlImport,
      registerExcelImports,
      updateSession,
      updateSiigoFromResponse,
      clearSessions,
    ],
  )

  return (
    <ImportSessionContext.Provider value={value}>
      {children}
    </ImportSessionContext.Provider>
  )
}

export function useImportSession(): ImportSessionContextValue {
  const context = useContext(ImportSessionContext)

  if (!context) {
    throw new Error(
      'useImportSession debe usarse dentro de ImportSessionProvider',
    )
  }

  return context
}

export type { SiigoSessionData, UserImportInput }
