import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchSiigoCredentialsStatus,
  fetchSiigoDocumentTypes,
  runSiigoPurchaseHistorySyncToCompletion,
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

export type SiigoSetupStepId = 'credentials' | 'accounts' | 'document_types'

export interface SiigoSetupStep {
  id: SiigoSetupStepId
  label: string
  description: string
}

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
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [activeStepId, setActiveStepId] = useState<SiigoSetupStepId | null>(
    'credentials',
  )

  const steps = useMemo<SiigoSetupStep[]>(() => {
    const nextSteps: SiigoSetupStep[] = [
      {
        id: 'credentials',
        label: 'Credenciales',
        description: 'Acceso a la API de SIIGO',
      },
      {
        id: 'accounts',
        label: 'Cuentas contables',
        description: 'Sincronizar desde el Balance de Prueba',
      },
    ]

    if (needsDocumentTypesStep) {
      nextSteps.push({
        id: 'document_types',
        label: 'Comprobantes de cargue',
        description: 'Elegir comprobante por tipo de documento',
      })
    }

    return nextSteps
  }, [needsDocumentTypesStep])

  const isStepComplete = useCallback(
    (stepId: SiigoSetupStepId) => {
      if (stepId === 'credentials') return isSiigoConfigured
      if (stepId === 'accounts') return hasSiigoAccounts
      return hasSiigoDocumentTypesConfigured
    },
    [hasSiigoAccounts, hasSiigoDocumentTypesConfigured, isSiigoConfigured],
  )

  const isStepUnlocked = useCallback(
    (stepId: SiigoSetupStepId) => {
      const index = steps.findIndex((step) => step.id === stepId)
      if (index <= 0) return true

      return steps.slice(0, index).every((step) => isStepComplete(step.id))
    },
    [isStepComplete, steps],
  )

  const goToNextStep = useCallback(
    (fromStepId: SiigoSetupStepId) => {
      const currentIndex = steps.findIndex((step) => step.id === fromStepId)
      const nextStep = steps[currentIndex + 1]
      setActiveStepId(nextStep?.id ?? null)
    },
    [steps],
  )

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
      } finally {
        setStatusLoaded(true)
      }
    })()
  }, [markConfigured, user?.company?.id])

  useEffect(() => {
    if (!statusLoaded || steps.length === 0) {
      return
    }

    const allComplete = steps.every((step) => isStepComplete(step.id))
    if (allComplete) {
      setActiveStepId(null)
      return
    }

    const firstIncomplete = steps.find(
      (step) => !isStepComplete(step.id) && isStepUnlocked(step.id),
    )

    if (firstIncomplete) {
      setActiveStepId(firstIncomplete.id)
    }
    // Solo al cargar estado / cambiar el plan visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after status/plan
  }, [statusLoaded, steps])

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
        goToNextStep('credentials')
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
      goToNextStep,
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
      // Cuentas contables (Balance de Prueba) e historial de Factura de
      // compra arrancan juntos y corren de forma independiente — si uno
      // falla, el otro sigue su curso igual — para que el cliente no tenga
      // que esperar dos sincronizaciones separadas (una ahora y otra más
      // adelante al entrar a Factura de compra). Este paso no se da por
      // terminado hasta que ambos terminan. Solo se corre el de facturas si
      // el plan incluye Factura de compra; si ese falla, no bloquea ni
      // ensucia el mensaje de éxito de este paso.
      const [accountsResult] = await Promise.allSettled([
        syncSiigoSuppliers(),
        hasPurchaseInvoiceAccess
          ? runSiigoPurchaseHistorySyncToCompletion()
          : Promise.resolve(null),
      ])

      if (accountsResult.status === 'rejected') {
        throw accountsResult.reason
      }

      const response = accountsResult.value
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
      } else {
        goToNextStep('accounts')
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
    goToNextStep,
    hasPurchaseInvoiceAccess,
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
      goToNextStep('document_types')
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
    goToNextStep,
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

  const allRequiredStepsComplete = steps.every((step) =>
    isStepComplete(step.id),
  )

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
    steps,
    activeStepId,
    setActiveStepId,
    isStepComplete,
    isStepUnlocked,
    allRequiredStepsComplete,
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
