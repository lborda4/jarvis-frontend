import { useEffect } from 'react'
import AuthCompanyDisplay from '../components/AuthCompanyDisplay'
import ErrorMessage from '../components/ErrorMessage'
import { CheckIcon } from '../components/icons/SidebarIcons'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import {
  useJarvisIntegrationSettings,
  type JarvisSetupStepId,
} from '../hooks/useJarvisIntegrationSettings'
import {
  JARVIS_TAX_REGIME_OPTIONS,
  JARVIS_TAX_RESPONSIBILITY_OPTIONS,
  JARVIS_VAT_REGIME_OPTIONS,
  type JarvisAvailableResolution,
} from '../types/jarvis'
import '../pages/InvoiceUpload.css'
import './SiigoIntegrationSettings.css'

/** Etiqueta de una resolución en el selector: prefijo, número DIAN y rango
 * autorizado — lo que el contador necesita para reconocerla sin abrir la
 * autorización. Mismo formato que los comprobantes de SIIGO. */
function formatResolutionOptionLabel(
  resolution: JarvisAvailableResolution,
): string {
  const range = `${resolution.fromNumber}–${resolution.toNumber}`
  const number = resolution.formNumber ? ` — ${resolution.formNumber}` : ''

  return `${resolution.prefix}${number} (${range})`
}

function JarvisIntegrationSettings() {
  const {
    hasCompany,
    businessName,
    tradeName,
    economicActivity,
    taxRegime,
    vatRegime,
    taxResponsibility,
    country,
    department,
    municipality,
    city,
    email,
    address,
    phone,
    isSaving,
    isParsingRut,
    rutFileName,
    rutWarnings,
    isBusy,
    successMessage,
    showSetupRequiredNotice,
    errorMessage,
    steps,
    activeStepId,
    setActiveStepId,
    isStepComplete,
    isStepUnlocked,
    hasPurchaseInvoiceAccess,
    hasSupportDocumentAccess,
    isParsingResolution,
    isSavingResolution,
    availableResolutions,
    invoiceResolutionOptions,
    supportResolutionOptions,
    isLoadingResolutions,
    resolutionsError,
    selectedInvoiceResolutionId,
    selectedSupportResolutionId,
    handleSelectResolution,
    reloadAvailableResolutions,
    allRequiredStepsComplete,
    setBusinessName,
    setTradeName,
    setEconomicActivity,
    setTaxRegime,
    setVatRegime,
    setTaxResponsibility,
    setCountry,
    setDepartment,
    setMunicipality,
    setCity,
    setEmail,
    setAddress,
    setPhone,
    handleRutUpload,
    handleSubmit,
    handleResolutionsSubmit,
  } = useJarvisIntegrationSettings()

  const canSubmitCompany =
    hasCompany &&
    businessName.trim().length > 0 &&
    economicActivity.trim().length > 0 &&
    country.trim().length > 0 &&
    department.trim().length > 0 &&
    municipality.trim().length > 0 &&
    city.trim().length > 0 &&
    email.trim().length > 0 &&
    address.trim().length > 0 &&
    phone.trim().length > 0 &&
    Boolean(taxRegime) &&
    Boolean(vatRegime) &&
    Boolean(taxResponsibility) &&
    !isSaving

  const handleStepClick = (stepId: JarvisSetupStepId) => {
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

  useEffect(() => {
    if (!activeStepId) {
      return
    }

    const panel = document.getElementById(`jarvis-step-panel-${activeStepId}`)
    if (!panel) return

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeStepId])

  const showResolutionsStep = steps.some((step) => step.id === 'resolutions')

  // Basta con UNA resolución elegida: se puede configurar un tipo hoy y el
  // otro después. Cada sección del menú se habilita por su cuenta cuando su
  // resolución queda guardada, así que no hay nada que esperar.
  const canSaveResolutions =
    (hasPurchaseInvoiceAccess && Boolean(selectedInvoiceResolutionId)) ||
    (hasSupportDocumentAccess && Boolean(selectedSupportResolutionId))

  const renderAccordionTrigger = (
    stepId: JarvisSetupStepId,
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
        aria-controls={`jarvis-step-body-${stepId}`}
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

  /** Misma tarjeta que usa SIIGO en "Comprobantes de cargue": ícono, título
   * y un selector, que lista SOLO las resoluciones del tipo de documento de
   * la tarjeta. */
  const renderResolutionPicker = (
    kind: 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT',
    iconLabel: string,
    title: string,
    description: string,
  ) => {
    const selectId = `jarvis-resolution-${kind.toLowerCase()}`
    const selectedId =
      kind === 'SUPPORT_DOCUMENT'
        ? selectedSupportResolutionId
        : selectedInvoiceResolutionId
    const iconModifier =
      kind === 'SUPPORT_DOCUMENT'
        ? 'settings-document-type-card__icon--support'
        : 'settings-document-type-card__icon--purchase'
    const options =
      kind === 'SUPPORT_DOCUMENT'
        ? supportResolutionOptions
        : invoiceResolutionOptions

    return (
          <div className="settings-document-type-card">
            <div
              className={`settings-document-type-card__icon ${iconModifier}`}
            >
              {iconLabel}
            </div>
            <div className="settings-document-type-card__body">
              <h3 className="settings-document-type-card__title">{title}</h3>
              <p className="settings-document-type-card__description">
                {description}
              </p>
              <label
                className="settings-document-type-card__label"
                htmlFor={selectId}
              >
                Resolución
              </label>
              <select
                id={selectId}
                value={selectedId}
                onChange={(event) =>
                  handleSelectResolution(kind, event.target.value)
                }
                disabled={
                  isBusy || isLoadingResolutions || options.length === 0
                }
              >
                <option value="">
                  {options.length === 0
                    ? 'Sin resoluciones para este tipo'
                    : 'Seleccione una resolución'}
                </option>
                {options.map((resolution) => (
                  <option key={resolution.id} value={resolution.id}>
                    {formatResolutionOptionLabel(resolution)}
                  </option>
                ))}
              </select>
            </div>
          </div>
    )
  }

  const accordionPanelClass = (stepId: JarvisSetupStepId) => {
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
        title="Configuración Jarvis"
        description={
          allRequiredStepsComplete
            ? 'Su configuración ya está completa. Abra una sección solo si necesita actualizarla.'
            : 'Complete el paso a paso: primero la empresa y luego las resoluciones DIAN según su plan.'
        }
      />

      {showSetupRequiredNotice && (
        <div className="settings-page__setup-notice" role="status">
          Complete todos los pasos del asistente. Hasta finalizar, Documento
          soporte y Terceros permanecerán bloqueados.
        </div>
      )}

      {allRequiredStepsComplete && (
        <div className="settings-page__ready-notice" role="status">
          La configuración requerida ya está completa. Puede actualizar los
          datos cuando lo necesite abriendo cada sección.
        </div>
      )}

      {/* Sin barra de pasos, igual que en SIIGO: el acordeón ya numera cada
          paso y muestra su estado (Completo / Bloqueado). */}
      <div className="settings-accordion">
        <section
          id="jarvis-step-panel-company"
          className={accordionPanelClass('company')}
        >
          {renderAccordionTrigger(
            'company',
            'Datos de la empresa',
            'Información tributaria inicial',
          )}
          <div
            id="jarvis-step-body-company"
            className="settings-accordion__body"
            role="region"
            aria-labelledby="jarvis-step-panel-company"
          >
            <div className="settings-accordion__body-inner">
              <div className="settings-accordion__content">
                <p className="settings-card__description">
                  Esta información se guarda en la integración Jarvis de su
                  empresa.
                </p>

                <AuthCompanyDisplay />

                <div className="settings-form__field settings-form__field--rut">
                  <label htmlFor="jarvis-rut-upload">
                    Autocompletar con el RUT (PDF)
                  </label>
                  <input
                    id="jarvis-rut-upload"
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={isBusy}
                    onChange={(event) => {
                      void handleRutUpload(event.target.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                  {isParsingRut && <span>Leyendo RUT...</span>}
                  {rutFileName && !isParsingRut && (
                    <p className="settings-card__description">
                      Datos cargados desde <strong>{rutFileName}</strong>
                    </p>
                  )}
                  {rutWarnings.length > 0 && (
                    <ul className="settings-card__description">
                      {rutWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <form className="settings-form" onSubmit={handleSubmit}>
                  <div className="settings-form__field">
                    <label htmlFor="jarvis-business-name">Razón social *</label>
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
                    <label htmlFor="jarvis-trade-name">Nombre comercial</label>
                    <input
                      id="jarvis-trade-name"
                      type="text"
                      value={tradeName}
                      onChange={(event) => setTradeName(event.target.value)}
                      placeholder="Nombre con el que opera (opcional)"
                      disabled={isBusy}
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-tax-regime">Tipo de régimen *</label>
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

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-vat-regime">Régimen IVA *</label>
                    <select
                      id="jarvis-vat-regime"
                      value={vatRegime}
                      onChange={(event) =>
                        setVatRegime(event.target.value as typeof vatRegime)
                      }
                      disabled={isBusy}
                      required
                    >
                      {JARVIS_VAT_REGIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-tax-responsibility">
                      Responsabilidad tributaria *
                    </label>
                    <select
                      id="jarvis-tax-responsibility"
                      value={taxResponsibility}
                      onChange={(event) =>
                        setTaxResponsibility(
                          event.target.value as typeof taxResponsibility,
                        )
                      }
                      disabled={isBusy}
                      required
                    >
                      {JARVIS_TAX_RESPONSIBILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-economic-activity">
                      Actividad económica *
                    </label>
                    <input
                      id="jarvis-economic-activity"
                      type="text"
                      value={economicActivity}
                      onChange={(event) =>
                        setEconomicActivity(event.target.value)
                      }
                      placeholder="Ej. Consultoría, comercio, servicios"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-country">País *</label>
                    <input
                      id="jarvis-country"
                      type="text"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="Colombia"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-department">Departamento *</label>
                    <input
                      id="jarvis-department"
                      type="text"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                      placeholder="Ej. Cundinamarca"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-municipality">Municipio *</label>
                    <input
                      id="jarvis-municipality"
                      type="text"
                      value={municipality}
                      onChange={(event) => setMunicipality(event.target.value)}
                      placeholder="Ej. Bogotá D.C."
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-city">Ciudad *</label>
                    <input
                      id="jarvis-city"
                      type="text"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Ej. Bogotá"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-email">Correo *</label>
                    <input
                      id="jarvis-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="contacto@empresa.com"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-address">Dirección *</label>
                    <input
                      id="jarvis-address"
                      type="text"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Calle / carrera y número"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-form__field">
                    <label htmlFor="jarvis-phone">Teléfono *</label>
                    <input
                      id="jarvis-phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="3001234567"
                      disabled={isBusy}
                      required
                    />
                  </div>

                  <div className="settings-card__actions">
                    <button
                      type="submit"
                      className="import-siigo-button"
                      disabled={!canSubmitCompany}
                    >
                      {isSaving ? 'Guardando...' : 'Guardar y continuar'}
                    </button>
                  </div>
                </form>

                {isSaving && (
                  <LoadingIndicator message="Guardando configuración..." />
                )}
              </div>
            </div>
          </div>
        </section>

        {showResolutionsStep && (
          <section
            id="jarvis-step-panel-resolutions"
            className={accordionPanelClass('resolutions')}
          >
            {renderAccordionTrigger(
              'resolutions',
              'Resoluciones DIAN',
              'Numeración autorizada por tipo de documento',
            )}
            <div
              id="jarvis-step-body-resolutions"
              className="settings-accordion__body"
              role="region"
              aria-labelledby="jarvis-step-panel-resolutions"
            >
              <div className="settings-accordion__body-inner">
                <div className="settings-accordion__content">
                  <p className="settings-card__description">
                    Seleccione la resolución DIAN que desea utilizar para cada
                    tipo de documento. Podrá cambiarlas posteriormente cuando
                    lo necesite.
                  </p>

                  {!isStepUnlocked('resolutions') ? (
                    <div className="settings-page__setup-notice" role="status">
                      Complete primero los datos de la empresa para configurar
                      las resoluciones.
                    </div>
                  ) : (
                    <>
                      {isLoadingResolutions && (
                        <LoadingIndicator message="Consultando resoluciones habilitadas en la DIAN..." />
                      )}

                      {resolutionsError && !isLoadingResolutions && (
                        <div
                          className="settings-page__setup-notice"
                          role="status"
                        >
                          {resolutionsError}
                        </div>
                      )}

                      {/* El reintento vive acá y no dentro del aviso porque
                          ese aviso se va solo a los 3 segundos; si el enlace
                          se fuera con él, quedaría una pantalla sin salida. */}
                      {!isLoadingResolutions &&
                        availableResolutions.length === 0 && (
                          <p className="settings-card__description">
                            No hay resoluciones vigentes para mostrar.{' '}
                            <button
                              type="button"
                              className="settings-card__hint-link"
                              onClick={() => void reloadAvailableResolutions()}
                            >
                              Volver a consultar
                            </button>
                          </p>
                        )}

                      <div className="settings-document-types">
                        {hasPurchaseInvoiceAccess &&
                          renderResolutionPicker(
                            'ELECTRONIC_INVOICE',
                            'FE',
                            'Factura electrónica',
                            'Resolución de numeración autorizada',
                          )}

                        {hasSupportDocumentAccess &&
                          renderResolutionPicker(
                            'SUPPORT_DOCUMENT',
                            'DS',
                            'Documento soporte',
                            'Resolución de numeración autorizada',
                          )}
                      </div>

                      <form
                        className="settings-form"
                        onSubmit={(event) =>
                          void handleResolutionsSubmit(event)
                        }
                      >
                        <div className="settings-card__actions">
                          <button
                            type="submit"
                            className="import-siigo-button"
                            disabled={isBusy || !canSaveResolutions}
                          >
                            {isSavingResolution
                              ? 'Guardando...'
                              : 'Guardar resoluciones'}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {(isSavingResolution || isParsingResolution) && (
        <LoadingIndicator
          message={
            isParsingResolution
              ? 'Leyendo resolución...'
              : 'Enviando resolución...'
          }
        />
      )}
      {successMessage && <SuccessMessage message={successMessage} />}
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default JarvisIntegrationSettings
