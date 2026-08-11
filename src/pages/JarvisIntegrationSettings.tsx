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
} from '../types/jarvis'
import '../pages/InvoiceUpload.css'
import './SiigoIntegrationSettings.css'

function ResolutionFields({
  prefixId,
  draft,
  disabled,
  onChange,
}: {
  prefixId: string
  draft: {
    formNumber: string
    nit: string
    checkDigit: string
    businessName: string
    documentTypeLabel: string
    modalityCode: string
    prefix: string
    fromNumber: string
    toNumber: string
    requestType: string
    year: string
    authorizedAt: string
    technicalKey: string
    dateFrom: string
    dateTo: string
  }
  disabled: boolean
  onChange: (patch: Partial<typeof draft>) => void
}) {
  return (
    <>
      <div className="settings-form__field">
        <label htmlFor={`${prefixId}-document-type`}>Tipo de documento *</label>
        <input
          id={`${prefixId}-document-type`}
          type="text"
          value={draft.documentTypeLabel}
          onChange={(event) =>
            onChange({ documentTypeLabel: event.target.value })
          }
          disabled={disabled}
          required
        />
      </div>

      <div className="settings-form__row">
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-prefix`}>Prefijo *</label>
          <input
            id={`${prefixId}-prefix`}
            type="text"
            value={draft.prefix}
            onChange={(event) => onChange({ prefix: event.target.value })}
            placeholder="Ej. DSJ"
            disabled={disabled}
            required
          />
        </div>
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-modality`}>Modalidad</label>
          <input
            id={`${prefixId}-modality`}
            type="text"
            value={draft.modalityCode}
            onChange={(event) => onChange({ modalityCode: event.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="settings-form__row">
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-from`}>Próximo consecutivo *</label>
          <input
            id={`${prefixId}-from`}
            type="number"
            min={1}
            value={draft.fromNumber}
            onChange={(event) => onChange({ fromNumber: event.target.value })}
            disabled={disabled}
            required
          />
        </div>
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-to`}>Hasta el número *</label>
          <input
            id={`${prefixId}-to`}
            type="number"
            min={1}
            value={draft.toNumber}
            onChange={(event) => onChange({ toNumber: event.target.value })}
            disabled={disabled}
            required
          />
        </div>
      </div>

      <div className="settings-form__row">
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-form`}>Número de resolución *</label>
          <input
            id={`${prefixId}-form`}
            type="text"
            value={draft.formNumber}
            onChange={(event) => onChange({ formNumber: event.target.value })}
            placeholder="Ej. 18760000001"
            disabled={disabled}
            required
          />
        </div>
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-request`}>Tipo de solicitud</label>
          <input
            id={`${prefixId}-request`}
            type="text"
            value={draft.requestType}
            onChange={(event) => onChange({ requestType: event.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="settings-form__field">
        <label htmlFor={`${prefixId}-technical-key`}>Clave técnica *</label>
        <input
          id={`${prefixId}-technical-key`}
          type="text"
          value={draft.technicalKey}
          onChange={(event) => onChange({ technicalKey: event.target.value })}
          placeholder="Clave técnica DIAN"
          disabled={disabled}
          required
        />
      </div>

      <div className="settings-form__row">
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-date`}>Fecha resolución *</label>
          <input
            id={`${prefixId}-date`}
            type="date"
            value={draft.authorizedAt}
            onChange={(event) => {
              const authorizedAt = event.target.value
              onChange({
                authorizedAt,
                dateFrom: draft.dateFrom || authorizedAt,
              })
            }}
            disabled={disabled}
            required
          />
        </div>
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-year`}>Año</label>
          <input
            id={`${prefixId}-year`}
            type="text"
            value={draft.year}
            onChange={(event) => onChange({ year: event.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="settings-form__row">
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-date-from`}>Vigencia desde *</label>
          <input
            id={`${prefixId}-date-from`}
            type="date"
            value={draft.dateFrom}
            onChange={(event) => onChange({ dateFrom: event.target.value })}
            disabled={disabled}
            required
          />
        </div>
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-date-to`}>Vigencia hasta *</label>
          <input
            id={`${prefixId}-date-to`}
            type="date"
            value={draft.dateTo}
            onChange={(event) => onChange({ dateTo: event.target.value })}
            disabled={disabled}
            required
          />
        </div>
      </div>

      <div className="settings-form__row">
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-nit`}>NIT</label>
          <input
            id={`${prefixId}-nit`}
            type="text"
            value={draft.nit}
            onChange={(event) => onChange({ nit: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="settings-form__field">
          <label htmlFor={`${prefixId}-dv`}>DV</label>
          <input
            id={`${prefixId}-dv`}
            type="text"
            value={draft.checkDigit}
            onChange={(event) => onChange({ checkDigit: event.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="settings-form__field">
        <label htmlFor={`${prefixId}-business`}>Razón social</label>
        <input
          id={`${prefixId}-business`}
          type="text"
          value={draft.businessName}
          onChange={(event) => onChange({ businessName: event.target.value })}
          disabled={disabled}
        />
      </div>
    </>
  )
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
    invoiceResolution,
    supportResolution,
    setInvoiceResolution,
    setSupportResolution,
    isParsingResolution,
    isSavingResolution,
    resolutionFileName,
    resolutionWarnings,
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
    handleResolutionUpload,
    handleSubmit,
    handleResolutionSubmit,
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

  const activeStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStepId),
  )

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

  const showElectronicInvoiceStep = steps.some(
    (step) => step.id === 'electronic_invoice',
  )
  const showSupportDocumentStep = steps.some(
    (step) => step.id === 'support_document',
  )

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

        {showElectronicInvoiceStep && (
          <section
            id="jarvis-step-panel-electronic_invoice"
            className={accordionPanelClass('electronic_invoice')}
          >
            {renderAccordionTrigger(
              'electronic_invoice',
              'Resolución de factura electrónica',
              'Autorización DIAN de numeración',
            )}
            <div
              id="jarvis-step-body-electronic_invoice"
              className="settings-accordion__body"
              role="region"
            >
              <div className="settings-accordion__body-inner">
                <div className="settings-accordion__content">
                  <p className="settings-card__description">
                    Suba el PDF de autorización DIAN para autocompletar prefijo
                    y rango de numeración.
                  </p>

                  {!isStepUnlocked('electronic_invoice') ? (
                    <div className="settings-page__setup-notice" role="status">
                      Para configurar la resolución de factura, primero complete
                      los datos de la empresa.
                    </div>
                  ) : (
                    <>
                      <div className="settings-form__field settings-form__field--rut">
                        <label htmlFor="jarvis-invoice-resolution-upload">
                          Autocompletar con resolución DIAN (PDF)
                        </label>
                        <input
                          id="jarvis-invoice-resolution-upload"
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={isBusy}
                          onChange={(event) => {
                            void handleResolutionUpload(
                              'ELECTRONIC_INVOICE',
                              event.target.files?.[0],
                            )
                            event.currentTarget.value = ''
                          }}
                        />
                        {isParsingResolution && (
                          <span>Leyendo resolución...</span>
                        )}
                        {resolutionFileName && !isParsingResolution && (
                          <p className="settings-card__description">
                            Datos cargados desde{' '}
                            <strong>{resolutionFileName}</strong>
                          </p>
                        )}
                        {resolutionWarnings.length > 0 && (
                          <ul className="settings-card__description">
                            {resolutionWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <form
                        className="settings-form"
                        onSubmit={(event) =>
                          void handleResolutionSubmit(
                            event,
                            'ELECTRONIC_INVOICE',
                          )
                        }
                      >
                        <ResolutionFields
                          prefixId="jarvis-invoice"
                          draft={invoiceResolution}
                          disabled={isBusy}
                          onChange={(patch) =>
                            setInvoiceResolution((current) => ({
                              ...current,
                              ...patch,
                            }))
                          }
                        />

                        <div className="settings-card__actions">
                          <button
                            type="submit"
                            className="import-siigo-button"
                            disabled={
                              isBusy ||
                              !invoiceResolution.prefix.trim() ||
                              !invoiceResolution.formNumber.trim() ||
                              !invoiceResolution.technicalKey.trim() ||
                              !invoiceResolution.dateFrom.trim() ||
                              !invoiceResolution.dateTo.trim() ||
                              !invoiceResolution.fromNumber ||
                              !invoiceResolution.toNumber
                            }
                          >
                            {isSavingResolution
                              ? 'Enviando...'
                              : 'Enviar resolución y continuar'}
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

        {showSupportDocumentStep && (
          <section
            id="jarvis-step-panel-support_document"
            className={accordionPanelClass('support_document')}
          >
            {renderAccordionTrigger(
              'support_document',
              'Resolución de documento soporte',
              'Autorización DIAN de numeración',
            )}
            <div
              id="jarvis-step-body-support_document"
              className="settings-accordion__body"
              role="region"
            >
              <div className="settings-accordion__body-inner">
                <div className="settings-accordion__content">
                  <p className="settings-card__description">
                    Suba el PDF de autorización DIAN para autocompletar prefijo
                    y rango de numeración.
                  </p>

                  {!isStepUnlocked('support_document') ? (
                    <div className="settings-page__setup-notice" role="status">
                      Complete el paso anterior antes de configurar la
                      resolución de documento soporte.
                    </div>
                  ) : (
                    <>
                      <div className="settings-form__field settings-form__field--rut">
                        <label htmlFor="jarvis-support-resolution-upload">
                          Autocompletar con resolución DIAN (PDF)
                        </label>
                        <input
                          id="jarvis-support-resolution-upload"
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={isBusy}
                          onChange={(event) => {
                            void handleResolutionUpload(
                              'SUPPORT_DOCUMENT',
                              event.target.files?.[0],
                            )
                            event.currentTarget.value = ''
                          }}
                        />
                        {isParsingResolution && (
                          <span>Leyendo resolución...</span>
                        )}
                        {resolutionFileName && !isParsingResolution && (
                          <p className="settings-card__description">
                            Datos cargados desde{' '}
                            <strong>{resolutionFileName}</strong>
                          </p>
                        )}
                        {resolutionWarnings.length > 0 && (
                          <ul className="settings-card__description">
                            {resolutionWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <form
                        className="settings-form"
                        onSubmit={(event) =>
                          void handleResolutionSubmit(
                            event,
                            'SUPPORT_DOCUMENT',
                          )
                        }
                      >
                        <ResolutionFields
                          prefixId="jarvis-support"
                          draft={supportResolution}
                          disabled={isBusy}
                          onChange={(patch) =>
                            setSupportResolution((current) => ({
                              ...current,
                              ...patch,
                            }))
                          }
                        />

                        <div className="settings-card__actions">
                          <button
                            type="submit"
                            className="import-siigo-button"
                            disabled={
                              isBusy ||
                              !supportResolution.prefix.trim() ||
                              !supportResolution.formNumber.trim() ||
                              !supportResolution.technicalKey.trim() ||
                              !supportResolution.dateFrom.trim() ||
                              !supportResolution.dateTo.trim() ||
                              !supportResolution.fromNumber ||
                              !supportResolution.toNumber
                            }
                          >
                            {isSavingResolution
                              ? 'Enviando...'
                              : 'Finalizar configuración'}
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
              : 'Enviando resolución a NextPyme...'
          }
        />
      )}
      {successMessage && <SuccessMessage message={successMessage} />}
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default JarvisIntegrationSettings
