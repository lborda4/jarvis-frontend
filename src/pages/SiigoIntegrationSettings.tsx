import { Link } from 'react-router-dom'
import AuthCompanyDisplay from '../components/AuthCompanyDisplay'
import ErrorMessage from '../components/ErrorMessage'
import { CheckIcon } from '../components/icons/SidebarIcons'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import {
  useSiigoIntegrationSettings,
  type SiigoSetupStepId,
} from '../hooks/useSiigoIntegrationSettings'
import '../pages/InvoiceUpload.css'
import './SiigoIntegrationSettings.css'

function SiigoIntegrationSettings() {
  const {
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
  } = useSiigoIntegrationSettings()

  const planBlockedReason = !isSubscriptionActive
    ? 'La suscripción SIIGO no está activa. Contacte al administrador para activar el plan.'
    : !hasSupportDocumentAccess && !hasPurchaseInvoiceAccess
      ? `El plan actual no incluye documentos configurables${
          includedDocumentTypes.length
            ? ` (incluye: ${includedDocumentTypes.join(', ')})`
            : ''
        }. Contacte al administrador.`
      : null

  const activeStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStepId),
  )

  const handleStepClick = (stepId: SiigoSetupStepId) => {
    if (!isStepUnlocked(stepId) && !isStepComplete(stepId)) {
      return
    }

    // Con setup finalizado, las secciones se pueden abrir/cerrar.
    if (allRequiredStepsComplete) {
      setActiveStepId((current) => (current === stepId ? null : stepId))
      return
    }

    setActiveStepId(stepId)
  }

  const renderAccordionTrigger = (
    stepId: SiigoSetupStepId,
    title: string,
    description: string,
  ) => {
    const stepIndex = steps.findIndex((step) => step.id === stepId)
    const complete = isStepComplete(stepId)
    const unlocked = isStepUnlocked(stepId)
    const open = activeStepId === stepId
    const locked = !unlocked && !complete

    return (
      <button
        type="button"
        className="settings-accordion__trigger"
        onClick={() => handleStepClick(stepId)}
        disabled={locked}
        aria-expanded={open}
        aria-controls={`siigo-step-body-${stepId}`}
      >
        <span className="settings-accordion__badge" aria-hidden="true">
          {complete ? <CheckIcon /> : stepIndex + 1}
        </span>
        <span className="settings-accordion__copy">
          <strong>{title}</strong>
          <small>
            {locked ? 'Bloqueado' : complete ? 'Completo' : description}
          </small>
        </span>
        <span className="settings-accordion__chevron" aria-hidden="true" />
      </button>
    )
  }

  const accordionPanelClass = (stepId: SiigoSetupStepId) => {
    const complete = isStepComplete(stepId)
    const unlocked = isStepUnlocked(stepId)
    const open = activeStepId === stepId

    return [
      'settings-accordion__panel',
      open ? 'settings-accordion__panel--open' : '',
      complete ? 'settings-accordion__panel--complete' : '',
      !unlocked && !complete ? 'settings-accordion__panel--locked' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <main className="settings-page">
      <PageHeader
        title="Configuración de integración SIIGO"
        description={
          allRequiredStepsComplete
            ? 'Su configuración ya está completa. Abra una sección solo si necesita actualizarla.'
            : 'Complete el paso a paso: 1) credenciales, 2) cuentas contables y 3) comprobantes de cargue. Con todo listo y un plan activo, se habilitan los documentos incluidos en su suscripción.'
        }
      />

      {showSetupRequiredNotice && !allRequiredStepsComplete && (
        <div className="settings-page__setup-notice" role="status">
          {!isSiigoConfigured
            ? 'Paso 1 pendiente: guarde las credenciales de SIIGO.'
            : !hasSiigoAccounts
              ? 'Paso 2 pendiente: sincronice las cuentas contables desde SIIGO.'
              : 'Paso 3 pendiente: seleccione y guarde los comprobantes de cargue.'}
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

      {(isSupportDocumentEnabled || isPurchaseInvoiceEnabled) && (
        <div className="settings-page__ready-notice" role="status">
          SIIGO ya está configurado. Puede continuar a{' '}
          {isSupportDocumentEnabled && (
            <Link to="/documento-soporte">Documento soporte</Link>
          )}
          {isSupportDocumentEnabled && isPurchaseInvoiceEnabled && ' o '}
          {isPurchaseInvoiceEnabled && (
            <Link to="/factura-compra">Factura de compra</Link>
          )}
          .
        </div>
      )}

      {!allRequiredStepsComplete && (
        <nav className="settings-stepper" aria-label="Pasos de configuración">
          <ol className="settings-stepper__list">
            {steps.map((step, index) => {
              const complete = isStepComplete(step.id)
              const unlocked = isStepUnlocked(step.id)
              const active = activeStepId === step.id
              const previousComplete =
                index > 0 && isStepComplete(steps[index - 1].id)

              return (
                <li
                  key={step.id}
                  className={[
                    'settings-stepper__item',
                    previousComplete
                      ? 'settings-stepper__item--connector-done'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className={[
                      'settings-stepper__step',
                      active ? 'settings-stepper__step--active' : '',
                      complete ? 'settings-stepper__step--complete' : '',
                      !unlocked && !complete
                        ? 'settings-stepper__step--locked'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleStepClick(step.id)}
                    disabled={!unlocked && !complete}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="settings-stepper__badge" aria-hidden="true">
                      {complete ? <CheckIcon /> : index + 1}
                    </span>
                    <span className="settings-stepper__copy">
                      <strong>{step.label}</strong>
                      <small>
                        {!unlocked && !complete
                          ? 'Bloqueado'
                          : complete
                            ? 'Completo'
                            : step.description}
                      </small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="settings-stepper__progress">
            Paso {activeStepIndex + 1} de {steps.length}
          </p>
        </nav>
      )}

      <div className="settings-accordion">
        <section
          id="siigo-step-panel-credentials"
          className={accordionPanelClass('credentials')}
        >
          {renderAccordionTrigger(
            'credentials',
            '1. Credenciales SIIGO',
            'Acceso a la API de SIIGO',
          )}
          <div
            id="siigo-step-body-credentials"
            className="settings-accordion__body"
            role="region"
            aria-labelledby="siigo-step-panel-credentials"
          >
            <div className="settings-accordion__body-inner">
              <div className="settings-accordion__content">
                <p className="settings-card__description">
                  Ingrese las credenciales de acceso a la API de SIIGO. El
                  backend autenticará y almacenará el token automáticamente.
                </p>
                <p className="settings-card__hint">
                  Para generar las credenciales API de producción ingresa a la
                  ruta <strong>Alianzas → Mi credencial API</strong> o{' '}
                  <strong>
                    Configuración → Alianzas e integraciones → Credenciales
                    Siigo API
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
                        : 'Guardar y continuar'}
                    </button>
                  </div>
                </form>

                {isSavingCredentials && !isSyncingSuppliers && (
                  <LoadingIndicator message="Autenticando con SIIGO..." />
                )}
                {credentialsSuccessMessage && (
                  <SuccessMessage message={credentialsSuccessMessage} />
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="siigo-step-panel-accounts"
          className={accordionPanelClass('accounts')}
        >
          {renderAccordionTrigger(
            'accounts',
            '2. Cuentas contables',
            'Sincronizar desde el Balance de Prueba',
          )}
          <div
            id="siigo-step-body-accounts"
            className="settings-accordion__body"
            role="region"
            aria-labelledby="siigo-step-panel-accounts"
          >
            <div className="settings-accordion__body-inner">
              <div className="settings-accordion__content">
                <p className="settings-card__description">
                  Sincronice las cuentas contables desde el Balance de Prueba
                  general de SIIGO (últimos 2 años). Este paso es obligatorio
                  para habilitar los documentos de su plan. Puede tardar unos
                  minutos.
                </p>

                {!isStepUnlocked('accounts') ? (
                  <div className="settings-page__setup-notice" role="status">
                    Guarde primero las credenciales de SIIGO para habilitar
                    este paso.
                  </div>
                ) : (
                  <>
                    {isSiigoConfigured && hasSiigoAccounts && (
                      <p className="settings-card__hint">
                        Cuentas contables ya sincronizadas. Puede volver a
                        actualizarlas cuando lo necesite.
                      </p>
                    )}

                    <div className="settings-card__actions">
                      <button
                        type="button"
                        className="import-siigo-button"
                        onClick={() => void handleSyncSuppliers()}
                        disabled={!canSyncSuppliers}
                      >
                        {isSyncingSuppliers
                          ? 'Sincronizando cuentas...'
                          : 'Sincronizar y continuar'}
                      </button>
                    </div>

                    {isSyncingSuppliers && (
                      <LoadingIndicator message="Sincronizando cuentas contables desde SIIGO (últimos 2 años)..." />
                    )}
                    {suppliersSuccessMessage && (
                      <SuccessMessage message={suppliersSuccessMessage} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {needsDocumentTypesStep && (
          <section
            id="siigo-step-panel-document_types"
            className={accordionPanelClass('document_types')}
          >
            {renderAccordionTrigger(
              'document_types',
              '3. Comprobantes de cargue',
              'Elegir comprobante por tipo de documento',
            )}
            <div
              id="siigo-step-body-document_types"
              className="settings-accordion__body"
              role="region"
              aria-labelledby="siigo-step-panel-document_types"
            >
              <div className="settings-accordion__body-inner">
                <div className="settings-accordion__content">
                  <p className="settings-card__description">
                    Seleccione el comprobante de SIIGO que desea utilizar para
                    cada tipo de documento. Podrá cambiarlo posteriormente
                    cuando lo necesite.
                  </p>
                  {hasSiigoDocumentTypesConfigured && (
                    <p className="settings-card__hint">
                      Comprobantes ya configurados. Puede actualizarlos cuando
                      lo necesite.
                    </p>
                  )}

                  {!isStepUnlocked('document_types') ? (
                    <div className="settings-page__setup-notice" role="status">
                      Complete los pasos 1 y 2 para configurar los
                      comprobantes.
                    </div>
                  ) : (
                    <>
                      {isLoadingDocumentTypes && (
                        <LoadingIndicator message="Cargando comprobantes desde SIIGO..." />
                      )}

                      <div className="settings-document-types">
                        {hasSupportDocumentAccess && (
                          <div className="settings-document-type-card">
                            <div className="settings-document-type-card__icon settings-document-type-card__icon--support">
                              DS
                            </div>
                            <div className="settings-document-type-card__body">
                              <h3 className="settings-document-type-card__title">
                                Documento soporte
                              </h3>
                              <p className="settings-document-type-card__description">
                                Comprobante para documento soporte
                              </p>
                              <label
                                className="settings-document-type-card__label"
                                htmlFor="siigo-support-document-type"
                              >
                                Comprobante
                              </label>
                              <select
                                id="siigo-support-document-type"
                                value={selectedSupportDocumentTypeId}
                                onChange={(event) =>
                                  setSelectedSupportDocumentTypeId(
                                    event.target.value,
                                  )
                                }
                                disabled={isBusy || isLoadingDocumentTypes}
                              >
                                <option value="">
                                  Seleccione un comprobante
                                </option>
                                {supportDocumentTypes.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {formatDocumentTypeOptionLabel(item)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {hasPurchaseInvoiceAccess && (
                          <div className="settings-document-type-card">
                            <div className="settings-document-type-card__icon settings-document-type-card__icon--purchase">
                              FC
                            </div>
                            <div className="settings-document-type-card__body">
                              <h3 className="settings-document-type-card__title">
                                Factura de compra
                              </h3>
                              <p className="settings-document-type-card__description">
                                Comprobante para factura de compra
                              </p>
                              <label
                                className="settings-document-type-card__label"
                                htmlFor="siigo-purchase-document-type"
                              >
                                Comprobante
                              </label>
                              <select
                                id="siigo-purchase-document-type"
                                value={selectedPurchaseDocumentTypeId}
                                onChange={(event) =>
                                  setSelectedPurchaseDocumentTypeId(
                                    event.target.value,
                                  )
                                }
                                disabled={isBusy || isLoadingDocumentTypes}
                              >
                                <option value="">
                                  Seleccione un comprobante
                                </option>
                                {purchaseDocumentTypes.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {formatDocumentTypeOptionLabel(item)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="settings-card__actions">
                        <button
                          type="button"
                          className="import-siigo-button"
                          onClick={() => void handleSaveDocumentTypes()}
                          disabled={!canSaveDocumentTypes}
                        >
                          {isSavingDocumentTypes
                            ? 'Guardando comprobantes...'
                            : 'Guardar comprobantes'}
                        </button>
                      </div>

                      {isSavingDocumentTypes && (
                        <LoadingIndicator message="Guardando comprobantes de cargue..." />
                      )}
                      {documentTypesSuccessMessage && (
                        <SuccessMessage message={documentTypesSuccessMessage} />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default SiigoIntegrationSettings
