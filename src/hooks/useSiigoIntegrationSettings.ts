import { useCallback, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  saveSiigoCredentials,
  syncSiigoSuppliers,
} from '../services/siigoService'
import type { SaveSiigoCredentialsResponse } from '../types/siigo'
import { formatBalanceTrialSuccessMessage } from '../utils/formatBalanceTrialSuccess'
import { formatSiigoCredentialsSuccessMessage } from '../utils/formatSiigoCredentialsSuccess'

export function useSiigoIntegrationSettings() {
  const { user, isLoading: isAuthLoading } = useAuth()
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
      partnerId,
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
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          'No se pudieron actualizar los proveedores desde SIIGO.',
        ),
      )
    } finally {
      setIsSyncingSuppliers(false)
    }
  }, [clearMessages, isSyncingSuppliers, user?.company])

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
    errorMessage,
    setUsername,
    setAccessKey,
    setPartnerId,
    handleSaveCredentials,
    handleSyncSuppliers,
  }
}
