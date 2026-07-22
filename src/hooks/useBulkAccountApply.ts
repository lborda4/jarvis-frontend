import { useCallback, useState } from 'react'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import { getApiErrorMessage } from '../services/apiClient'
import { saveAccountMapping } from '../services/siigoService'
import {
  ELECTRONIC_DOCUMENT_STATUS,
  type ElectronicDocumentListItem,
} from '../types/electronicDocument'

const ACCOUNT_PENDING_STATUSES = new Set<string>([
  ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_REQUIRED,
  ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPING_REQUIRED,
])

function isAccountPending(document: ElectronicDocumentListItem): boolean {
  return (
    ACCOUNT_PENDING_STATUSES.has(document.status) ||
    document.processingStatus === 'ACCOUNT_REQUIRED'
  )
}

export function useBulkAccountApply(onCompleted: () => void) {
  const [selectedAccount, setSelectedAccount] = useState<SiigoAccountOption | null>(
    null,
  )
  const [isApplying, setIsApplying] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const applyAccount = useCallback(
    async (
      visibleDocuments: ElectronicDocumentListItem[],
      selectedDocumentIds: Set<string>,
    ) => {
      if (!selectedAccount) {
        setErrorMessage('Seleccione una cuenta contable para continuar.')
        return
      }

      const targets = visibleDocuments.filter(
        (document) =>
          selectedDocumentIds.has(document.id) && isAccountPending(document),
      )

      if (targets.length === 0) {
        setErrorMessage('Seleccione al menos un documento pendiente de cuenta.')
        return
      }

      setIsApplying(true)
      setErrorMessage(null)
      setFeedbackMessage(null)

      let appliedCount = 0
      let failedCount = 0
      let lastError: string | null = null

      for (const document of targets) {
        try {
          await saveAccountMapping({
            documentId: document.id,
            accountCode: selectedAccount.code,
            accountDescription: selectedAccount.description,
          })
          appliedCount += 1
        } catch (error) {
          failedCount += 1
          lastError = getApiErrorMessage(
            error,
            'No se pudo aplicar la cuenta contable.',
          )
        }
      }

      setIsApplying(false)

      if (appliedCount > 0) {
        setFeedbackMessage(
          failedCount > 0
            ? `Cuenta aplicada en ${appliedCount} documento(s). ${failedCount} fallaron.`
            : `Cuenta aplicada en ${appliedCount} documento(s).`,
        )
        onCompleted()
      }

      if (failedCount > 0 && appliedCount === 0) {
        setErrorMessage(
          lastError ?? 'No se pudo aplicar la cuenta en los documentos seleccionados.',
        )
      }
    },
    [onCompleted, selectedAccount],
  )

  return {
    selectedAccount,
    setSelectedAccount,
    isApplying,
    feedbackMessage,
    errorMessage,
    applyAccount,
  }
}
