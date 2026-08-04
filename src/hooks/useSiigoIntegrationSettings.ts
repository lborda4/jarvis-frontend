import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchSiigoCredentialsStatus,
  saveSiigoCredentials,
  syncSiigoSuppliers,
} from '../services/siigoService'
import type { SaveSiigoCredentialsResponse } from '../types/siigo'
import { formatBalanceTrialSuccessMessage, BALANCE_TRIAL_IMPORT_ERROR_MESSAGE } from '../utils/formatBalanceTrialSuccess'
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

  useEffect(() => {
    if (!user?.company?.id) {
      return
    }

    void (async () => {
      try {
        const status = await fetchSiigoCredentialsStatus()

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
        const response: SaveSiigoCredentialsResponse = await saveSiigoCredentials(
          {
            username: username.trim(),
            access_key: accessKey.trim(),
            partner_id: partnerId.trim(),
          },
        )
        setCredentialsSuccessMessage(formatSiigoCredentialsSuccessMessage(response))
        markConfigured()
        await refreshSetupStatus()
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
      accessKey,
      clearMessages,
      isSavingCredentials,
      markConfigured,
      partnerId,
      refreshSetupStatus,
      user?.company,
      username,
    ],
  )

  const handleSyncSuppliers = useCallback(async () => {
    if (isSyncingSuppliers) {
      return
    }

    if (!user?.company) {
      setErrorMessage('No se encontró la empresa asociada a la sesión.')
      setCredentialsSuccessMessage(null)
      setSuppliersSuccessMessage(null)
      return
    }

    setIsSyncingSuppliers(true)
    clearMessages()

    try {
      const response = await syncSiigoSuppliers()
      setSuppliersSuccessMessage(formatBalanceTrialSuccessMessage(response))
      await refreshSetupStatus()
    } catch {
      setErrorMessage(BALANCE_TRIAL_IMPORT_ERROR_MESSAGE)
    } finally {
      setIsSyncingSuppliers(false)
    }
  }, [clearMessages, isSyncingSuppliers, refreshSetupStatus, user?.company])

  const isBusy = isAuthLoading || isSavingCredentials || isSyncingSuppliers

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
    errorMessage,
    setUsername,
    setAccessKey,
    setPartnerId,
    handleSaveCredentials,
    handleSyncSuppliers,
  }
}
