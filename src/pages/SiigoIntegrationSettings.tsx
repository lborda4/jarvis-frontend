import { Link } from 'react-router-dom'
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
    showSetupRequiredNotice,
    isSiigoConfigured,
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
          Configure las credenciales de SIIGO y sincronice el catálogo de cuentas
          contables para su empresa.
        </p>
      </header>

      {showSetupRequiredNotice && (
        <div className="settings-page__setup-notice" role="status">
          Para usar Documento soporte, primero configure las credenciales de SIIGO
          en el formulario de abajo.
        </div>
      )}

      {isSiigoConfigured && (
        <div className="settings-page__ready-notice" role="status">
          SIIGO ya está configurado para esta empresa. Puede continuar a{' '}
          <Link to="/documento-soporte">Documento soporte</Link>.
        </div>
      )}

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
            . Consulta la guía oficial de SIIGO con el paso a paso en{' '}
            <a
              href="https://siigonube.portaldeclientes.siigo.com/generar-credenciales-api/"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-card__hint-link"
            >
              Generar credenciales API
            </a>
            .
          </p>
        </div>

        <AuthCompanyDisplay />

        <form
          className="settings-form"
          onSubmit={handleSaveCredentials}
          autoComplete="off"
        >
          <div className="settings-form__field">
            <label htmlFor="siigo-username">Correo acceso SIIGO</label>
            <input
              id="siigo-username"
              name="jarvis-siigo-username"
              type="text"
              autoComplete="off"
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
              name="jarvis-siigo-access-key"
              type="password"
              autoComplete="new-password"
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
              name="jarvis-siigo-partner-id"
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
          <h2 className="settings-card__title">Cuentas contables</h2>
          <p className="settings-card__description">
            Sincronice las cuentas contables desde el Balance de Prueba general
            de SIIGO (últimos 3 años).
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
              ? 'Actualizando cuentas...'
              : 'Actualizar cuentas desde SIIGO'}
          </button>
        </div>

        {isSyncingSuppliers && (
          <LoadingIndicator message="Sincronizando cuentas contables desde SIIGO..." />
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
