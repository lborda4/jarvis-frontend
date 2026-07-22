import { useCallback, useRef, useState } from 'react'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoCreatedPurchase } from '../types/siigo'
import { getApiErrorMessage } from '../services/apiClient'
import { createSiigoPurchase, saveAccountMapping } from '../services/siigoService'

export type AccountMappingModalView =
  | 'select'
  | 'saving_account'
  | 'creating_purchase'
  | 'purchase_success'
  | 'error'

export type AccountMappingErrorPhase = 'account' | 'purchase'

export interface AccountMappingModalState {
  isOpen: boolean
  documentId: string
  view: AccountMappingModalView
  selectedAccount: SiigoAccountOption | null
  accountSaved: boolean
  savedAccountCode: string | null
  createdPurchase: SiigoCreatedPurchase | null
  errorMessage: string | null
  errorPhase: AccountMappingErrorPhase | null
}

interface UseAccountMappingModalOptions {
  onAccountSaved?: (params: {
    documentId: string
    accountCode: string
  }) => void
  onPurchaseCreated?: (params: {
    documentId: string
    purchase: SiigoCreatedPurchase
  }) => void
  onPurchaseFailed?: (params: { documentId: string }) => void
}

const initialModalState: AccountMappingModalState = {
  isOpen: false,
  documentId: '',
  view: 'select',
  selectedAccount: null,
  accountSaved: false,
  savedAccountCode: null,
  createdPurchase: null,
  errorMessage: null,
  errorPhase: null,
}

function normalizeDocumentId(documentId: string | null | undefined): string {
  return documentId?.trim() ?? ''
}

export function useAccountMappingModal(
  options: UseAccountMappingModalOptions = {},
) {
  const { onAccountSaved, onPurchaseCreated, onPurchaseFailed } = options
  const activeDocumentIdRef = useRef('')
  const modalStateRef = useRef(initialModalState)

  const [modalState, setModalState] = useState<AccountMappingModalState>(
    initialModalState,
  )

  modalStateRef.current = modalState

  const openAccountMappingModal = useCallback((params: { documentId: string }) => {
    const documentId = normalizeDocumentId(params.documentId)

    activeDocumentIdRef.current = documentId

    setModalState({
      isOpen: true,
      documentId,
      view: 'select',
      selectedAccount: null,
      accountSaved: false,
      savedAccountCode: null,
      createdPurchase: null,
      errorMessage: null,
      errorPhase: null,
    })
  }, [])

  const closeModal = useCallback(() => {
    activeDocumentIdRef.current = ''
    setModalState(initialModalState)
  }, [])

  const selectAccount = useCallback((account: SiigoAccountOption | null) => {
    setModalState((current) => ({
      ...current,
      selectedAccount: account,
      errorMessage: null,
    }))
  }, [])

  const createPurchase = useCallback(
    async (documentIdOverride?: string) => {
      const documentId = normalizeDocumentId(
        documentIdOverride || activeDocumentIdRef.current,
      )

      if (!documentId) {
        setModalState((current) => ({
          ...current,
          view: 'error',
          errorPhase: 'purchase',
          errorMessage: 'No se encontró el documentId para crear la factura.',
        }))
        return
      }

      activeDocumentIdRef.current = documentId

      setModalState((current) => ({
        ...current,
        documentId,
        view: 'creating_purchase',
        errorMessage: null,
        errorPhase: null,
      }))

      try {
        const response = await createSiigoPurchase({ documentId })

        onPurchaseCreated?.({
          documentId,
          purchase: response.purchase,
        })

        setModalState((current) => ({
          ...current,
          documentId,
          view: 'purchase_success',
          createdPurchase: response.purchase,
        }))
      } catch (error) {
        onPurchaseFailed?.({ documentId })

        setModalState((current) => ({
          ...current,
          documentId,
          view: 'error',
          errorPhase: 'purchase',
          errorMessage: getApiErrorMessage(
            error,
            'No se pudo crear la factura de compra en SIIGO.',
          ),
        }))
      }
    },
    [onPurchaseCreated, onPurchaseFailed],
  )

  const saveAccount = useCallback(
    async (documentIdOverride?: string) => {
      const currentState = modalStateRef.current
      const documentId = normalizeDocumentId(
        documentIdOverride ||
          activeDocumentIdRef.current ||
          currentState.documentId,
      )
      const selectedAccount = currentState.selectedAccount

      if (!selectedAccount) {
        setModalState((current) => ({
          ...current,
          errorMessage: 'Seleccione una cuenta contable para continuar.',
        }))
        return
      }

      if (!documentId) {
        setModalState((current) => ({
          ...current,
          view: 'error',
          errorPhase: 'account',
          errorMessage: 'No se encontró el documentId para guardar la cuenta.',
        }))
        return
      }

      activeDocumentIdRef.current = documentId

      setModalState((current) => ({
        ...current,
        documentId,
        view: 'saving_account',
        errorMessage: null,
        errorPhase: null,
      }))

      const payload = {
        documentId,
        accountCode: selectedAccount.code,
        accountDescription: selectedAccount.description,
      }

      try {
        await saveAccountMapping(payload)

        onAccountSaved?.({
          documentId,
          accountCode: selectedAccount.code,
        })

        setModalState((current) => ({
          ...current,
          documentId,
          accountSaved: true,
          savedAccountCode: selectedAccount.code,
        }))

        await createPurchase(documentId)
      } catch (error) {
        setModalState((current) => ({
          ...current,
          documentId,
          view: 'error',
          errorPhase: 'account',
          errorMessage: getApiErrorMessage(
            error,
            'No se pudo asociar la cuenta contable al proveedor.',
          ),
        }))
      }
    },
    [createPurchase, onAccountSaved],
  )

  const retrySaveAccount = useCallback(async () => {
    const documentId = normalizeDocumentId(activeDocumentIdRef.current)
    const accountSaved = modalStateRef.current.accountSaved

    if (accountSaved) {
      await createPurchase(documentId)
      return
    }

    setModalState((current) => ({
      ...current,
      view: 'select',
      errorMessage: null,
      errorPhase: null,
    }))
  }, [createPurchase])

  return {
    modalState,
    openAccountMappingModal,
    closeModal,
    selectAccount,
    saveAccount,
    retrySaveAccount,
  }
}
