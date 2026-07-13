import AuthCompanyDisplay from '../components/AuthCompanyDisplay'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import SuccessMessage from '../components/SuccessMessage'
import { useSiigoIntegrationSettings } from '../hooks/useSiigoIntegrationSettings'
import '../pages/InvoiceUpload.css'
import './SiigoIntegrationSettings.css'

function SiigoIntegrationSettings() {
  const {
    isAuthLoading,
    hasCompany,
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
  } = useSiigoIntegrationSettings()

  const canSaveCredentials =
    hasCompany &&
    username.trim().length > 0 &&
    accessKey.trim().length > 0 &&
    partnerId.trim().length > 0 &&
    !isSavingCredentials &&
    !isAuthLoading

  const canSyncSuppliers = hasCompany && !isSyncingSuppliers && !isAuthLoading

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <h1>Configuración de integración SIIGO</h1>
        <p>
          Configure las credenciales de SIIGO y sincronice proveedores para su
          empresa.
        </p>
      </header>

      <section className="settings-card">
        <div className="settings-card__header">
          <h2 className="settings-card__title">Credenciales SIIGO</h2>
          <p className="settings-card__description">
            Ingrese las credenciales de acceso a la API de SIIGO. El backend
            autenticará y almacenará el token automáticamente.
          </p>
          <p className="settings-card__hint">
            Para generar las credenciales API de producción ingresa a la ruta{' '}
            <strong>Alianzas → Mi credencial API</strong> o{' '}
            <strong>
              Configuración → Alianzas e integraciones → Credenciales Siigo API
            </strong>
            .
          </p>
        </div>

        <AuthCompanyDisplay />

        <form className="settings-form" onSubmit={handleSaveCredentials}>
          <div className="settings-form__field">
            <label htmlFor="siigo-username">Usuario</label>
            <input
              id="siigo-username"
              type="email"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <div className="settings-form__field">
            <label htmlFor="siigo-access-key">Access key</label>
            <input
              id="siigo-access-key"
              type="password"
              autoComplete="off"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <div className="settings-form__field">
            <label htmlFor="siigo-partner-id">Partner ID</label>
            <input
              id="siigo-partner-id"
              type="text"
              autoComplete="off"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <div className="settings-card__actions">
            <button
              type="submit"
              className="import-siigo-button"
              disabled={!canSaveCredentials}
            >
              {isSavingCredentials ? 'Guardando credenciales...' : 'Guardar credenciales'}
            </button>
          </div>
        </form>

        {isSavingCredentials && (
          <LoadingIndicator message="Autenticando con SIIGO..." />
        )}
        {credentialsSuccessMessage && (
          <SuccessMessage message={credentialsSuccessMessage} />
        )}
      </section>

      <section className="settings-card settings-card--spaced">
        <div className="settings-card__header">
          <h2 className="settings-card__title">Proveedores y cuentas contables</h2>
          <p className="settings-card__description">
            Sincronice los proveedores desde SIIGO para configurar
            automáticamente las cuentas contables utilizadas por cada tercero.
          </p>
        </div>

        <div className="settings-card__actions">
          <button
            type="button"
            className="import-siigo-button"
            onClick={() => void handleSyncSuppliers()}
            disabled={!canSyncSuppliers}
          >
            {isSyncingSuppliers
              ? 'Actualizando proveedores...'
              : 'Actualizar proveedores desde SIIGO'}
          </button>
        </div>

        {isSyncingSuppliers && (
          <LoadingIndicator message="Sincronizando proveedores desde SIIGO..." />
        )}
        {suppliersSuccessMessage && (
          <SuccessMessage message={suppliersSuccessMessage} />
        )}
      </section>

      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default SiigoIntegrationSettings
