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
  autoApply: boolean
  accountSaved: boolean
  savedAccountCode: string | null
  savedAutoApply: boolean
  createdPurchase: SiigoCreatedPurchase | null
  errorMessage: string | null
  errorPhase: AccountMappingErrorPhase | null
}

interface UseAccountMappingModalOptions {
  onAccountSaved?: (params: {
    documentId: string
    accountCode: string
    autoApply: boolean
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
  autoApply: false,
  accountSaved: false,
  savedAccountCode: null,
  savedAutoApply: false,
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
      autoApply: false,
      accountSaved: false,
      savedAccountCode: null,
      savedAutoApply: false,
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

  const setAutoApply = useCallback((autoApply: boolean) => {
    setModalState((current) => ({
      ...current,
      autoApply,
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

      console.log('[Account Mapping Modal] ANTES — crear factura:', { documentId })

      try {
        const response = await createSiigoPurchase({ documentId })

        console.log('[Account Mapping Modal] DESPUÉS — factura creada:', response)

        onPurchaseCreated?.({
          documentId,
          purchase: response.purchase,
        })

        setModalState((current) => ({
          ...current,
          documentId,
          view: 'purchase_success',
          createdPurchase: response.purchase,
          errorMessage: null,
          errorPhase: null,
        }))
      } catch (error) {
        console.error('[Account Mapping Modal] DESPUÉS — falló la creación:', error)

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
      const autoApply = currentState.autoApply

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
        autoApply,
      }

      console.log('[Account Mapping Modal] ANTES — guardar cuenta:', payload)

      try {
        await saveAccountMapping(payload)

        console.log('[Account Mapping Modal] DESPUÉS — cuenta guardada')

        onAccountSaved?.({
          documentId,
          accountCode: selectedAccount.code,
          autoApply,
        })

        setModalState((current) => ({
          ...current,
          documentId,
          accountSaved: true,
          savedAccountCode: selectedAccount.code,
          savedAutoApply: autoApply,
        }))

        await createPurchase(documentId)
      } catch (error) {
        console.error('[Account Mapping Modal] DESPUÉS — falló el guardado:', error)

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
    setAutoApply,
    saveAccount,
    retrySaveAccount,
  }
}
