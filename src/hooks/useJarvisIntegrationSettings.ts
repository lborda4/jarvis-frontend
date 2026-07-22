import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchJarvisCredentialsStatus,
  saveJarvisCredentials,
} from '../services/jarvisService'
import {
  JARVIS_ENTITY_TYPE,
  JARVIS_TAX_REGIME,
  type JarvisEntityType,
  type JarvisTaxRegime,
} from '../types/jarvis'

export function useJarvisIntegrationSettings() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    markConfigured,
    isCheckingSetup,
    isJarvisConfigured,
  } = useIntegrationSetup()
  const showSetupRequiredNotice = !isCheckingSetup && !isJarvisConfigured
  const [businessName, setBusinessName] = useState('')
  const [economicActivity, setEconomicActivity] = useState('')
  const [entityType, setEntityType] = useState<JarvisEntityType>(
    JARVIS_ENTITY_TYPE.LEGAL_ENTITY,
  )
  const [taxRegime, setTaxRegime] = useState<JarvisTaxRegime>(
    JARVIS_TAX_REGIME.COMMON,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.company?.id) {
      return
    }

    void (async () => {
      try {
        const status = await fetchJarvisCredentialsStatus()

        if (!status.configured) {
          return
        }

        markConfigured()

        if (status.business_name) {
          setBusinessName(status.business_name)
        }

        if (status.economic_activity) {
          setEconomicActivity(status.economic_activity)
        }

        if (status.entity_type) {
          setEntityType(status.entity_type)
        }

        if (status.tax_regime) {
          setTaxRegime(status.tax_regime)
        }
      } catch {
        // El estado global lo resuelve IntegrationSetupContext.
      }
    })()
  }, [markConfigured, user?.company?.id])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isSaving) {
        return
      }

      if (!user?.company) {
        setErrorMessage('No se encontró la empresa asociada a la sesión.')
        setSuccessMessage(null)
        return
      }

      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      try {
        const response = await saveJarvisCredentials({
          business_name: businessName.trim(),
          economic_activity: economicActivity.trim(),
          entity_type: entityType,
          tax_regime: taxRegime,
        })

        markConfigured()
        setSuccessMessage(
          `Configuración guardada para ${response.business_name}.`,
        )
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo guardar la configuración inicial.',
          ),
        )
      } finally {
        setIsSaving(false)
      }
    },
    [
      businessName,
      economicActivity,
      entityType,
      isSaving,
      markConfigured,
      taxRegime,
      user?.company,
    ],
  )

  const isBusy = isAuthLoading || isSaving

  return {
    isAuthLoading,
    hasCompany: Boolean(user?.company),
    businessName,
    economicActivity,
    entityType,
    taxRegime,
    isSaving,
    isBusy,
    successMessage,
    showSetupRequiredNotice,
    isJarvisConfigured,
    errorMessage,
    setBusinessName,
    setEconomicActivity,
    setEntityType,
    setTaxRegime,
    handleSubmit,
  }
}
