import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import { parseRegistrationRut } from '../services/authService'
import {
  fetchJarvisCredentialsStatus,
  parseJarvisResolution,
  saveJarvisCredentials,
  saveJarvisResolution,
} from '../services/jarvisService'
import {
  JARVIS_TAX_REGIME,
  JARVIS_TAX_RESPONSIBILITY,
  JARVIS_VAT_REGIME,
  type JarvisDianResolution,
  type JarvisTaxRegime,
  type JarvisTaxResponsibility,
  type JarvisVatRegime,
} from '../types/jarvis'

export type JarvisSetupStepId =
  | 'company'
  | 'electronic_invoice'
  | 'support_document'

export interface JarvisSetupStep {
  id: JarvisSetupStepId
  label: string
  description: string
}

type ResolutionDraft = {
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

const EMPTY_RESOLUTION: ResolutionDraft = {
  formNumber: '',
  nit: '',
  checkDigit: '',
  businessName: '',
  documentTypeLabel: '',
  modalityCode: '',
  prefix: '',
  fromNumber: '',
  toNumber: '',
  requestType: '',
  year: '',
  authorizedAt: '',
  technicalKey: '',
  dateFrom: '',
  dateTo: '',
}

function isJarvisTaxRegime(value: string | null | undefined): value is JarvisTaxRegime {
  return Object.values(JARVIS_TAX_REGIME).includes(value as JarvisTaxRegime)
}

function isJarvisVatRegime(value: string | null | undefined): value is JarvisVatRegime {
  return Object.values(JARVIS_VAT_REGIME).includes(value as JarvisVatRegime)
}

function isJarvisTaxResponsibility(
  value: string | null | undefined,
): value is JarvisTaxResponsibility {
  return Object.values(JARVIS_TAX_RESPONSIBILITY).includes(
    value as JarvisTaxResponsibility,
  )
}

function resolutionToDraft(
  resolution?: JarvisDianResolution | null,
  fallbackLabel = '',
): ResolutionDraft {
  if (!resolution) {
    return {
      ...EMPTY_RESOLUTION,
      documentTypeLabel: fallbackLabel,
    }
  }

  return {
    formNumber: resolution.formNumber ?? '',
    nit: resolution.nit ?? '',
    checkDigit: resolution.checkDigit ?? '',
    businessName: resolution.businessName ?? '',
    documentTypeLabel: resolution.documentTypeLabel || fallbackLabel,
    modalityCode: resolution.modalityCode ?? '',
    prefix: resolution.prefix ?? '',
    fromNumber:
      resolution.nextConsecutive != null
        ? String(resolution.nextConsecutive)
        : resolution.fromNumber != null
          ? String(resolution.fromNumber)
          : '',
    toNumber: resolution.toNumber != null ? String(resolution.toNumber) : '',
    requestType: resolution.requestType ?? '',
    year: resolution.year ?? '',
    authorizedAt: resolution.authorizedAt ?? '',
    technicalKey: resolution.technicalKey ?? '',
    dateFrom: resolution.dateFrom ?? resolution.authorizedAt ?? '',
    dateTo: resolution.dateTo ?? '',
  }
}

function patchResolutionDraft(
  current: ResolutionDraft,
  resolution: JarvisDianResolution,
): ResolutionDraft {
  return {
    formNumber: resolution.formNumber ?? current.formNumber,
    nit: resolution.nit ?? current.nit,
    checkDigit: resolution.checkDigit ?? current.checkDigit,
    businessName: resolution.businessName ?? current.businessName,
    documentTypeLabel:
      resolution.documentTypeLabel || current.documentTypeLabel,
    modalityCode: resolution.modalityCode ?? current.modalityCode,
    prefix: resolution.prefix || current.prefix,
    fromNumber:
      resolution.fromNumber != null
        ? String(resolution.fromNumber)
        : current.fromNumber,
    toNumber:
      resolution.toNumber != null
        ? String(resolution.toNumber)
        : current.toNumber,
    requestType: resolution.requestType ?? current.requestType,
    year: resolution.year ?? current.year,
    authorizedAt: resolution.authorizedAt ?? current.authorizedAt,
    technicalKey: resolution.technicalKey ?? current.technicalKey,
    dateFrom:
      resolution.dateFrom ??
      resolution.authorizedAt ??
      current.dateFrom,
    dateTo: resolution.dateTo ?? current.dateTo,
  }
}

export function useJarvisIntegrationSettings() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    markConfigured,
    refreshSetupStatus,
    isCheckingSetup,
    isJarvisCompanyConfigured,
    isSupportDocumentResolutionConfigured,
    isElectronicInvoiceResolutionConfigured,
    includedDocumentTypes,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    requiresSetup,
  } = useIntegrationSetup()
  const showSetupRequiredNotice = !isCheckingSetup && requiresSetup

  const [businessName, setBusinessName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [economicActivity, setEconomicActivity] = useState('')
  const [taxRegime, setTaxRegime] = useState<JarvisTaxRegime>(
    JARVIS_TAX_REGIME.COMMON,
  )
  const [vatRegime, setVatRegime] = useState<JarvisVatRegime>(
    JARVIS_VAT_REGIME.RESPONSIBLE,
  )
  const [taxResponsibility, setTaxResponsibility] =
    useState<JarvisTaxResponsibility>(JARVIS_TAX_RESPONSIBILITY.NOT_APPLICABLE)
  const [country, setCountry] = useState('Colombia')
  const [department, setDepartment] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isParsingRut, setIsParsingRut] = useState(false)
  const [rutFileName, setRutFileName] = useState('')
  const [rutWarnings, setRutWarnings] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [activeStepId, setActiveStepId] = useState<JarvisSetupStepId | null>(
    'company',
  )
  const [invoiceResolution, setInvoiceResolution] =
    useState<ResolutionDraft>(EMPTY_RESOLUTION)
  const [supportResolution, setSupportResolution] =
    useState<ResolutionDraft>(EMPTY_RESOLUTION)
  const [invoiceConfigured, setInvoiceConfigured] = useState(false)
  const [supportConfigured, setSupportConfigured] = useState(false)
  const [isParsingResolution, setIsParsingResolution] = useState(false)
  const [isSavingResolution, setIsSavingResolution] = useState(false)
  const [resolutionFileName, setResolutionFileName] = useState('')
  const [resolutionWarnings, setResolutionWarnings] = useState<string[]>([])
  const [statusLoaded, setStatusLoaded] = useState(false)

  const steps = useMemo<JarvisSetupStep[]>(() => {
    const nextSteps: JarvisSetupStep[] = [
      {
        id: 'company',
        label: 'Empresa',
        description: 'Datos tributarios iniciales',
      },
    ]

    if (hasPurchaseInvoiceAccess) {
      nextSteps.push({
        id: 'electronic_invoice',
        label: 'Factura electrónica',
        description: 'Resolución DIAN de numeración',
      })
    }

    if (hasSupportDocumentAccess) {
      nextSteps.push({
        id: 'support_document',
        label: 'Documento soporte',
        description: 'Resolución DIAN de numeración',
      })
    }

    return nextSteps
  }, [hasPurchaseInvoiceAccess, hasSupportDocumentAccess])

  const isStepComplete = useCallback(
    (stepId: JarvisSetupStepId) => {
      if (stepId === 'company') return isJarvisCompanyConfigured
      if (stepId === 'electronic_invoice') {
        return invoiceConfigured || isElectronicInvoiceResolutionConfigured
      }
      return supportConfigured || isSupportDocumentResolutionConfigured
    },
    [
      invoiceConfigured,
      isElectronicInvoiceResolutionConfigured,
      isJarvisCompanyConfigured,
      isSupportDocumentResolutionConfigured,
      supportConfigured,
    ],
  )

  const isStepUnlocked = useCallback(
    (stepId: JarvisSetupStepId) => {
      const index = steps.findIndex((step) => step.id === stepId)
      if (index <= 0) return true

      return steps.slice(0, index).every((step) => isStepComplete(step.id))
    },
    [isStepComplete, steps],
  )

  useEffect(() => {
    if (!user?.company?.id) {
      return
    }

    void (async () => {
      try {
        const status = await fetchJarvisCredentialsStatus()

        if (status.configured) {
          markConfigured()
        }

        if (status.business_name) setBusinessName(status.business_name)
        if (status.trade_name) setTradeName(status.trade_name)
        if (status.economic_activity) setEconomicActivity(status.economic_activity)
        if (status.tax_regime) setTaxRegime(status.tax_regime)
        if (status.vat_regime) setVatRegime(status.vat_regime)
        if (status.tax_responsibility) {
          setTaxResponsibility(status.tax_responsibility)
        }
        if (status.country) setCountry(status.country)
        if (status.department) setDepartment(status.department)
        if (status.municipality) setMunicipality(status.municipality)
        if (status.city) setCity(status.city)
        if (status.email) setEmail(status.email)
        if (status.address) setAddress(status.address)
        if (status.phone) setPhone(status.phone)

        setInvoiceResolution(
          resolutionToDraft(
            status.electronicInvoiceResolution,
            'FACTURA ELECTRÓNICA DE VENTA',
          ),
        )
        setSupportResolution(
          resolutionToDraft(
            status.supportDocumentResolution,
            'DOCUMENTO SOPORTE',
          ),
        )
        setInvoiceConfigured(
          Boolean(status.electronicInvoiceResolutionConfigured),
        )
        setSupportConfigured(
          Boolean(status.supportDocumentResolutionConfigured),
        )
      } catch {
        // El estado global lo resuelve IntegrationSetupContext.
      } finally {
        setStatusLoaded(true)
      }
    })()
  }, [markConfigured, user?.company?.id])

  useEffect(() => {
    if (!statusLoaded || steps.length === 0) {
      return
    }

    const allComplete = steps.every((step) => isStepComplete(step.id))
    if (allComplete) {
      setActiveStepId(null)
      return
    }

    const firstIncomplete = steps.find(
      (step) => !isStepComplete(step.id) && isStepUnlocked(step.id),
    )

    if (firstIncomplete) {
      setActiveStepId(firstIncomplete.id)
    }
    // Solo al cargar estado / cambiar el plan visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after status/plan
  }, [statusLoaded, steps])

  const handleRutUpload = useCallback(async (file?: File) => {
    if (!file) return

    setErrorMessage(null)
    setSuccessMessage(null)
    setRutWarnings([])

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMessage('El RUT debe ser un archivo PDF.')
      return
    }

    setIsParsingRut(true)
    setRutFileName(file.name)

    try {
      const response = await parseRegistrationRut(file)
      const credentials = response.data.jarvisCredentials

      if (credentials.business_name) setBusinessName(credentials.business_name)
      if (credentials.trade_name) setTradeName(credentials.trade_name)
      if (credentials.economic_activity) {
        setEconomicActivity(credentials.economic_activity)
      }
      if (isJarvisTaxRegime(credentials.tax_regime)) {
        setTaxRegime(credentials.tax_regime)
      }
      if (isJarvisVatRegime(credentials.vat_regime)) {
        setVatRegime(credentials.vat_regime)
      }
      if (isJarvisTaxResponsibility(credentials.tax_responsibility)) {
        setTaxResponsibility(credentials.tax_responsibility)
      }
      if (credentials.country) setCountry(credentials.country)
      if (credentials.department) setDepartment(credentials.department)
      if (credentials.municipality) setMunicipality(credentials.municipality)
      if (credentials.city) setCity(credentials.city)
      if (credentials.email) setEmail(credentials.email)
      if (credentials.address) setAddress(credentials.address)
      if (credentials.phone) setPhone(credentials.phone)

      setRutWarnings(response.data.warnings)
      setSuccessMessage(
        'Datos extraídos del RUT. Revise la información antes de guardar.',
      )
    } catch (error) {
      setRutFileName('')
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron extraer los datos del RUT.'),
      )
    } finally {
      setIsParsingRut(false)
    }
  }, [])

  const handleResolutionUpload = useCallback(
    async (kind: 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT', file?: File) => {
      if (!file) return

      setErrorMessage(null)
      setSuccessMessage(null)
      setResolutionWarnings([])

      if (
        file.type !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        setErrorMessage('La resolución debe ser un archivo PDF.')
        return
      }

      setIsParsingResolution(true)
      setResolutionFileName(file.name)

      try {
        const response = await parseJarvisResolution(file)

        if (response.resolution.kind !== kind) {
          setErrorMessage(
            kind === 'SUPPORT_DOCUMENT'
              ? 'El PDF no corresponde a una resolución de Documento soporte.'
              : 'El PDF no corresponde a una resolución de Factura electrónica.',
          )
          return
        }

        if (kind === 'SUPPORT_DOCUMENT') {
          setSupportResolution((current) =>
            patchResolutionDraft(current, response.resolution),
          )
        } else {
          setInvoiceResolution((current) =>
            patchResolutionDraft(current, response.resolution),
          )
        }

        setResolutionWarnings(response.warnings)
        setSuccessMessage(
          'Datos extraídos de la resolución. Revise la información antes de guardar.',
        )
      } catch (error) {
        setResolutionFileName('')
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudieron extraer los datos de la resolución.',
          ),
        )
      } finally {
        setIsParsingResolution(false)
      }
    },
    [],
  )

  const goToNextStep = useCallback(
    (fromStepId: JarvisSetupStepId) => {
      const currentIndex = steps.findIndex((step) => step.id === fromStepId)
      const nextStep = steps[currentIndex + 1]
      setActiveStepId(nextStep?.id ?? null)
    },
    [steps],
  )

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
          ...(tradeName.trim() ? { trade_name: tradeName.trim() } : {}),
          tax_regime: taxRegime,
          vat_regime: vatRegime,
          tax_responsibility: taxResponsibility,
          economic_activity: economicActivity.trim(),
          country: country.trim(),
          department: department.trim(),
          municipality: municipality.trim(),
          city: city.trim(),
          email: email.trim(),
          address: address.trim(),
          phone: phone.trim(),
        })

        markConfigured()
        setSuccessMessage(
          `Configuración de empresa guardada para ${response.business_name}.`,
        )
        await refreshSetupStatus()
        goToNextStep('company')
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
      address,
      businessName,
      city,
      country,
      department,
      economicActivity,
      email,
      goToNextStep,
      isSaving,
      markConfigured,
      municipality,
      phone,
      refreshSetupStatus,
      taxRegime,
      taxResponsibility,
      tradeName,
      user?.company,
      vatRegime,
    ],
  )

  const handleResolutionSubmit = useCallback(
    async (
      event: FormEvent<HTMLFormElement>,
      kind: 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT',
    ) => {
      event.preventDefault()

      if (isSavingResolution) {
        return
      }

      const draft =
        kind === 'SUPPORT_DOCUMENT' ? supportResolution : invoiceResolution
      const fromNumber = Number(draft.fromNumber)
      const toNumber = Number(draft.toNumber)

      if (!draft.prefix.trim()) {
        setErrorMessage('El prefijo es obligatorio.')
        return
      }

      if (!draft.formNumber.trim()) {
        setErrorMessage('El número de resolución DIAN es obligatorio.')
        return
      }

      if (!draft.technicalKey.trim()) {
        setErrorMessage('La clave técnica es obligatoria.')
        return
      }

      if (!draft.dateFrom.trim() || !draft.dateTo.trim()) {
        setErrorMessage('Las fechas de vigencia (Desde/Hasta) son obligatorias.')
        return
      }

      if (draft.dateTo.trim() < draft.dateFrom.trim()) {
        setErrorMessage('La vigencia es inválida: Hasta es menor que Desde.')
        return
      }

      if (!Number.isFinite(fromNumber) || fromNumber < 1) {
        setErrorMessage('El número Desde es inválido.')
        return
      }

      if (!Number.isFinite(toNumber) || toNumber < fromNumber) {
        setErrorMessage('El número Hasta es inválido.')
        return
      }

      setIsSavingResolution(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      try {
        const response = await saveJarvisResolution({
          kind,
          formNumber: draft.formNumber.trim(),
          nit: draft.nit.trim() || undefined,
          checkDigit: draft.checkDigit.trim() || undefined,
          businessName: draft.businessName.trim() || undefined,
          documentTypeLabel:
            draft.documentTypeLabel.trim() ||
            (kind === 'SUPPORT_DOCUMENT'
              ? 'DOCUMENTO SOPORTE'
              : 'FACTURA ELECTRÓNICA DE VENTA'),
          modalityCode: draft.modalityCode.trim() || undefined,
          prefix: draft.prefix.trim().toUpperCase(),
          fromNumber,
          toNumber,
          requestType: draft.requestType.trim() || undefined,
          year: draft.year.trim() || undefined,
          authorizedAt:
            draft.authorizedAt.trim() || draft.dateFrom.trim() || undefined,
          technicalKey: draft.technicalKey.trim(),
          dateFrom: draft.dateFrom.trim(),
          dateTo: draft.dateTo.trim(),
        })

        if (kind === 'SUPPORT_DOCUMENT') {
          setSupportConfigured(true)
          setSupportResolution(resolutionToDraft(response.resolution))
          setSuccessMessage(
            'Resolución de Documento soporte enviada correctamente.',
          )
          await refreshSetupStatus()
          goToNextStep('support_document')
        } else {
          setInvoiceConfigured(true)
          setInvoiceResolution(resolutionToDraft(response.resolution))
          setSuccessMessage(
            'Resolución de Factura electrónica enviada correctamente.',
          )
          await refreshSetupStatus()
          goToNextStep('electronic_invoice')
        }
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo enviar la resolución. Intenta nuevamente.',
          ),
        )
      } finally {
        setIsSavingResolution(false)
      }
    },
    [
      goToNextStep,
      invoiceResolution,
      isSavingResolution,
      refreshSetupStatus,
      supportResolution,
    ],
  )

  const isBusy =
    isAuthLoading ||
    isSaving ||
    isParsingRut ||
    isParsingResolution ||
    isSavingResolution

  const allRequiredStepsComplete = steps.every((step) =>
    isStepComplete(step.id),
  )

  return {
    isAuthLoading,
    hasCompany: Boolean(user?.company),
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
    isJarvisConfigured: isJarvisCompanyConfigured,
    isJarvisCompanyConfigured,
    errorMessage,
    includedDocumentTypes,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    steps,
    activeStepId,
    setActiveStepId,
    isStepComplete,
    isStepUnlocked,
    invoiceResolution,
    supportResolution,
    setInvoiceResolution,
    setSupportResolution,
    invoiceConfigured,
    supportConfigured,
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
  }
}
