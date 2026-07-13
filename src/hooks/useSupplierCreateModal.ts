import { useCallback, useRef, useState } from 'react'
import type { CreatedSiigoSupplier } from '../types/siigo'
import { getApiErrorMessage } from '../services/apiClient'
import { createSiigoSupplier } from '../services/siigoService'

export type SupplierModalView = 'confirm' | 'loading' | 'success' | 'error'

export interface SupplierModalState {
  isOpen: boolean
  documentId: string
  supplierName: string | null
  supplierDocument: string
  view: SupplierModalView
  errorMessage: string | null
  createdSupplier: CreatedSiigoSupplier | null
}

const initialModalState: SupplierModalState = {
  isOpen: false,
  documentId: '',
  supplierName: null,
  supplierDocument: '',
  view: 'confirm',
  errorMessage: null,
  createdSupplier: null,
}

function normalizeDocumentId(documentId: string | null | undefined): string {
  return documentId?.trim() ?? ''
}

export function useSupplierCreateModal() {
  const activeDocumentIdRef = useRef('')
  const [modalState, setModalState] = useState<SupplierModalState>(
    initialModalState,
  )

  const openSupplierNotFoundModal = useCallback(
    (params: {
      documentId: string
      supplierName: string | null
      supplierDocument: string
    }) => {
      const documentId = normalizeDocumentId(params.documentId)

      activeDocumentIdRef.current = documentId

      setModalState({
        isOpen: true,
        documentId,
        supplierName: params.supplierName,
        supplierDocument: params.supplierDocument,
        view: 'confirm',
        errorMessage: null,
        createdSupplier: null,
      })
    },
    [],
  )

  const closeModal = useCallback(() => {
    activeDocumentIdRef.current = ''
    setModalState(initialModalState)
  }, [])

  const createSupplier = useCallback(async (documentIdOverride?: string) => {
    const documentId = normalizeDocumentId(
      documentIdOverride || activeDocumentIdRef.current,
    )

    if (!documentId) {
      setModalState((current) => ({
        ...current,
        view: 'error',
        errorMessage: 'No se encontró el documentId para crear el proveedor.',
      }))
      return
    }

    activeDocumentIdRef.current = documentId

    setModalState((current) => ({
      ...current,
      documentId,
      view: 'loading',
      errorMessage: null,
    }))

    const payload = { documentId }

    console.log('[Supplier Modal] ANTES — crear proveedor:', payload)

    try {
      const response = await createSiigoSupplier(payload)

      console.log('[Supplier Modal] DESPUÉS — proveedor creado:', response)

      setModalState((current) => ({
        ...current,
        documentId,
        view: 'success',
        errorMessage: null,
        createdSupplier: response.supplier,
      }))
    } catch (error) {
      console.error('[Supplier Modal] DESPUÉS — falló la creación:', error)

      setModalState((current) => ({
        ...current,
        documentId,
        view: 'error',
        errorMessage: getApiErrorMessage(
          error,
          'No se pudo crear el proveedor en SIIGO.',
        ),
      }))
    }
  }, [])

  const retryCreateSupplier = useCallback(() => {
    void createSupplier(activeDocumentIdRef.current)
  }, [createSupplier])

  return {
    modalState,
    openSupplierNotFoundModal,
    closeModal,
    createSupplier,
    retryCreateSupplier,
  }
}
