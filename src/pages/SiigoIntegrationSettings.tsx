import { Link } from 'react-router-dom'
import AuthCompanyDisplay from '../components/AuthCompanyDisplay'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { useSiigoIntegrationSettings } from '../hooks/useSiigoIntegrationSettings'
import '../pages/InvoiceUpload.css'
import './SiigoIntegrationSettings.css'

function SiigoIntegrationSettings() {
  const {
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
  } = useSiigoIntegrationSettings()

  const planBlockedReason = !isSubscriptionActive
    ? 'La suscripción SIIGO no está activa. Contacte al administrador para activar el plan.'
    : !hasSupportDocumentAccess
      ? `El plan actual no incluye Documento soporte${
          includedDocumentTypes.length
            ? ` (incluye: ${includedDocumentTypes.join(', ')})`
            : ''
        }. Contacte al administrador.`
      : null

  return (
    <main className="settings-page">
      <PageHeader
        title="Configuración de integración SIIGO"
        description="Complete dos pasos: 1) guardar credenciales y 2) sincronizar cuentas contables. Con ambos listos y un plan activo, se habilitan los documentos incluidos en su suscripción."
      />

      {showSetupRequiredNotice && (
        <div className="settings-page__setup-notice" role="status">
          {!isSiigoConfigured
            ? 'Paso 1 pendiente: guarde las credenciales de SIIGO.'
            : 'Paso 2 pendiente: sincronice las cuentas contables desde SIIGO para habilitar sus documentos.'}
        </div>
      )}

      {planBlockedReason && (isSiigoConfigured || hasSiigoAccounts) && (
        <div className="settings-page__setup-notice" role="status">
          {planBlockedReason}
          {subscription?.plan?.name
            ? ` Plan actual: ${subscription.plan.name}.`
            : ''}
        </div>
      )}

      {isSupportDocumentEnabled && (
        <div className="settings-page__ready-notice" role="status">
          SIIGO ya está configurado y las cuentas contables están sincronizadas.
          Puede continuar a{' '}
          <Link to="/documento-soporte">Documento soporte</Link>.
        </div>
      )}

      <section className="settings-card">
        <div className="settings-card__header">
          <h2 className="settings-card__title">1. Credenciales SIIGO</h2>
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
              {isSavingCredentials && !isSyncingSuppliers
                ? 'Guardando credenciales...'
                : 'Guardar credenciales'}
            </button>
          </div>
        </form>

        {isSavingCredentials && !isSyncingSuppliers && (
          <LoadingIndicator message="Autenticando con SIIGO..." />
        )}
        {credentialsSuccessMessage && (
          <SuccessMessage message={credentialsSuccessMessage} />
        )}
      </section>

      <section className="settings-card settings-card--spaced">
        <div className="settings-card__header">
          <h2 className="settings-card__title">2. Cuentas contables</h2>
          <p className="settings-card__description">
            Sincronice las cuentas contables desde el Balance de Prueba general
            de SIIGO (últimos 2 años). Este paso es obligatorio para habilitar
            los documentos de su plan. Puede tardar unos minutos.
          </p>
          {isSiigoConfigured && hasSiigoAccounts && (
            <p className="settings-card__hint">
              Cuentas contables ya sincronizadas. Puede volver a actualizarlas
              cuando lo necesite.
            </p>
          )}
        </div>

        <div className="settings-card__actions">
          <button
            type="button"
            className="import-siigo-button"
            onClick={() => void handleSyncSuppliers()}
            disabled={!canSyncSuppliers}
            title={
              !canSyncSuppliers
                ? 'Guarde las credenciales arriba para habilitar la sincronización'
                : undefined
            }
          >
            {isSyncingSuppliers
              ? 'Sincronizando cuentas...'
              : 'Sincronizar cuentas contables'}
          </button>
        </div>

        {!canSyncSuppliers && hasCompany && (
          <p className="settings-card__description">
            {isSiigoConfigured
              ? 'Espere a que termine la operación en curso.'
              : 'Guarde primero las credenciales de SIIGO para habilitar este botón.'}
          </p>
        )}

        {isSyncingSuppliers && (
          <LoadingIndicator message="Sincronizando cuentas contables desde SIIGO (últimos 2 años)..." />
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
