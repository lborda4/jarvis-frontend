import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchSiigoCredentialsStatus,
  fetchSiigoDocumentTypes,
  saveSiigoCredentials,
  saveSiigoDocumentTypes,
  syncSiigoSuppliers,
} from '../services/siigoService'
import type {
  SaveSiigoCredentialsResponse,
  SiigoDocumentTypeCatalogItem,
  SiigoSubscriptionStatus,
} from '../types/siigo'
import {
  formatBalanceTrialSuccessMessage,
  BALANCE_TRIAL_IMPORT_ERROR_MESSAGE,
} from '../utils/formatBalanceTrialSuccess'
import { formatSiigoCredentialsSuccessMessage } from '../utils/formatSiigoCredentialsSuccess'

function formatDocumentTypeOptionLabel(
  item: SiigoDocumentTypeCatalogItem,
): string {
  const code = item.code?.trim()
  const name = item.name?.trim()

  if (code && name) {
    return `${code} — ${name}`
  }

  return code || name || `Comprobante ${item.id}`
}

export function useSiigoIntegrationSettings() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    markConfigured,
    refreshSetupStatus,
    isCheckingSetup,
    isSiigoConfigured,
    hasSiigoAccounts,
    hasSiigoDocumentTypesConfigured,
    isSupportDocumentEnabled,
    isPurchaseInvoiceEnabled,
    isSubscriptionActive,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    includedDocumentTypes,
  } = useIntegrationSetup()

  const needsDocumentTypesStep =
    hasSupportDocumentAccess || hasPurchaseInvoiceAccess

  const showSetupRequiredNotice =
    !isCheckingSetup &&
    (!isSiigoConfigured ||
      !hasSiigoAccounts ||
      (needsDocumentTypesStep && !hasSiigoDocumentTypesConfigured))

  const [username, setUsername] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [isSavingCredentials, setIsSavingCredentials] = useState(false)
  const [isSyncingSuppliers, setIsSyncingSuppliers] = useState(false)
  const [isSavingDocumentTypes, setIsSavingDocumentTypes] = useState(false)
  const [isLoadingDocumentTypes, setIsLoadingDocumentTypes] = useState(false)
  const [credentialsSuccessMessage, setCredentialsSuccessMessage] = useState<
    string | null
  >(null)
  const [suppliersSuccessMessage, setSuppliersSuccessMessage] = useState<
    string | null
  >(null)
  const [documentTypesSuccessMessage, setDocumentTypesSuccessMessage] =
    useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subscription, setSubscription] =
    useState<SiigoSubscriptionStatus | null>(null)

  const [supportDocumentTypes, setSupportDocumentTypes] = useState<
    SiigoDocumentTypeCatalogItem[]
  >([])
  const [purchaseDocumentTypes, setPurchaseDocumentTypes] = useState<
    SiigoDocumentTypeCatalogItem[]
  >([])
  const [selectedSupportDocumentTypeId, setSelectedSupportDocumentTypeId] =
    useState('')
  const [selectedPurchaseDocumentTypeId, setSelectedPurchaseDocumentTypeId] =
    useState('')

  useEffect(() => {
    if (!user?.company?.id) {
      return
    }

    void (async () => {
      try {
        const status = await fetchSiigoCredentialsStatus()
        setSubscription(status.subscription ?? null)

        if (status.configured) {
          markConfigured()

          if (status.username) {
            setUsername(status.username)
          }

          if (status.partner_id) {
            setPartnerId(status.partner_id)
          }
        }

        if (status.supportDocumentTypeId) {
          setSelectedSupportDocumentTypeId(String(status.supportDocumentTypeId))
        }

        if (status.purchaseInvoiceTypeId) {
          setSelectedPurchaseDocumentTypeId(
            String(status.purchaseInvoiceTypeId),
          )
        }
      } catch {
        // El estado global de SIIGO lo resuelve IntegrationSetupContext.
      }
    })()
  }, [markConfigured, user?.company?.id])

  useEffect(() => {
    if (!user?.company?.id || !isSiigoConfigured || !needsDocumentTypesStep) {
      return
    }

    let cancelled = false

    void (async () => {
      setIsLoadingDocumentTypes(true)

      try {
        const [supportTypes, purchaseTypes] = await Promise.all([
          hasSupportDocumentAccess
            ? fetchSiigoDocumentTypes('DS')
            : Promise.resolve([]),
          hasPurchaseInvoiceAccess
            ? fetchSiigoDocumentTypes('FC')
            : Promise.resolve([]),
        ])

        if (cancelled) {
          return
        }

        setSupportDocumentTypes(supportTypes)
        setPurchaseDocumentTypes(purchaseTypes)
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getApiErrorMessage(
              error,
              'No se pudieron cargar los comprobantes de SIIGO.',
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDocumentTypes(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    hasPurchaseInvoiceAccess,
    hasSupportDocumentAccess,
    isSiigoConfigured,
    needsDocumentTypesStep,
    user?.company?.id,
  ])

  const clearMessages = useCallback(() => {
    setErrorMessage(null)
    setCredentialsSuccessMessage(null)
    setSuppliersSuccessMessage(null)
    setDocumentTypesSuccessMessage(null)
  }, [])

  const saveCredentialsRequest = useCallback(async () => {
    const response: SaveSiigoCredentialsResponse = await saveSiigoCredentials({
      username: username.trim(),
      access_key: accessKey.trim(),
      partner_id: partnerId.trim(),
    })
    setCredentialsSuccessMessage(formatSiigoCredentialsSuccessMessage(response))
    markConfigured()
    await refreshSetupStatus()
    return response
  }, [
    accessKey,
    markConfigured,
    partnerId,
    refreshSetupStatus,
    username,
  ])

  const handleSaveCredentials = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isSavingCredentials) {
        return
      }

      if (!user?.company) {
        setErrorMessage('No se encontró la empresa asociada a la sesión.')
        setCredentialsSuccessMessage(null)
        setSuppliersSuccessMessage(null)
        return
      }

      setIsSavingCredentials(true)
      clearMessages()

      try {
        await saveCredentialsRequest()
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudieron guardar las credenciales de SIIGO.',
          ),
        )
      } finally {
        setIsSavingCredentials(false)
      }
    },
    [
      clearMessages,
      isSavingCredentials,
      saveCredentialsRequest,
      user?.company,
    ],
  )

  const handleSyncSuppliers = useCallback(async () => {
    if (isSyncingSuppliers || isSavingCredentials) {
      return
    }

    if (!user?.company) {
      setErrorMessage('No se encontró la empresa asociada a la sesión.')
      setCredentialsSuccessMessage(null)
      setSuppliersSuccessMessage(null)
      return
    }

    if (!isSiigoConfigured) {
      setErrorMessage(
        'Primero guarde las credenciales de SIIGO para poder sincronizar las cuentas.',
      )
      return
    }

    setIsSyncingSuppliers(true)
    clearMessages()

    try {
      const response = await syncSiigoSuppliers()
      setSuppliersSuccessMessage(formatBalanceTrialSuccessMessage(response))
      await refreshSetupStatus()

      const status = await fetchSiigoCredentialsStatus({ force: true })
      setSubscription(status.subscription ?? null)

      const accountsSaved =
        response.accountsCreated + response.accountsUpdated > 0 ||
        status.hasAccounts

      if (!accountsSaved) {
        setErrorMessage(
          'La sincronización terminó, pero no se encontraron cuentas contables transaccionales. Verifique el Balance de Prueba en SIIGO.',
        )
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, BALANCE_TRIAL_IMPORT_ERROR_MESSAGE),
      )
    } finally {
      setIsSyncingSuppliers(false)
      setIsSavingCredentials(false)
    }
  }, [
    clearMessages,
    isSavingCredentials,
    isSiigoConfigured,
    isSyncingSuppliers,
    refreshSetupStatus,
    user?.company,
  ])

  const handleSaveDocumentTypes = useCallback(async () => {
    if (isSavingDocumentTypes) {
      return
    }

    if (!user?.company) {
      setErrorMessage('No se encontró la empresa asociada a la sesión.')
      return
    }

    if (!isSiigoConfigured) {
      setErrorMessage(
        'Primero guarde las credenciales de SIIGO para configurar los comprobantes.',
      )
      return
    }

    if (
      hasSupportDocumentAccess &&
      !selectedSupportDocumentTypeId.trim()
    ) {
      setErrorMessage('Seleccione el comprobante de Documento soporte.')
      return
    }

    if (
      hasPurchaseInvoiceAccess &&
      !selectedPurchaseDocumentTypeId.trim()
    ) {
      setErrorMessage('Seleccione el comprobante de Factura de compra.')
      return
    }

    setIsSavingDocumentTypes(true)
    clearMessages()

    try {
      await saveSiigoDocumentTypes({
        ...(hasSupportDocumentAccess
          ? {
              supportDocumentTypeId: Number(selectedSupportDocumentTypeId),
            }
          : {}),
        ...(hasPurchaseInvoiceAccess
          ? {
              purchaseInvoiceTypeId: Number(selectedPurchaseDocumentTypeId),
            }
          : {}),
      })

      setDocumentTypesSuccessMessage(
        'Comprobantes de cargue guardados correctamente.',
      )
      await refreshSetupStatus()

      const status = await fetchSiigoCredentialsStatus({ force: true })
      setSubscription(status.subscription ?? null)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          'No se pudieron guardar los comprobantes de cargue.',
        ),
      )
    } finally {
      setIsSavingDocumentTypes(false)
    }
  }, [
    clearMessages,
    hasPurchaseInvoiceAccess,
    hasSupportDocumentAccess,
    isSavingDocumentTypes,
    isSiigoConfigured,
    refreshSetupStatus,
    selectedPurchaseDocumentTypeId,
    selectedSupportDocumentTypeId,
    user?.company,
  ])

  const isBusy =
    isAuthLoading ||
    isSavingCredentials ||
    isSyncingSuppliers ||
    isSavingDocumentTypes

  const canSaveCredentials =
    Boolean(user?.company) &&
    username.trim().length > 0 &&
    accessKey.trim().length > 0 &&
    partnerId.trim().length > 0 &&
    !isSavingCredentials &&
    !isAuthLoading

  const canSyncSuppliers =
    Boolean(user?.company) &&
    isSiigoConfigured &&
    !isSyncingSuppliers &&
    !isAuthLoading &&
    !isSavingCredentials

  const canSaveDocumentTypes =
    Boolean(user?.company) &&
    isSiigoConfigured &&
    hasSiigoAccounts &&
    !isSavingDocumentTypes &&
    !isLoadingDocumentTypes &&
    !isAuthLoading &&
    (!hasSupportDocumentAccess ||
      selectedSupportDocumentTypeId.trim().length > 0) &&
    (!hasPurchaseInvoiceAccess ||
      selectedPurchaseDocumentTypeId.trim().length > 0)

  return {
    isAuthLoading,
    hasCompany: Boolean(user?.company),
    username,
    accessKey,
    partnerId,
    isSavingCredentials,
    isSyncingSuppliers,
    isSavingDocumentTypes,
    isLoadingDocumentTypes,
    isBusy,
    credentialsSuccessMessage,
    suppliersSuccessMessage,
    documentTypesSuccessMessage,
    showSetupRequiredNotice,
    isSiigoConfigured,
    hasSiigoAccounts,
    hasSiigoDocumentTypesConfigured,
    needsDocumentTypesStep,
    isSupportDocumentEnabled,
    isPurchaseInvoiceEnabled,
    isSubscriptionActive,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    includedDocumentTypes,
    subscription,
    supportDocumentTypes,
    purchaseDocumentTypes,
    selectedSupportDocumentTypeId,
    selectedPurchaseDocumentTypeId,
    canSaveCredentials,
    canSyncSuppliers,
    canSaveDocumentTypes,
    errorMessage,
    formatDocumentTypeOptionLabel,
    setUsername,
    setAccessKey,
    setPartnerId,
    setSelectedSupportDocumentTypeId,
    setSelectedPurchaseDocumentTypeId,
    handleSaveCredentials,
    handleSyncSuppliers,
    handleSaveDocumentTypes,
  }
}
