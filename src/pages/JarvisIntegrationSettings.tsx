import AuthCompanyDisplay from '../components/AuthCompanyDisplay'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import SuccessMessage from '../components/SuccessMessage'
import { useJarvisIntegrationSettings } from '../hooks/useJarvisIntegrationSettings'
import {
  JARVIS_ENTITY_TYPE_OPTIONS,
  JARVIS_TAX_REGIME_OPTIONS,
} from '../types/jarvis'
import '../pages/InvoiceUpload.css'
import './SiigoIntegrationSettings.css'

function JarvisIntegrationSettings() {
  const {
    hasCompany,
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
  } = useJarvisIntegrationSettings()

  const canSubmit =
    hasCompany &&
    businessName.trim().length > 0 &&
    economicActivity.trim().length > 0 &&
    !isSaving

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <h1>Configuración inicial</h1>
        <p>
          Complete la información tributaria de su empresa para comenzar a usar
          Jarvis.
        </p>
      </header>

      {showSetupRequiredNotice && (
        <div className="settings-page__setup-notice" role="status">
          Antes de continuar, complete la configuración inicial de su empresa.
        </div>
      )}

      {isJarvisConfigured && (
        <div className="settings-page__ready-notice" role="status">
          La configuración inicial ya está completa. Puede actualizar los datos
          cuando lo necesite.
        </div>
      )}

      <section className="settings-card">
        <div className="settings-card__header">
          <h2 className="settings-card__title">Datos de la empresa</h2>
          <p className="settings-card__description">
            Esta información se guarda en la integración Jarvis de su empresa.
          </p>
        </div>

        <AuthCompanyDisplay />

        <form className="settings-form" onSubmit={handleSubmit}>
          <div className="settings-form__field">
            <label htmlFor="jarvis-business-name">Razón social</label>
            <input
              id="jarvis-business-name"
              type="text"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Nombre legal de la empresa"
              disabled={isBusy}
              required
            />
          </div>

          <div className="settings-form__field">
            <label htmlFor="jarvis-economic-activity">Actividad económica</label>
            <input
              id="jarvis-economic-activity"
              type="text"
              value={economicActivity}
              onChange={(event) => setEconomicActivity(event.target.value)}
              placeholder="Ej. Consultoría, comercio, servicios"
              disabled={isBusy}
              required
            />
          </div>

          <div className="settings-form__field">
            <label htmlFor="jarvis-entity-type">Persona o empresa</label>
            <select
              id="jarvis-entity-type"
              value={entityType}
              onChange={(event) =>
                setEntityType(event.target.value as typeof entityType)
              }
              disabled={isBusy}
              required
            >
              {JARVIS_ENTITY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-form__field">
            <label htmlFor="jarvis-tax-regime">Tipo de régimen</label>
            <select
              id="jarvis-tax-regime"
              value={taxRegime}
              onChange={(event) =>
                setTaxRegime(event.target.value as typeof taxRegime)
              }
              disabled={isBusy}
              required
            >
              {JARVIS_TAX_REGIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-card__actions">
            <button
              type="submit"
              className="import-siigo-button"
              disabled={!canSubmit}
            >
              {isSaving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>

        {isSaving && <LoadingIndicator message="Guardando configuración..." />}
        {successMessage && <SuccessMessage message={successMessage} />}
      </section>

      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default JarvisIntegrationSettings
