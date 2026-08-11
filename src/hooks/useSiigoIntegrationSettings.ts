import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchSiigoCredentialsStatus,
  saveSiigoCredentials,
  syncSiigoSuppliers,
} from '../services/siigoService'
import type {
  SaveSiigoCredentialsResponse,
  SiigoSubscriptionStatus,
} from '../types/siigo'
import {
  formatBalanceTrialSuccessMessage,
  BALANCE_TRIAL_IMPORT_ERROR_MESSAGE,
} from '../utils/formatBalanceTrialSuccess'
import { formatSiigoCredentialsSuccessMessage } from '../utils/formatSiigoCredentialsSuccess'

export function useSiigoIntegrationSettings() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    markConfigured,
    refreshSetupStatus,
    isCheckingSetup,
    isSiigoConfigured,
    hasSiigoAccounts,
    isSupportDocumentEnabled,
    isSubscriptionActive,
    hasSupportDocumentAccess,
    includedDocumentTypes,
  } = useIntegrationSetup()
  const showSetupRequiredNotice =
    !isCheckingSetup && (!isSiigoConfigured || !hasSiigoAccounts)
  const [username, setUsername] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [isSavingCredentials, setIsSavingCredentials] = useState(false)
  const [isSyncingSuppliers, setIsSyncingSuppliers] = useState(false)
  const [credentialsSuccessMessage, setCredentialsSuccessMessage] = useState<
    string | null
  >(null)
  const [suppliersSuccessMessage, setSuppliersSuccessMessage] = useState<
    string | null
  >(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subscription, setSubscription] =
    useState<SiigoSubscriptionStatus | null>(null)

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
      } catch {
        // El estado global de SIIGO lo resuelve IntegrationSetupContext.
      }
    })()
  }, [markConfigured, user?.company?.id])

  const clearMessages = useCallback(() => {
    setErrorMessage(null)
    setCredentialsSuccessMessage(null)
    setSuppliersSuccessMessage(null)
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

  const isBusy = isAuthLoading || isSavingCredentials || isSyncingSuppliers
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

  return {
    isAuthLoading,
    hasCompany: Boolean(user?.company),
    username,
    accessKey,
    partnerId,
    isSavingCredentials,
    isSyncingSuppliers,
    isBusy,
    credentialsSuccessMessage,
    suppliersSuccessMessage,
    showSetupRequiredNotice,
    isSiigoConfigured,
    hasSiigoAccounts,
    isSupportDocumentEnabled,
    isSubscriptionActive,
    hasSupportDocumentAccess,
    includedDocumentTypes,
    subscription,
    canSaveCredentials,
    canSyncSuppliers,
    errorMessage,
    setUsername,
    setAccessKey,
    setPartnerId,
    handleSaveCredentials,
    handleSyncSuppliers,
  }
}
