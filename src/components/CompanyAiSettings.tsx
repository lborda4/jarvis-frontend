import { useEffect, useState } from 'react'
import CompanyAiContextFields from './CompanyAiContextFields'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import LoadingIndicator from './LoadingIndicator'
import {
  fetchCompanyAiContext,
  saveCompanyAiContext,
} from '../services/companyAiContextService'
import { getApiErrorMessage } from '../services/apiClient'
import type { CompanyAiContext } from '../types/companyAiContext'

export default function CompanyAiSettings() {
  const [value, setValue] = useState<CompanyAiContext>({
    description: '',
    rules: [],
  })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    void fetchCompanyAiContext()
      .then((context) => {
        if (!cancelled) {
          setValue(context)
          setLoaded(true)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            getApiErrorMessage(
              err,
              'No se pudo cargar la configuración de IA.',
            ),
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [retry])

  const save = async () => {
    if (value.rules.some((rule) => !rule.trim())) {
      setError('Complete o elimine las reglas vacías.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      setValue(
        await saveCompanyAiContext({
          description: value.description.trim(),
          rules: value.rules.map((rule) => rule.trim()),
        }),
      )
      setSuccess('Descripción y reglas guardadas.')
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo guardar la configuración de IA.'),
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className="settings-card company-ai-settings">
      <h2>Sugerencias de cuentas con IA</h2>
      <p>
        La descripción es la misma que se configura en Administración. Agregue
        criterios para clasificar las facturas de compra de esta empresa.
      </p>
      {loading ? (
        <LoadingIndicator message="Cargando descripción y reglas..." />
      ) : loaded ? (
        <>
          <CompanyAiContextFields
            value={value}
            disabled={saving}
            onChange={(next) => {
              setValue(next)
              setSuccess(null)
              setError(null)
            }}
          />
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Guardando...' : 'Guardar descripción y reglas'}
          </Button>
        </>
      ) : (
        <Button
          onClick={() => {
            setLoading(true)
            setError(null)
            setRetry((current) => current + 1)
          }}
        >
          Reintentar
        </Button>
      )}
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message={success} />}
    </section>
  )
}
